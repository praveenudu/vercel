import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { db } from "../database";
import * as s from "../database/schema";
import { landlordOnly } from "../middleware/auth";
import { log } from "../lib/util";
import { runProviderScreening, scoreApplication } from "../lib/screening";
import { appBase } from "../services/email";
import { emailNewApplication } from "../services/notifications";

const applyInput = z.object({
  unitId: z.number(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().default(""),
  dob: z.string().default(""),
  currentAddress: z.string().default(""),
  monthsAtAddress: z.number().int().default(0),
  employer: z.string().default(""),
  jobTitle: z.string().default(""),
  monthlyIncome: z.number().int().default(0),
  employmentMonths: z.number().int().default(0),
  prevLandlord: z.string().default(""),
  prevLandlordPhone: z.string().default(""),
  priorEviction: z.boolean().default(false),
  occupants: z.number().int().default(1),
  pets: z.string().default(""),
  references: z.array(z.object({ name: z.string(), phone: z.string(), relation: z.string() })).default([]),
  moveInDate: z.string().default(""),
  consent: z.literal(true),
  consentSignature: z.string().min(2),
});

async function getOwned(id: number, lid: string) {
  const [a] = await db.select().from(s.applications).where(and(eq(s.applications.id, id), eq(s.applications.landlordId, lid)));
  if (!a) throw new ORPCError("NOT_FOUND");
  return a;
}

export const applications = {
  /** Public — applicants submit without an account. */
  submit: base.input(applyInput).handler(async ({ input, context }) => {
    const [u] = await db.select().from(s.units).where(eq(s.units.id, input.unitId));
    if (!u || u.status !== "listed") throw new ORPCError("BAD_REQUEST", { message: "This unit is not accepting applications" });
    const { references, ...rest } = input;
    const [a] = await db
      .insert(s.applications)
      .values({ ...rest, referencesJson: JSON.stringify(references), landlordId: u.landlordId, status: "submitted" })
      .returning();
    await log(u.landlordId, "application", a.id, `New application from ${a.firstName} ${a.lastName} for ${u.name}`, `${a.firstName} ${a.lastName}`);
    await emailNewApplication(appBase(context.headers), a, u);
    return { id: a.id };
  }),

  list: landlordOnly.handler(async ({ context }) => {
    const apps = await db.select().from(s.applications).where(eq(s.applications.landlordId, context.lid)).orderBy(desc(s.applications.createdAt));
    const us = await db.select().from(s.units).where(eq(s.units.landlordId, context.lid));
    const props = await db.select().from(s.properties).where(eq(s.properties.landlordId, context.lid));
    return apps.map((a) => {
      const u = us.find((x) => x.id === a.unitId);
      return { ...a, unit: u ?? null, property: props.find((p) => p.id === u?.propertyId) ?? null };
    });
  }),

  get: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const a = await getOwned(input.id, context.lid);
    const [u] = await db.select().from(s.units).where(eq(s.units.id, a.unitId));
    const [p] = u ? await db.select().from(s.properties).where(eq(s.properties.id, u.propertyId)) : [];
    const [report] = await db.select().from(s.screeningReports).where(eq(s.screeningReports.applicationId, a.id)).orderBy(desc(s.screeningReports.createdAt));
    const [lease] = await db.select().from(s.leases).where(eq(s.leases.applicationId, a.id));
    const timeline = await db
      .select()
      .from(s.activity)
      .where(and(eq(s.activity.landlordId, context.lid), eq(s.activity.entityType, "application"), eq(s.activity.entityId, a.id)))
      .orderBy(s.activity.createdAt);
    return { ...a, references: JSON.parse(a.referencesJson) as { name: string; phone: string; relation: string }[], unit: u ?? null, property: p ?? null, report: report ? { ...report, breakdown: JSON.parse(report.breakdownJson) } : null, lease: lease ?? null, timeline };
  }),

  runScreening: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const a = await getOwned(input.id, context.lid);
    const [u] = await db.select().from(s.units).where(eq(s.units.id, a.unitId));
    await db.update(s.applications).set({ status: "screening" }).where(eq(s.applications.id, a.id));
    const rep = runProviderScreening(a);
    const sc = scoreApplication(a, u?.rent ?? 0, rep);
    await db.insert(s.screeningReports).values({ applicationId: a.id, ...rep, riskLevel: sc.riskLevel, breakdownJson: JSON.stringify({ parts: sc.parts, ratio: sc.ratio }) });
    await db.update(s.applications).set({ status: "review", score: sc.score, recommendation: sc.recommendation }).where(eq(s.applications.id, a.id));
    await log(context.lid, "application", a.id, `Screening completed — score ${sc.score}/100 (${sc.recommendation})`, "TransUnion SmartMove (sandbox)");
    return { score: sc.score };
  }),

  decide: landlordOnly
    .input(z.object({ id: z.number(), decision: z.enum(["approved", "rejected", "info_requested"]), notes: z.string().default("") }))
    .handler(async ({ input, context }) => {
      const a = await getOwned(input.id, context.lid);
      await db
        .update(s.applications)
        .set({ status: input.decision, notes: input.notes || a.notes, decidedAt: new Date() })
        .where(eq(s.applications.id, a.id));
      const label = input.decision === "approved" ? "Approved" : input.decision === "rejected" ? "Rejected" : "Requested more information";
      await log(context.lid, "application", a.id, `${label}${input.notes ? ` — ${input.notes}` : ""}`, context.user.name);
      return { ok: true };
    }),
};
