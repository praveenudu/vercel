import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { withProfile, landlordOnly, withUser } from "../middleware/auth";
import { log } from "../lib/util";

export const me = {
  get: withProfile.handler(async ({ context }) => {
    const ports = await db.select().from(s.portfolios).where(eq(s.portfolios.landlordId, context.lid));
    return {
      user: { id: context.user.id, name: context.user.name, email: context.user.email, image: context.user.image },
      profile: context.profile,
      plan: context.plan,
      ownerName: context.owner.name,
      portfolios: context.profile.role === "landlord" || context.profile.role === "cpa" ? ports : [],
    };
  }),

  updateSettings: landlordOnly
    .input(
      z.object({
        approvalThreshold: z.number().int().min(0).optional(),
        defaultLateFee: z.number().int().min(0).optional(),
        defaultGraceDays: z.number().int().min(0).max(31).optional(),
        remindersEnabled: z.boolean().optional(),
        reminderDays: z.number().int().min(0).max(14).optional(),
        notifyEmails: z.boolean().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      // Workspace settings live on the owner's profile (that's what context.owner reads).
      await db.update(s.profiles).set(input).where(eq(s.profiles.userId, context.lid));
      return { ok: true };
    }),

  /** Public: look up an invite before sign-in. */
  invite: withUser.input(z.object({ code: z.string() })).handler(async ({ input }) => {
    const [inv] = await db.select().from(s.invites).where(eq(s.invites.code, input.code));
    if (!inv) throw new ORPCError("NOT_FOUND", { message: "Invite not found" });
    const [owner] = await db.select().from(s.profiles).where(eq(s.profiles.userId, inv.landlordId));
    return { role: inv.role, name: inv.name, email: inv.email, landlordName: owner?.name ?? "Your landlord", accepted: !!inv.acceptedBy };
  }),

  acceptInvite: withProfile.input(z.object({ code: z.string() })).handler(async ({ input, context }) => {
    const [inv] = await db.select().from(s.invites).where(and(eq(s.invites.code, input.code), isNull(s.invites.acceptedBy)));
    if (!inv) throw new ORPCError("NOT_FOUND", { message: "Invite is invalid or already used" });
    if (context.profile.role === "landlord" && context.profile.landlordId === context.user.id) {
      // switching a fresh landlord workspace into an invited role — only allow if it has no properties
      const props = await db.select().from(s.properties).where(eq(s.properties.landlordId, context.user.id));
      if (props.length) throw new ORPCError("BAD_REQUEST", { message: "This account already manages properties. Sign in with a different account to accept this invite." });
    }
    await db.update(s.profiles).set({ role: inv.role, landlordId: inv.landlordId }).where(eq(s.profiles.userId, context.user.id));
    await db.update(s.invites).set({ acceptedBy: context.user.id, acceptedAt: new Date() }).where(eq(s.invites.id, inv.id));
    if (inv.role === "vendor" && inv.vendorId) await db.update(s.vendors).set({ userId: context.user.id }).where(eq(s.vendors.id, inv.vendorId));
    if (inv.role === "tenant" && inv.leaseId) await db.update(s.leases).set({ tenantUserId: context.user.id }).where(eq(s.leases.id, inv.leaseId));
    await log(inv.landlordId, "user", null, `${context.user.name} joined as ${inv.role}`, context.user.name);
    return { role: inv.role };
  }),
};
