import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { landlordOnly, tenantOnly, withProfile } from "../middleware/auth";
import { clientIp, code, leaseBalances, log, requireFeature, syncCharges } from "../lib/util";
import { defaultClauses } from "../lib/lease-template";
import { appBase } from "../services/email";
import { emailLeaseExecuted, emailLeaseSent, emailTenantSigned } from "../services/notifications";

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const leaseInput = z.object({
  unitId: z.number(),
  applicationId: z.number().nullable().optional(),
  tenantName: z.string().min(1),
  tenantEmail: z.string().email(),
  startDate: z.string(),
  endDate: z.string(),
  rent: z.number().int().min(0),
  deposit: z.number().int().min(0),
  dueDay: z.number().int().min(1).max(28),
  lateFee: z.number().int().min(0),
  graceDays: z.number().int().min(0),
  clauses: z.string().optional(),
});

async function withDetails(rows: (typeof s.leases.$inferSelect)[]) {
  if (!rows.length) return [];
  const us = await db.select().from(s.units).where(inArray(s.units.id, rows.map((r) => r.unitId)));
  const props = us.length ? await db.select().from(s.properties).where(inArray(s.properties.id, us.map((u) => u.propertyId))) : [];
  const bal = await leaseBalances(rows.map((r) => r.id));
  return rows.map((l) => {
    const u = us.find((x) => x.id === l.unitId) ?? null;
    return { ...l, unit: u, property: props.find((p) => p.id === u?.propertyId) ?? null, balance: bal.get(l.id)! };
  });
}

async function existingTenant(lid: string, email: string) {
  const [t] = await db
    .select({ userId: s.profiles.userId })
    .from(s.profiles)
    .where(and(eq(s.profiles.landlordId, lid), eq(s.profiles.role, "tenant"), eq(s.profiles.email, email.trim().toLowerCase())));
  return t?.userId ?? null;
}

async function owned(id: number, lid: string) {
  const [l] = await db.select().from(s.leases).where(and(eq(s.leases.id, id), eq(s.leases.landlordId, lid)));
  if (!l) throw new ORPCError("NOT_FOUND");
  return l;
}

