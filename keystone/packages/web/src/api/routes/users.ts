import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { landlordOnly } from "../middleware/auth";
import { code, log, requireFeature } from "../lib/util";
import { appBase } from "../services/email";
import { emailInvite } from "../services/notifications";

export const users = {
  list: landlordOnly.handler(async ({ context }) => {
    const members = await db.select().from(s.profiles).where(eq(s.profiles.landlordId, context.lid));
    const invites = await db.select().from(s.invites).where(eq(s.invites.landlordId, context.lid)).orderBy(desc(s.invites.createdAt));
    return { members, invites };
  }),
  invite: landlordOnly
    .input(z.object({ role: z.enum(["tenant", "vendor", "cpa"]), name: z.string().min(1), email: z.string().email(), vendorId: z.number().optional(), leaseId: z.number().optional() }))
    .handler(async ({ input, context }) => {
      if (input.role === "cpa") requireFeature(context.plan, "cpa");
      const [inv] = await db.insert(s.invites).values({ ...input, landlordId: context.lid, code: code(12) }).returning();
      await log(context.lid, "user", null, `Invited ${input.name} as ${input.role}`, context.user.name);
      await emailInvite(appBase(context.headers), inv);
      return inv;
    }),
  revokeInvite: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    await db.delete(s.invites).where(and(eq(s.invites.id, input.id), eq(s.invites.landlordId, context.lid)));
    return { ok: true };
  }),
  remove: landlordOnly.input(z.object({ userId: z.string() })).handler(async ({ input, context }) => {
    if (input.userId === context.user.id) throw new ORPCError("BAD_REQUEST", { message: "You can't remove yourself" });
    // detach: they become a landlord of an empty workspace of their own
    await db.update(s.profiles).set({ role: "landlord", landlordId: input.userId }).where(and(eq(s.profiles.userId, input.userId), eq(s.profiles.landlordId, context.lid)));
    return { ok: true };
  }),
};
