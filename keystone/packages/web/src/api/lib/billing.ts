import { Autumn } from "autumn-js";
import { eq } from "drizzle-orm";
import { db } from "../database";
import * as s from "../database/schema";
import type { PlanId } from "../../shared/plans";

export type Cycle = "annual" | "monthly";

/** Autumn plan ids ↔ Keystone plan + billing cycle. */
export function autumnPlanId(plan: PlanId, cycle: Cycle) {
  if (plan === "essentials") return "essentials";
  return `${plan}_${cycle === "annual" ? "annual" : "monthly"}`;
}

export function fromAutumnPlanId(id: string): { plan: PlanId; cycle: Cycle } {
  if (id.startsWith("pro_")) return { plan: "pro", cycle: id.endsWith("annual") ? "annual" : "monthly" };
  if (id.startsWith("manage_")) return { plan: "manage", cycle: id.endsWith("annual") ? "annual" : "monthly" };
  return { plan: "essentials", cycle: "annual" };
}

/** Demo workspaces never touch real billing. */
export const isDemoEmail = (email: string) => email.toLowerCase().endsWith("@demo.keystone.app");

export const billingEnabled = () => !!process.env.AUTUMN_SECRET_KEY;

let client: Autumn | null = null;
export function autumn() {
  client ??= new Autumn();
  return client;
}

type Sub = { planId: string; status: string; canceledAt: number | null; currentPeriodEnd: number | null; startedAt: number };

export type BillingStatus = {
  plan: PlanId;
  cycle: Cycle;
  renewsAt: number | null;
  cancelsAt: number | null;
  scheduled: { plan: PlanId; cycle: Cycle; startsAt: number } | null;
};

function summarize(subs: Sub[]): BillingStatus {
  const ours = subs.filter((x) => x.planId === "essentials" || x.planId.includes("_"));
  const active = ours.find((x) => x.status === "active" && x.planId !== "essentials") ?? ours.find((x) => x.status === "active");
  const next = ours.find((x) => x.status === "scheduled");
  const cur = fromAutumnPlanId(active?.planId ?? "essentials");
  return {
    ...cur,
    renewsAt: active && active.planId !== "essentials" && !active.canceledAt ? active.currentPeriodEnd : null,
    cancelsAt: active && active.canceledAt ? active.currentPeriodEnd : null,
    scheduled: next ? { ...fromAutumnPlanId(next.planId), startsAt: next.startedAt } : null,
  };
}

const lastSync = new Map<string, number>();

/** Reads the subscription from Autumn and mirrors it onto profiles.plan so all feature gates stay server-side. */
export async function syncPlan(user: { id: string; name: string; email: string }, force = false): Promise<BillingStatus | null> {
  if (!billingEnabled() || isDemoEmail(user.email)) return null;
  if (!force && Date.now() - (lastSync.get(user.id) ?? 0) < 10 * 60_000) return null;
  lastSync.set(user.id, Date.now());
  try {
    const c = await autumn().customers.getOrCreate({ customerId: user.id, name: user.name, email: user.email });
    const st = summarize((c.subscriptions ?? []) as Sub[]);
    await db.update(s.profiles).set({ plan: st.plan, billingCycle: st.cycle }).where(eq(s.profiles.userId, user.id));
    return st;
  } catch (e) {
    // Fail open: keep the last known plan if Autumn is unreachable.
    console.error("[billing] sync failed", e);
    lastSync.delete(user.id);
    return null;
  }
}
