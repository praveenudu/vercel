import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { base } from "../__core/app";
import { auth } from "../auth";
import { db } from "../database";
import { profiles, portfolios } from "../database/schema";
import { syncPlan } from "../lib/billing";

export const withUser = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  return next({ context: { user: session?.user ?? null } });
});

export const authed = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { user: session.user } });
});

/** Loads (or creates) the caller's profile. New sign-ups become landlords of their own workspace. */
export const withProfile = authed.use(async ({ context, next }) => {
  const u = context.user;
  let [p] = await db.select().from(profiles).where(eq(profiles.userId, u.id));
  if (!p) {
    [p] = await db
      .insert(profiles)
      .values({ userId: u.id, role: "landlord", landlordId: u.id, name: u.name, email: u.email })
      .returning();
    await db.insert(portfolios).values({ landlordId: u.id, name: "My Portfolio" });
  }
  let [owner] = p.landlordId === p.userId ? [p] : await db.select().from(profiles).where(eq(profiles.userId, p.landlordId));
  if (!owner) owner = p;
  // Background refresh of the workspace owner's subscription (throttled; picks up renewals, cancellations, portal changes).
  void syncPlan({ id: owner.userId, name: owner.name, email: owner.email });
  return next({ context: { profile: p, lid: p.landlordId, plan: owner.plan, owner } });
});

export const landlordOnly = withProfile.use(async ({ context, next }) => {
  if (context.profile.role !== "landlord") throw new ORPCError("FORBIDDEN", { message: "Landlord access only" });
  return next();
});

export const tenantOnly = withProfile.use(async ({ context, next }) => {
  if (context.profile.role !== "tenant") throw new ORPCError("FORBIDDEN", { message: "Tenant access only" });
  return next();
});

export const vendorOnly = withProfile.use(async ({ context, next }) => {
  if (context.profile.role !== "vendor") throw new ORPCError("FORBIDDEN", { message: "Vendor access only" });
  return next();
});

/** Landlord or CPA (read access to books and tax docs). */
export const booksAccess = withProfile.use(async ({ context, next }) => {
  if (!["landlord", "cpa"].includes(context.profile.role)) throw new ORPCError("FORBIDDEN");
  return next();
});
