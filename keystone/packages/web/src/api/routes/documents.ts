import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { booksAccess, landlordOnly, tenantOnly } from "../middleware/auth";
import { log } from "../lib/util";
import { presignGet } from "../lib/s3";

export const documents = {
  list: booksAccess.input(z.object({ taxYear: z.number().optional() }).optional()).handler(async ({ input, context }) => {
    let rows = await db.select().from(s.documents).where(eq(s.documents.landlordId, context.lid)).orderBy(desc(s.documents.createdAt));
    if (context.profile.role === "cpa") rows = rows.filter((r) => r.sharedWithCpa);
    if (input?.taxYear) rows = rows.filter((r) => r.taxYear === input.taxYear || (!r.taxYear && new Date(r.createdAt).getFullYear() === input.taxYear));
    const props = await db.select().from(s.properties).where(eq(s.properties.landlordId, context.lid));
    return rows.map((r) => ({ ...r, propertyName: props.find((p) => p.id === r.propertyId)?.name ?? "All properties" }));
  }),
  create: booksAccess
    .input(z.object({ name: z.string().min(1), category: z.string(), taxYear: z.number().nullable().optional(), propertyId: z.number().nullable().optional(), fileKey: z.string(), contentType: z.string().default(""), size: z.number().default(0), sharedWithCpa: z.boolean().default(true) }))
    .handler(async ({ input, context }) => {
      const [d] = await db.insert(s.documents).values({ ...input, taxYear: input.taxYear ?? null, propertyId: input.propertyId ?? null, landlordId: context.lid, uploadedBy: `${context.user.name}${context.profile.role === "cpa" ? " (CPA)" : ""}` }).returning();
      await log(context.lid, "document", d.id, `Uploaded ${d.name}`, context.user.name);
      return d;
    }),
  share: landlordOnly.input(z.object({ id: z.number(), sharedWithCpa: z.boolean() })).handler(async ({ input, context }) => {
    await db.update(s.documents).set({ sharedWithCpa: input.sharedWithCpa }).where(and(eq(s.documents.id, input.id), eq(s.documents.landlordId, context.lid)));
    return { ok: true };
  }),
  remove: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    await db.delete(s.documents).where(and(eq(s.documents.id, input.id), eq(s.documents.landlordId, context.lid)));
    return { ok: true };
  }),
  open: booksAccess.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const [d] = await db.select().from(s.documents).where(and(eq(s.documents.id, input.id), eq(s.documents.landlordId, context.lid)));
    if (!d) throw new ORPCError("NOT_FOUND");
    if (context.profile.role === "cpa" && !d.sharedWithCpa) throw new ORPCError("FORBIDDEN");
    if (!d.fileKey) return { url: d.leaseId ? `/leases/${d.leaseId}/print` : null };
    return { url: await presignGet(d.fileKey, d.name) };
  }),
  mine: tenantOnly.handler(async ({ context }) => {
    const ls = await db.select().from(s.leases).where(eq(s.leases.tenantUserId, context.user.id));
    const ids = new Set(ls.map((l) => l.id));
    const rows = await db.select().from(s.documents).where(eq(s.documents.landlordId, context.lid));
    return rows.filter((r) => r.leaseId && ids.has(r.leaseId));
  }),
};