export const leases = {
  list: landlordOnly.handler(async ({ context }) => {
    const rows = await db.select().from(s.leases).where(eq(s.leases.landlordId, context.lid)).orderBy(desc(s.leases.createdAt));
    return withDetails(rows);
  }),

  get: withProfile.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const [l] = await db.select().from(s.leases).where(eq(s.leases.id, input.id));
    if (!l || l.landlordId !== context.lid) throw new ORPCError("NOT_FOUND");
    if (context.profile.role === "tenant" && l.tenantUserId !== context.user.id) throw new ORPCError("FORBIDDEN");
    if (!["tenant", "landlord"].includes(context.profile.role)) throw new ORPCError("FORBIDDEN");
    const [d] = await withDetails([l]);
    const [owner] = await db.select().from(s.profiles).where(eq(s.profiles.userId, l.landlordId));
    const timeline =
      context.profile.role === "landlord"
        ? await db.select().from(s.activity).where(and(eq(s.activity.landlordId, context.lid), eq(s.activity.entityType, "lease"), eq(s.activity.entityId, l.id))).orderBy(desc(s.activity.createdAt), desc(s.activity.id))
        : [];
    return { ...d, landlordName: owner?.name ?? "", timeline };
  }),

  draftDefaults: landlordOnly.input(z.object({ applicationId: z.number().optional(), unitId: z.number().optional() })).handler(async ({ input, context }) => {
    let unitId = input.unitId;
    let tenantName = "";
    let tenantEmail = "";
    let moveIn = "";
    if (input.applicationId) {
      const [a] = await db.select().from(s.applications).where(and(eq(s.applications.id, input.applicationId), eq(s.applications.landlordId, context.lid)));
      if (a) {
        unitId = a.unitId;
        tenantName = `${a.firstName} ${a.lastName}`;
        tenantEmail = a.email;
        moveIn = a.moveInDate;
      }
    }
    const [u] = unitId ? await db.select().from(s.units).where(eq(s.units.id, unitId)) : [];
    const [p] = u ? await db.select().from(s.properties).where(eq(s.properties.id, u.propertyId)) : [];
    const start = moveIn || new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const endD = new Date(start + "T00:00:00Z");
    endD.setUTCFullYear(endD.getUTCFullYear() + 1);
    endD.setUTCDate(endD.getUTCDate() - 1);
    return {
      unitId: u?.id ?? 0,
      tenantName,
      tenantEmail,
      startDate: start,
      endDate: endD.toISOString().slice(0, 10),
      rent: u?.rent ?? 0,
      deposit: u?.deposit ?? 0,
      dueDay: 1,
      lateFee: context.owner.defaultLateFee,
      graceDays: context.owner.defaultGraceDays,
      address: p ? `${p.address}, ${u?.name}, ${p.city}, ${p.state} ${p.zip}` : "",
    };
  }),

  create: landlordOnly.input(leaseInput).handler(async ({ input, context }) => {
    const [u] = await db.select().from(s.units).where(and(eq(s.units.id, input.unitId), eq(s.units.landlordId, context.lid)));
    if (!u) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });
    const [p] = await db.select().from(s.properties).where(eq(s.properties.id, u.propertyId));
    const clauses =
      input.clauses ||
      defaultClauses({ landlord: context.owner.name, tenant: input.tenantName, address: `${p.address}, ${u.name}, ${p.city}, ${p.state} ${p.zip}`, lateFee: money(input.lateFee), graceDays: input.graceDays, deposit: money(input.deposit) });
    const [l] = await db.insert(s.leases).values({ ...input, applicationId: input.applicationId ?? null, clauses, landlordId: context.lid, tenantUserId: await existingTenant(context.lid, input.tenantEmail), status: "draft" }).returning();
    await log(context.lid, "lease", l.id, `Lease drafted for ${l.tenantName} — ${u.name}`, context.user.name);
    if (l.applicationId) await log(context.lid, "application", l.applicationId, "Lease drafted", context.user.name);
    return l;
  }),

  update: landlordOnly.input(leaseInput.omit({ unitId: true, applicationId: true }).extend({ id: z.number() })).handler(async ({ input, context }) => {
    const l = await owned(input.id, context.lid);
    if (l.status !== "draft") throw new ORPCError("BAD_REQUEST", { message: "Only drafts can be edited" });
    const { id, ...rest } = input;
    await db.update(s.leases).set(rest).where(eq(s.leases.id, id));
    return { ok: true };
  }),

  send: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    requireFeature(context.plan, "esign");
    const l = await owned(input.id, context.lid);
    if (l.status !== "draft") throw new ORPCError("BAD_REQUEST", { message: "Lease already sent" });
    let inviteCode = l.inviteCode;
    const tenantUserId = l.tenantUserId ?? (await existingTenant(context.lid, l.tenantEmail));
    if (!tenantUserId && !inviteCode) {
      inviteCode = code(12);
      await db.insert(s.invites).values({ code: inviteCode, landlordId: context.lid, role: "tenant", name: l.tenantName, email: l.tenantEmail, leaseId: l.id });
    }
    await db.update(s.leases).set({ status: "sent", sentAt: new Date(), inviteCode, tenantUserId, signMethod: "esign" }).where(eq(s.leases.id, l.id));
    await log(context.lid, "lease", l.id, `Lease sent to ${l.tenantName} for e-signature`, context.user.name);
    await emailLeaseSent(appBase(context.headers), { ...l, status: "sent", inviteCode, tenantUserId });
    if (l.applicationId) await log(context.lid, "application", l.applicationId, "Lease sent for e-signature", context.user.name);
    return { inviteCode };
  }),

  tenantSign: tenantOnly
    .input(z.object({ id: z.number(), signature: z.string().min(2), signatureType: z.enum(["typed", "drawn"]), agree: z.literal(true) }))
    .handler(async ({ input, context }) => {
      const [l] = await db.select().from(s.leases).where(and(eq(s.leases.id, input.id), eq(s.leases.tenantUserId, context.user.id)));
      if (!l) throw new ORPCError("NOT_FOUND");
      if (l.status !== "sent") throw new ORPCError("BAD_REQUEST", { message: "Lease is not awaiting your signature" });
      await db
        .update(s.leases)
        .set({ status: "tenant_signed", tenantSignature: input.signature, tenantSignatureType: input.signatureType, tenantSignedAt: new Date(), tenantSignIp: clientIp(context.headers) })
        .where(eq(s.leases.id, l.id));
      await log(l.landlordId, "lease", l.id, `${l.tenantName} e-signed the lease`, l.tenantName);
      await emailTenantSigned(appBase(context.headers), l);
      return { ok: true };
    }),

  countersign: landlordOnly
    .input(z.object({ id: z.number(), signature: z.string().min(2), signatureType: z.enum(["typed", "drawn"]) }))
    .handler(async ({ input, context }) => {
      const l = await owned(input.id, context.lid);
      if (l.status !== "tenant_signed") throw new ORPCError("BAD_REQUEST", { message: "Waiting on tenant signature" });
      await db.update(s.leases).set({ status: "active", landlordSignature: input.signature, landlordSignatureType: input.signatureType, landlordSignedAt: new Date() }).where(eq(s.leases.id, l.id));
      await activate(l, context.lid, context.user.name);
      await emailLeaseExecuted(appBase(context.headers), { ...l, status: "active" });
      return { ok: true };
    }),

  /** Essentials path: mark as signed offline with an uploaded PDF. */
  markSignedOffline: landlordOnly.input(z.object({ id: z.number(), fileKey: z.string().optional(), fileName: z.string().optional() })).handler(async ({ input, context }) => {
    const l = await owned(input.id, context.lid);
    if (l.status === "active") throw new ORPCError("BAD_REQUEST", { message: "Already active" });
    let inviteCode = l.inviteCode;
    if (!l.tenantUserId && !inviteCode) {
      inviteCode = code(12);
      await db.insert(s.invites).values({ code: inviteCode, landlordId: context.lid, role: "tenant", name: l.tenantName, email: l.tenantEmail, leaseId: l.id });
    }
    await db.update(s.leases).set({ status: "active", signMethod: "upload", inviteCode, landlordSignedAt: new Date() }).where(eq(s.leases.id, l.id));
    if (input.fileKey) {
      const [u] = await db.select().from(s.units).where(eq(s.units.id, l.unitId));
      await db.insert(s.documents).values({ landlordId: context.lid, propertyId: u?.propertyId ?? null, leaseId: l.id, name: input.fileName || `Signed lease — ${l.tenantName}.pdf`, category: "lease", fileKey: input.fileKey, contentType: "application/pdf", uploadedBy: context.user.name });
    }
    await activate(l, context.lid, context.user.name);
    await emailLeaseExecuted(appBase(context.headers), { ...l, status: "active", signMethod: "upload", inviteCode });
    return { inviteCode };
  }),

  end: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const l = await owned(input.id, context.lid);
    await db.update(s.leases).set({ status: "ended" }).where(eq(s.leases.id, l.id));
    await db.update(s.units).set({ status: "vacant" }).where(eq(s.units.id, l.unitId));
    await log(context.lid, "lease", l.id, `Lease ended for ${l.tenantName}`, context.user.name);
    return { ok: true };
  }),

  remove: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const l = await owned(input.id, context.lid);
    if (l.status !== "draft") throw new ORPCError("BAD_REQUEST", { message: "Only drafts can be deleted" });
    await db.delete(s.leases).where(eq(s.leases.id, l.id));
    return { ok: true };
  }),

  mine: tenantOnly.handler(async ({ context }) => {
    const rows = await db.select().from(s.leases).where(eq(s.leases.tenantUserId, context.user.id)).orderBy(desc(s.leases.createdAt));
    for (const r of rows) await syncCharges(r.id, true);
    return withDetails(rows);
  }),
};

async function activate(l: typeof s.leases.$inferSelect, lid: string, actor: string) {
  await db.update(s.units).set({ status: "occupied" }).where(eq(s.units.id, l.unitId));
  await syncCharges(l.id, false);
  const [u] = await db.select().from(s.units).where(eq(s.units.id, l.unitId));
  if (l.signMethod !== "upload") {
    await db.insert(s.documents).values({ landlordId: lid, propertyId: u?.propertyId ?? null, leaseId: l.id, name: `Executed lease — ${l.tenantName} (${u?.name ?? ""})`, category: "lease", contentType: "lease/esign", uploadedBy: "Keystone e-sign", sharedWithCpa: false });
  }
  await log(lid, "lease", l.id, `Lease fully executed — now active. Rent schedule created.`, actor);
  if (l.applicationId) await log(lid, "application", l.applicationId, "Lease executed — tenant moved in", actor);
}
