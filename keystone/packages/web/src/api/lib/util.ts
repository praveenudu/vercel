import { eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { hasFeature, featureMinPlan, PLANS, type Feature, type PlanId } from "../../shared/plans";

export async function log(landlordId: string, entityType: string, entityId: number | null, message: string, actor = "") {
  await db.insert(s.activity).values({ landlordId, entityType, entityId, message, actor });
}

export function requireFeature(plan: string, f: Feature) {
  if (!hasFeature(plan, f)) {
    const min = featureMinPlan(f);
    throw new ORPCError("FORBIDDEN", { message: `This feature requires the ${PLANS[min as PlanId].name} plan. Upgrade in Plans & Billing.` });
  }
}

export const today = () => new Date().toISOString().slice(0, 10);

export function code(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function addMonths(period: string, n: number) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function dueDateFor(period: string, dueDay: number) {
  return `${period}-${String(Math.min(dueDay, 28)).padStart(2, "0")}`;
}

/** Generate monthly rent charges through the current month and apply late fees past grace. */
export async function syncCharges(leaseId: number, applyLateFees = true) {
  const [lease] = await db.select().from(s.leases).where(eq(s.leases.id, leaseId));
  if (!lease || lease.status !== "active") return;
  const existing = await db.select().from(s.rentCharges).where(eq(s.rentCharges.leaseId, leaseId));
  const have = new Set(existing.map((c) => `${c.type}:${c.period}`));
  const nowPeriod = today().slice(0, 7);
  const endPeriod = lease.endDate.slice(0, 7) < nowPeriod ? lease.endDate.slice(0, 7) : nowPeriod;
  const toInsert: (typeof s.rentCharges.$inferInsert)[] = [];
  if (lease.deposit > 0 && !have.has(`deposit:${lease.startDate.slice(0, 7)}`)) {
    toInsert.push({ landlordId: lease.landlordId, leaseId, period: lease.startDate.slice(0, 7), dueDate: lease.startDate, type: "deposit", amount: lease.deposit });
  }
  for (let p = lease.startDate.slice(0, 7); p <= endPeriod; p = addMonths(p, 1)) {
    if (!have.has(`rent:${p}`)) {
      toInsert.push({ landlordId: lease.landlordId, leaseId, period: p, dueDate: dueDateFor(p, lease.dueDay), type: "rent", amount: lease.rent });
    }
  }
  if (toInsert.length) await db.insert(s.rentCharges).values(toInsert);

  if (!applyLateFees || lease.lateFee <= 0) return;
  // Late fees: oldest-first allocation of confirmed payments against rent charges.
  const charges = (await db.select().from(s.rentCharges).where(eq(s.rentCharges.leaseId, leaseId))).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
  const paid = (
    await db.select().from(s.payments).where(eq(s.payments.leaseId, leaseId))
  ).filter((p) => p.status !== "rejected").reduce((t, p) => t + p.amount, 0);
  let remaining = paid;
  const lateHave = new Set(charges.filter((c) => c.type === "late_fee").map((c) => c.period));
  const t = today();
  const newFees: (typeof s.rentCharges.$inferInsert)[] = [];
  for (const c of charges) {
    const covered = Math.min(remaining, c.amount);
    remaining -= covered;
    if (c.type !== "rent") continue;
    const graceEnd = new Date(c.dueDate + "T00:00:00Z");
    graceEnd.setUTCDate(graceEnd.getUTCDate() + lease.graceDays);
    if (covered < c.amount && t > graceEnd.toISOString().slice(0, 10) && !lateHave.has(c.period)) {
      newFees.push({ landlordId: lease.landlordId, leaseId, period: c.period, dueDate: graceEnd.toISOString().slice(0, 10), type: "late_fee", amount: lease.lateFee });
    }
  }
  if (newFees.length) await db.insert(s.rentCharges).values(newFees);
}

export async function leaseBalances(leaseIds: number[]) {
  const out = new Map<number, { charged: number; paid: number; pending: number; balance: number }>();
  if (!leaseIds.length) return out;
  const charges = await db.select().from(s.rentCharges).where(inArray(s.rentCharges.leaseId, leaseIds));
  const pays = await db.select().from(s.payments).where(inArray(s.payments.leaseId, leaseIds));
  for (const id of leaseIds) {
    const charged = charges.filter((c) => c.leaseId === id).reduce((t, c) => t + c.amount, 0);
    const paid = pays.filter((p) => p.leaseId === id && p.status === "confirmed").reduce((t, p) => t + p.amount, 0);
    const pending = pays.filter((p) => p.leaseId === id && p.status === "reported").reduce((t, p) => t + p.amount, 0);
    out.set(id, { charged, paid, pending, balance: charged - paid });
  }
  return out;
}

export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
