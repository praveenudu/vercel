import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { landlordOnly, withProfile } from "../middleware/auth";
import { log } from "../lib/util";
import { appBase } from "../services/email";
import { emailNewRequest, emailWorkOrder } from "../services/notifications";

async function vendorFor(userId: string) {
  const [v] = await db.select().from(s.vendors).where(eq(s.vendors.userId, userId));
  return v ?? null;
}

async function enrich(rows: (typeof s.maintenanceRequests.$inferSelect)[], lid: string) {
  const us = await db.select().from(s.units).where(eq(s.units.landlordId, lid));
  const props = await db.select().from(s.properties).where(eq(s.properties.landlordId, lid));
  const vs = await db.select().from(s.vendors).where(eq(s.vendors.landlordId, lid));
  const ls = await db.select().from(s.leases).where(eq(s.leases.landlordId, lid));
  const invs = rows.length ? await db.select().from(s.invoices).where(inArray(s.invoices.requestId, rows.map((r) => r.id))) : [];
  return rows.map((r) => {
    const u = us.find((x) => x.id === r.unitId);
    return {
      ...r,
      photos: JSON.parse(r.photosJson) as { key: string; name: string }[],
      unit: u ?? null,
      property: props.find((p) => p.id === u?.propertyId) ?? null,
      vendor: vs.find((v) => v.id === r.vendorId) ?? null,
      tenantName: ls.find((l) => l.id === r.leaseId)?.tenantName ?? null,
      invoices: invs.filter((i) => i.requestId === r.id),
    };
  });
}

