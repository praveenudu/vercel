import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { landlordOnly, tenantOnly, withProfile } from "../middleware/auth";
import { leaseBalances, log, syncCharges, today } from "../lib/util";
import { hasFeature } from "../../shared/plans";
import { appBase } from "../services/email";
import { emailPaymentReported, emailReceipt } from "../services/notifications";
import { runReminders } from "../services/reminders";

async function balanceOf(leaseId: number) {
  return (await leaseBalances([leaseId])).get(leaseId)?.balance ?? 0;
}

async function incomeTx(p: typeof s.payments.$inferSelect) {
  const [l] = await db.select().from(s.leases).where(eq(s.leases.id, p.leaseId));
  const [u] = l ? await db.select().from(s.units).where(eq(s.units.id, l.unitId)) : [];
  await db.insert(s.transactions).values({
    landlordId: p.landlordId,
    propertyId: u?.propertyId ?? null,
    date: p.paidAt,
    amount: p.amount,
    type: "income",
    category: "rents",
    payee: l?.tenantName ?? "",
    description: `Rent payment (${p.method}${p.reference ? ` · ${p.reference}` : ""}) — ${u?.name ?? ""}`,
    source: "rent",
    sourceId: p.id,
  });
}

export const rent = {
  roll: landlordOnly.handler(async ({ context }) => {
    const active = await db.select().from(s.leases).where(and(eq(s.leases.landlordId, context.lid), eq(s.leases.status, "active")));
    const lateFees = hasFeature(context.plan, "late_fees");
    for (const l of active) await syncCharges(l.id, lateFees);
    const bal = await leaseBalances(active.map((l) => l.id));
    const us = active.length ? await db.select().from(s.units).where(inArray(s.units.id, active.map((l) => l.unitId))) : [];
    const props = await db.select().from(s.properties).where(eq(s.properties.landlordId, context.lid));
    const pays = await db.select().from(s.payments).where(eq(s.payments.landlordId, context.lid)).orderBy(desc(s.payments.createdAt));
    const period = today().slice(0, 7);
    const charges = active.length ? await db.select().from(s.rentCharges).where(inArray(s.rentCharges.leaseId, active.map((l) => l.id))) : [];
    const rows = active.map((l) => {
      const u = us.find((x) => x.id === l.unitId);
      const b = bal.get(l.id)!;
      const thisMonth = charges.filter((c) => c.leaseId === l.id && c.period === period && c.type === "rent").reduce((t, c) => t + c.amount, 0);
      return { lease: l, unit: u ?? null, property: props.find((p) => p.id === u?.propertyId) ?? null, ...b, thisMonth, status: b.balance <= 0 ? "paid" : b.pending >= b.balance ? "pending" : b.balance > thisMonth ? "overdue" : "due" };
    });
    const allLeases = await db.select().from(s.leases).where(eq(s.leases.landlordId, context.lid));
    const payments = pays.map((p) => ({ ...p, lease: allLeases.find((l) => l.id === p.leaseId) ?? null }));
    return {
      rows,
      payments,
      totals: {
        expected: rows.reduce((t, r) => t + r.thisMonth, 0),
        outstanding: rows.reduce((t, r) => t + Math.max(0, r.balance), 0),
        pending: payments.filter((p) => p.status === "reported").reduce((t, p) => t + p.amount, 0),
        collectedThisMonth: payments.filter((p) => p.status === "confirmed" && p.paidAt.startsWith(period)).reduce((t, p) => t + p.amount, 0),
      },
    };
  }),

  ledger: withProfile.input(z.object({ leaseId: z.number() })).handler(async ({ input, context }) => {
    const [l] = await db.select().from(s.leases).where(eq(s.leases.id, input.leaseId));
    if (!l || l.landlordId !== context.lid) throw new ORPCError("NOT_FOUND");
    if (context.profile.role === "tenant" && l.tenantUserId !== context.user.id) throw new ORPCError("FORBIDDEN");
    if (context.profile.role === "vendor") throw new ORPCError("FORBIDDEN");
    const charges = await db.select().from(s.rentCharges).where(eq(s.rentCharges.leaseId, l.id));
    const pays = await db.select().from(s.payments).where(eq(s.payments.leaseId, l.id));
    const entries = [
      ...charges.map((c) => ({ kind: "charge" as const, id: c.id, date: c.dueDate, label: c.type === "rent" ? `Rent — ${c.period}` : c.type === "late_fee" ? `Late fee — ${c.period}` : "Security deposit", amount: c.amount, status: "posted" })),
      ...pays.map((p) => ({ kind: "payment" as const, id: p.id, date: p.paidAt, label: `Payment · ${p.method.toUpperCase()}${p.reference ? ` · ${p.reference}` : ""}`, amount: p.amount, status: p.status })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "charge" ? -1 : 1));
    let running = 0;
    const withBal = entries.map((e) => {
      if (e.kind === "charge") running += e.amount;
      else if (e.status === "confirmed") running -= e.amount;
      return { ...e, balance: running };
    });
    return { lease: l, entries: withBal, balance: running };
  }),

  record: landlordOnly
    .input(z.object({ leaseId: z.number(), amount: z.number().int().positive(), method: z.enum(["zelle", "check", "cash", "ach", "other"]), reference: z.string().default(""), paidAt: z.string(), note: z.string().default("") }))
    .handler(async ({ input, context }) => {
      const [l] = await db.select().from(s.leases).where(and(eq(s.leases.id, input.leaseId), eq(s.leases.landlordId, context.lid)));
      if (!l) throw new ORPCError("NOT_FOUND");
      const [p] = await db.insert(s.payments).values({ ...input, landlordId: context.lid, status: "confirmed", reportedBy: "landlord" }).returning();
      await incomeTx(p);
      await log(context.lid, "payment", p.id, `Recorded $${(p.amount / 100).toFixed(2)} ${p.method} payment from ${l.tenantName}`, context.user.name);
      await emailReceipt(appBase(context.headers), p, await balanceOf(l.id));
      return p;
    }),

  report: tenantOnly
    .input(z.object({ leaseId: z.number(), amount: z.number().int().positive(), method: z.enum(["zelle", "check", "cash", "ach", "other"]), reference: z.string().default(""), paidAt: z.string(), note: z.string().default("") }))
    .handler(async ({ input, context }) => {
      const [l] = await db.select().from(s.leases).where(and(eq(s.leases.id, input.leaseId), eq(s.leases.tenantUserId, context.user.id)));
      if (!l) throw new ORPCError("NOT_FOUND");
      const [p] = await db.insert(s.payments).values({ ...input, landlordId: l.landlordId, status: "reported", reportedBy: "tenant" }).returning();
      await log(l.landlordId, "payment", p.id, `${l.tenantName} reported a $${(p.amount / 100).toFixed(2)} ${p.method} payment — needs confirmation`, l.tenantName);
      await emailPaymentReported(appBase(context.headers), p, l);
      return p;
    }),

  review: landlordOnly.input(z.object({ id: z.number(), decision: z.enum(["confirmed", "rejected"]) })).handler(async ({ input, context }) => {
    const [p] = await db.select().from(s.payments).where(and(eq(s.payments.id, input.id), eq(s.payments.landlordId, context.lid)));
    if (!p || p.status !== "reported") throw new ORPCError("BAD_REQUEST", { message: "Payment is not pending" });
    await db.update(s.payments).set({ status: input.decision }).where(eq(s.payments.id, p.id));
    if (input.decision === "confirmed") {
      await incomeTx({ ...p, status: "confirmed" });
      await emailReceipt(appBase(context.headers), { ...p, status: "confirmed" }, await balanceOf(p.leaseId));
    }
    await log(context.lid, "payment", p.id, `Payment ${input.decision}`, context.user.name);
    return { ok: true };
  }),

  /** "Send reminders now" — runs this workspace's reminder + overdue pass immediately. */
  sendReminders: landlordOnly.handler(async ({ context }) => runReminders({ landlordId: context.lid, manual: true, base: appBase(context.headers) })),

  myPayments: tenantOnly.handler(async ({ context }) => {
    const ls = await db.select().from(s.leases).where(eq(s.leases.tenantUserId, context.user.id));
    if (!ls.length) return [];
    return db.select().from(s.payments).where(inArray(s.payments.leaseId, ls.map((l) => l.id))).orderBy(desc(s.payments.createdAt));
  }),
};
