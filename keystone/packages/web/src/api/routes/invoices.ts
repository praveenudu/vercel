import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { landlordOnly, withProfile } from "../middleware/auth";
import { log, requireFeature, today } from "../lib/util";
import { hasFeature } from "../../shared/plans";
import { appBase } from "../services/email";
import { emailNewInvoice } from "../services/notifications";

type Approval = { by: string; at: string; decision: "approved" | "rejected"; note: string; step: number };
const lineItem = z.object({ description: z.string(), qty: z.number(), unitPrice: z.number().int() });

export const invoices = {
  list: withProfile.handler(async ({ context }) => {
    let rows = await db.select().from(s.invoices).where(eq(s.invoices.landlordId, context.lid)).orderBy(desc(s.invoices.createdAt));
    if (context.profile.role === "vendor") {
      const [v] = await db.select().from(s.vendors).where(eq(s.vendors.userId, context.user.id));
      rows = v ? rows.filter((r) => r.vendorId === v.id) : [];
    } else if (context.profile.role !== "landlord") throw new ORPCError("FORBIDDEN");
    const vs = await db.select().from(s.vendors).where(eq(s.vendors.landlordId, context.lid));
    const props = await db.select().from(s.properties).where(eq(s.properties.landlordId, context.lid));
    const reqs = await db.select().from(s.maintenanceRequests).where(eq(s.maintenanceRequests.landlordId, context.lid));
    return {
      threshold: context.owner.approvalThreshold,
      twoStep: hasFeature(context.plan, "two_step"),
      rows: rows.map((r) => ({
        ...r,
        lineItems: JSON.parse(r.lineItemsJson) as z.infer<typeof lineItem>[],
        approvals: JSON.parse(r.approvalsJson) as Approval[],
        vendor: vs.find((v) => v.id === r.vendorId) ?? null,
        property: props.find((p) => p.id === r.propertyId) ?? null,
        request: reqs.find((q) => q.id === r.requestId) ?? null,
      })),
    };
  }),

  submit: withProfile
    .input(z.object({ requestId: z.number().nullable().optional(), propertyId: z.number().optional(), vendorId: z.number().optional(), number: z.string().min(1), category: z.string().default("repairs"), description: z.string().default(""), lineItems: z.array(lineItem).min(1), dueDate: z.string().default(""), attachmentKey: z.string().optional(), attachmentName: z.string().optional() }))
    .handler(async ({ input, context }) => {
      let vendorId = input.vendorId;
      if (context.profile.role === "vendor") {
        const [v] = await db.select().from(s.vendors).where(eq(s.vendors.userId, context.user.id));
        if (!v) throw new ORPCError("FORBIDDEN", { message: "Vendor profile not linked" });
        vendorId = v.id;
      } else if (context.profile.role !== "landlord") throw new ORPCError("FORBIDDEN");
      if (!vendorId) throw new ORPCError("BAD_REQUEST", { message: "Vendor required" });
      let propertyId = input.propertyId;
      if (input.requestId) {
        const [r] = await db.select().from(s.maintenanceRequests).where(and(eq(s.maintenanceRequests.id, input.requestId), eq(s.maintenanceRequests.landlordId, context.lid)));
        if (!r) throw new ORPCError("NOT_FOUND");
        const [u] = await db.select().from(s.units).where(eq(s.units.id, r.unitId));
        propertyId = u?.propertyId;
      }
      if (!propertyId) throw new ORPCError("BAD_REQUEST", { message: "Property required" });
      const amount = input.lineItems.reduce((t, li) => t + Math.round(li.qty * li.unitPrice), 0);
      const [inv] = await db
        .insert(s.invoices)
        .values({ landlordId: context.lid, vendorId, requestId: input.requestId ?? null, propertyId, number: input.number, category: input.category, description: input.description, lineItemsJson: JSON.stringify(input.lineItems), amount, dueDate: input.dueDate, attachmentKey: input.attachmentKey ?? null, attachmentName: input.attachmentName ?? null })
        .returning();
      await log(context.lid, "invoice", inv.id, `Invoice ${inv.number} submitted — $${(amount / 100).toFixed(2)}`, context.user.name);
      if (inv.requestId) await log(context.lid, "maintenance", inv.requestId, `Invoice ${inv.number} submitted ($${(amount / 100).toFixed(2)})`, context.user.name);
      if (context.profile.role === "vendor") await emailNewInvoice(appBase(context.headers), inv);
      return inv;
    }),

  decide: landlordOnly.input(z.object({ id: z.number(), decision: z.enum(["approved", "rejected"]), note: z.string().default("") })).handler(async ({ input, context }) => {
    requireFeature(context.plan, "invoices");
    const [inv] = await db.select().from(s.invoices).where(and(eq(s.invoices.id, input.id), eq(s.invoices.landlordId, context.lid)));
    if (!inv) throw new ORPCError("NOT_FOUND");
    if (!["submitted", "pending_second"].includes(inv.status)) throw new ORPCError("BAD_REQUEST", { message: "Invoice is not awaiting approval" });
    const approvals = JSON.parse(inv.approvalsJson) as Approval[];
    const step = inv.status === "pending_second" ? 2 : 1;
    approvals.push({ by: context.user.name, at: new Date().toISOString(), decision: input.decision, note: input.note, step });
    let status: string = input.decision;
    if (input.decision === "approved" && step === 1 && hasFeature(context.plan, "two_step") && inv.amount > context.owner.approvalThreshold) status = "pending_second";
    await db.update(s.invoices).set({ status, approvalsJson: JSON.stringify(approvals) }).where(eq(s.invoices.id, inv.id));
    const msg = status === "pending_second" ? `Invoice ${inv.number} approved (step 1) — over threshold, needs second approval` : `Invoice ${inv.number} ${input.decision}${input.note ? ` — ${input.note}` : ""}`;
    await log(context.lid, "invoice", inv.id, msg, context.user.name);
    if (inv.requestId) await log(context.lid, "maintenance", inv.requestId, msg, context.user.name);
    return { status };
  }),

  pay: landlordOnly.input(z.object({ id: z.number(), method: z.string(), paidAt: z.string().optional() })).handler(async ({ input, context }) => {
    const [inv] = await db.select().from(s.invoices).where(and(eq(s.invoices.id, input.id), eq(s.invoices.landlordId, context.lid)));
    if (!inv || inv.status !== "approved") throw new ORPCError("BAD_REQUEST", { message: "Only approved invoices can be paid" });
    const paidAt = input.paidAt || today();
    await db.update(s.invoices).set({ status: "paid", paidAt, paidMethod: input.method }).where(eq(s.invoices.id, inv.id));
    const [v] = await db.select().from(s.vendors).where(eq(s.vendors.id, inv.vendorId));
    await db.insert(s.transactions).values({ landlordId: context.lid, propertyId: inv.propertyId, date: paidAt, amount: inv.amount, type: "expense", category: inv.category, payee: v?.company || v?.name || "", description: `Invoice ${inv.number}${inv.description ? ` — ${inv.description}` : ""}`, source: "invoice", sourceId: inv.id });
    if (inv.attachmentKey) {
      await db.insert(s.documents).values({ landlordId: context.lid, propertyId: inv.propertyId, name: inv.attachmentName || `Invoice ${inv.number}`, category: "receipt", taxYear: Number(paidAt.slice(0, 4)), fileKey: inv.attachmentKey, uploadedBy: v?.name ?? "" });
    }
    await log(context.lid, "invoice", inv.id, `Invoice ${inv.number} paid via ${input.method}`, context.user.name);
    if (inv.requestId) {
      await log(context.lid, "maintenance", inv.requestId, `Invoice ${inv.number} paid`, context.user.name);
    }
    return { ok: true };
  }),
};