export const maintenance = {
  list: withProfile.handler(async ({ context }) => {
    const role = context.profile.role;
    let rows = await db.select().from(s.maintenanceRequests).where(eq(s.maintenanceRequests.landlordId, context.lid)).orderBy(desc(s.maintenanceRequests.createdAt));
    if (role === "tenant") {
      const ls = await db.select().from(s.leases).where(eq(s.leases.tenantUserId, context.user.id));
      const ids = new Set(ls.map((l) => l.id));
      rows = rows.filter((r) => r.leaseId && ids.has(r.leaseId));
    } else if (role === "vendor") {
      const v = await vendorFor(context.user.id);
      rows = v ? rows.filter((r) => r.vendorId === v.id) : [];
    } else if (role !== "landlord") throw new ORPCError("FORBIDDEN");
    return enrich(rows, context.lid);
  }),

  get: withProfile.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const [r] = await db.select().from(s.maintenanceRequests).where(and(eq(s.maintenanceRequests.id, input.id), eq(s.maintenanceRequests.landlordId, context.lid)));
    if (!r) throw new ORPCError("NOT_FOUND");
    if (context.profile.role === "vendor") {
      const v = await vendorFor(context.user.id);
      if (!v || r.vendorId !== v.id) throw new ORPCError("FORBIDDEN");
    }
    const [e] = await enrich([r], context.lid);
    const timeline = await db
      .select()
      .from(s.activity)
      .where(and(eq(s.activity.landlordId, context.lid), eq(s.activity.entityType, "maintenance"), eq(s.activity.entityId, r.id)))
      .orderBy(s.activity.createdAt);
    return { ...e, timeline };
  }),

  create: withProfile
    .input(z.object({ unitId: z.number().optional(), title: z.string().min(2), description: z.string().default(""), category: z.string().default("general"), priority: z.enum(["low", "normal", "high", "emergency"]).default("normal"), entryPermission: z.boolean().default(true), photos: z.array(z.object({ key: z.string(), name: z.string() })).default([]) }))
    .handler(async ({ input, context }) => {
      let unitId = input.unitId;
      let leaseId: number | null = null;
      if (context.profile.role === "tenant") {
        const [l] = await db.select().from(s.leases).where(and(eq(s.leases.tenantUserId, context.user.id), eq(s.leases.status, "active")));
        if (!l) throw new ORPCError("BAD_REQUEST", { message: "You need an active lease to submit requests" });
        unitId = l.unitId;
        leaseId = l.id;
      } else if (context.profile.role === "landlord") {
        if (!unitId) throw new ORPCError("BAD_REQUEST", { message: "Choose a unit" });
        const [l] = await db.select().from(s.leases).where(and(eq(s.leases.unitId, unitId), eq(s.leases.status, "active")));
        leaseId = l?.id ?? null;
      } else throw new ORPCError("FORBIDDEN");
      const { photos, ...rest } = input;
      const [r] = await db
        .insert(s.maintenanceRequests)
        .values({ ...rest, unitId: unitId!, leaseId, photosJson: JSON.stringify(photos), landlordId: context.lid, submittedBy: context.user.name, submittedByRole: context.profile.role })
        .returning();
      await log(context.lid, "maintenance", r.id, `Request submitted: ${r.title} (${r.priority})`, context.user.name);
      if (context.profile.role === "tenant") await emailNewRequest(appBase(context.headers), r);
      return r;
    }),

  assign: landlordOnly.input(z.object({ id: z.number(), vendorId: z.number(), scheduledFor: z.string().optional() })).handler(async ({ input, context }) => {
    const [v] = await db.select().from(s.vendors).where(and(eq(s.vendors.id, input.vendorId), eq(s.vendors.landlordId, context.lid)));
    if (!v) throw new ORPCError("NOT_FOUND", { message: "Vendor not found" });
    await db
      .update(s.maintenanceRequests)
      .set({ vendorId: v.id, status: input.scheduledFor ? "scheduled" : "assigned", scheduledFor: input.scheduledFor ?? null })
      .where(and(eq(s.maintenanceRequests.id, input.id), eq(s.maintenanceRequests.landlordId, context.lid)));
    await log(context.lid, "maintenance", input.id, `Work order assigned to ${v.company || v.name}${input.scheduledFor ? ` for ${input.scheduledFor}` : ""}`, context.user.name);
    await emailWorkOrder(appBase(context.headers), v, input.id);
    return { ok: true };
  }),

  updateStatus: withProfile
    .input(z.object({ id: z.number(), status: z.enum(["new", "assigned", "scheduled", "in_progress", "completed", "closed"]), scheduledFor: z.string().optional(), vendorNotes: z.string().optional() }))
    .handler(async ({ input, context }) => {
      const [r] = await db.select().from(s.maintenanceRequests).where(and(eq(s.maintenanceRequests.id, input.id), eq(s.maintenanceRequests.landlordId, context.lid)));
      if (!r) throw new ORPCError("NOT_FOUND");
      if (context.profile.role === "vendor") {
        const v = await vendorFor(context.user.id);
        if (!v || r.vendorId !== v.id) throw new ORPCError("FORBIDDEN");
        if (input.status === "closed") throw new ORPCError("FORBIDDEN", { message: "Only the landlord can close requests" });
      } else if (context.profile.role !== "landlord") throw new ORPCError("FORBIDDEN");
      await db
        .update(s.maintenanceRequests)
        .set({
          status: input.status,
          ...(input.scheduledFor !== undefined ? { scheduledFor: input.scheduledFor } : {}),
          ...(input.vendorNotes !== undefined ? { vendorNotes: input.vendorNotes } : {}),
          ...(input.status === "completed" ? { completedAt: new Date() } : {}),
        })
        .where(eq(s.maintenanceRequests.id, r.id));
      await log(context.lid, "maintenance", r.id, `Status → ${input.status.replace("_", " ")}${input.vendorNotes ? ` — ${input.vendorNotes}` : ""}`, context.user.name);
      return { ok: true };
    }),
};

const vendorInput = z.object({ name: z.string().min(1), company: z.string().default(""), trade: z.string().default("general"), email: z.string().default(""), phone: z.string().default(""), taxIdLast4: z.string().max(4).default(""), w9OnFile: z.boolean().default(false) });

export const vendors = {
  list: landlordOnly.handler(async ({ context }) => {
    const vs = await db.select().from(s.vendors).where(eq(s.vendors.landlordId, context.lid));
    const paid = await db.select().from(s.invoices).where(and(eq(s.invoices.landlordId, context.lid), eq(s.invoices.status, "paid")));
    const year = String(new Date().getFullYear());
    return vs.map((v) => ({ ...v, ytdPaid: paid.filter((i) => i.vendorId === v.id && (i.paidAt ?? "").startsWith(year)).reduce((t, i) => t + i.amount, 0) }));
  }),
  create: landlordOnly.input(vendorInput).handler(async ({ input, context }) => {
    const [v] = await db.insert(s.vendors).values({ ...input, landlordId: context.lid }).returning();
    return v;
  }),
  update: landlordOnly.input(vendorInput.extend({ id: z.number() })).handler(async ({ input, context }) => {
    const { id, ...rest } = input;
    await db.update(s.vendors).set(rest).where(and(eq(s.vendors.id, id), eq(s.vendors.landlordId, context.lid)));
    return { ok: true };
  }),
  me: withProfile.handler(async ({ context }) => vendorFor(context.user.id)),
};
