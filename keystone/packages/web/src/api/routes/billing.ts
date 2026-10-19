import { z } from "zod";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { landlordOnly } from "../middleware/auth";
import { log } from "../lib/util";
import { autumn, autumnPlanId, billingEnabled, isDemoEmail, syncPlan } from "../lib/billing";
import { PLANS } from "../../shared/plans";

// Return to the domain the user is actually on (preview, published or custom), falling back to WEBSITE_URL.
const appUrl = (headers: Headers, path: string) => {
  const origin = headers.get("origin");
  const base = origin && /^https?:\/\/[^/]+$/.test(origin) ? origin : process.env.WEBSITE_URL || "";
  return `${base.replace(/\/$/, "")}${path}`;
};

/** Only the workspace owner manages the subscription; co-managers see it read-only. */
const ownerOnly = landlordOnly.use(async ({ context, next }) => {
  if (context.profile.userId !== context.profile.landlordId) throw new ORPCError("FORBIDDEN", { message: "Only the workspace owner can change billing." });
  return next();
});

const isDemo = (email: string) => isDemoEmail(email) || !billingEnabled();

export const billing = {
  status: landlordOnly.handler(async ({ context }) => {
    const o = context.owner;
    const demo = isDemo(o.email);
    const st = demo ? null : await syncPlan({ id: o.userId, name: o.name, email: o.email }, true);
    return {
      mode: demo ? ("demo" as const) : ("live" as const),
      isOwner: context.profile.userId === context.profile.landlordId,
      plan: st?.plan ?? (o.plan as keyof typeof PLANS),
      cycle: st?.cycle ?? (o.billingCycle as "annual" | "monthly"),
      renewsAt: st?.renewsAt ?? null,
      cancelsAt: st?.cancelsAt ?? null,
      scheduled: st?.scheduled ?? null,
    };
  }),

  /** Starts Stripe Checkout (new paid plan) or applies the change directly (switches, downgrades). */
  checkout: ownerOnly
    .input(z.object({ plan: z.enum(["essentials", "manage", "pro"]), cycle: z.enum(["annual", "monthly"]) }))
    .handler(async ({ input, context }) => {
      const u = context.user;
      if (isDemo(u.email)) {
        await db.update(s.profiles).set({ plan: input.plan, billingCycle: input.cycle }).where(eq(s.profiles.userId, u.id));
        await log(context.lid, "plan", null, `Plan changed to ${PLANS[input.plan].name} (${input.cycle}) — demo billing`, u.name);
        return { url: null as string | null, applied: true };
      }
      await autumn().customers.getOrCreate({ customerId: u.id, name: u.name, email: u.email });
      const r = await autumn().billing.attach({
        customerId: u.id,
        planId: autumnPlanId(input.plan, input.cycle),
        successUrl: appUrl(context.headers, "/billing?checkout=success"),
      });
      if (!r.paymentUrl) {
        await syncPlan(u, true);
        await log(context.lid, "plan", null, `Plan change to ${PLANS[input.plan].name} (${input.cycle}) requested`, u.name);
      }
      return { url: r.paymentUrl, applied: !r.paymentUrl };
    }),

  /** Stripe billing portal: card, invoices, cancellation. */
  portal: ownerOnly.handler(async ({ context }) => {
    if (isDemo(context.user.email)) throw new ORPCError("BAD_REQUEST", { message: "The demo workspace has no billing account." });
    const r = await autumn().billing.openCustomerPortal({ customerId: context.user.id, returnUrl: appUrl(context.headers, "/billing") });
    return { url: r.url };
  }),

  /** Called after returning from checkout. */
  sync: landlordOnly.handler(async ({ context }) => {
    const o = context.owner;
    const st = await syncPlan({ id: o.userId, name: o.name, email: o.email }, true);
    if (st && st.plan !== "essentials") await log(context.lid, "plan", null, `Subscribed to ${PLANS[st.plan].name} (${st.cycle})`, context.user.name);
    return { plan: st?.plan ?? o.plan };
  }),
};
