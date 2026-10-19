import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { db } from "../database";
import * as s from "../database/schema";
import { landlordOnly, booksAccess } from "../middleware/auth";
import { log } from "../lib/util";
import { PLANS, type PlanId } from "../../shared/plans";

const propInput = z.object({
  name: z.string().min(1),
  address: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  zip: z.string().default(""),
  type: z.string().default("single_family"),
  portfolioId: z.number().nullable().optional(),
  purchasePrice: z.number().int().default(0),
  currentValue: z.number().int().default(0),
});

const unitInput = z.object({
  propertyId: z.number(),
  name: z.string().min(1),
  beds: z.number().int().default(1),
  baths: z.number().default(1),
  sqft: z.number().int().default(0),
  rent: z.number().int().default(0),
  deposit: z.number().int().default(0),
});

export const portfolios = {
  create: landlordOnly.input(z.object({ name: z.string().min(1) })).handler(async ({ input, context }) => {
    const existing = await db.select().from(s.portfolios).where(eq(s.portfolios.landlordId, context.lid));
    const max = PLANS[context.plan as PlanId].maxPortfolios;
    if (existing.length >= max)
      throw new ORPCError("FORBIDDEN", { message: `Your ${PLANS[context.plan as PlanId].name} plan includes ${max} portfolio. Upgrade to Pro for unlimited portfolios.` });
    const [p] = await db.insert(s.portfolios).values({ landlordId: context.lid, name: input.name }).returning();
    return p;
  }),
  rename: landlordOnly.input(z.object({ id: z.number(), name: z.string().min(1) })).handler(async ({ input, context }) => {
    await db.update(s.portfolios).set({ name: input.name }).where(and(eq(s.portfolios.id, input.id), eq(s.portfolios.landlordId, context.lid)));
    return { ok: true };
  }),
};

export const properties = {
  list: booksAccess.input(z.object({ portfolioId: z.number().nullable().optional() }).optional()).handler(async ({ input, context }) => {
    let props = await db.select().from(s.properties).where(eq(s.properties.landlordId, context.lid));
    if (input?.portfolioId) props = props.filter((p) => p.portfolioId === input.portfolioId);
    const ids = props.map((p) => p.id);
    const us = ids.length ? await db.select().from(s.units).where(inArray(s.units.propertyId, ids)) : [];
    return props.map((p) => ({ ...p, units: us.filter((u) => u.propertyId === p.id) }));
  }),
  get: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const [p] = await db.select().from(s.properties).where(and(eq(s.properties.id, input.id), eq(s.properties.landlordId, context.lid)));
    if (!p) throw new ORPCError("NOT_FOUND");
    const us = await db.select().from(s.units).where(eq(s.units.propertyId, p.id));
    const ls = us.length ? await db.select().from(s.leases).where(inArray(s.leases.unitId, us.map((u) => u.id))) : [];
    return { ...p, units: us.map((u) => ({ ...u, lease: ls.find((l) => l.unitId === u.id && l.status === "active") ?? null })) };
  }),
  create: landlordOnly.input(propInput.extend({ units: z.array(unitInput.omit({ propertyId: true })).default([]) })).handler(async ({ input, context }) => {
    const { units: unitList, ...rest } = input;
    let portfolioId = rest.portfolioId ?? null;
    if (!portfolioId) {
      const [first] = await db.select().from(s.portfolios).where(eq(s.portfolios.landlordId, context.lid));
      portfolioId = first?.id ?? null;
    }
    const [p] = await db.insert(s.properties).values({ ...rest, portfolioId, landlordId: context.lid }).returning();
    const list = unitList.length ? unitList : [{ name: "Main", beds: 1, baths: 1, sqft: 0, rent: 0, deposit: 0 }];
    await db.insert(s.units).values(list.map((u) => ({ ...u, baths: Math.round(u.baths), propertyId: p.id, landlordId: context.lid })));
    await log(context.lid, "property", p.id, `Added property ${p.name}`, context.user.name);
    return p;
  }),
  update: landlordOnly.input(propInput.extend({ id: z.number() })).handler(async ({ input, context }) => {
    const { id, ...rest } = input;
    await db.update(s.properties).set(rest).where(and(eq(s.properties.id, id), eq(s.properties.landlordId, context.lid)));
    return { ok: true };
  }),
  remove: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    await db.delete(s.units).where(and(eq(s.units.propertyId, input.id), eq(s.units.landlordId, context.lid)));
    await db.delete(s.properties).where(and(eq(s.properties.id, input.id), eq(s.properties.landlordId, context.lid)));
    return { ok: true };
  }),
};

export const units = {
  create: landlordOnly.input(unitInput).handler(async ({ input, context }) => {
    const [p] = await db.select().from(s.properties).where(and(eq(s.properties.id, input.propertyId), eq(s.properties.landlordId, context.lid)));
    if (!p) throw new ORPCError("NOT_FOUND");
    const [u] = await db.insert(s.units).values({ ...input, baths: Math.round(input.baths), landlordId: context.lid }).returning();
    return u;
  }),
  update: landlordOnly.input(unitInput.omit({ propertyId: true }).extend({ id: z.number() })).handler(async ({ input, context }) => {
    const { id, ...rest } = input;
    await db.update(s.units).set({ ...rest, baths: Math.round(rest.baths) }).where(and(eq(s.units.id, id), eq(s.units.landlordId, context.lid)));
    return { ok: true };
  }),
  remove: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    await db.delete(s.units).where(and(eq(s.units.id, input.id), eq(s.units.landlordId, context.lid)));
    return { ok: true };
  }),
};

export const listings = {
  list: landlordOnly.handler(async ({ context }) => {
    const us = await db.select().from(s.units).where(eq(s.units.landlordId, context.lid));
    const props = await db.select().from(s.properties).where(eq(s.properties.landlordId, context.lid));
    const apps = await db.select().from(s.applications).where(eq(s.applications.landlordId, context.lid));
    return us
      .filter((u) => u.status !== "occupied")
      .map((u) => ({ ...u, property: props.find((p) => p.id === u.propertyId)!, applicationCount: apps.filter((a) => a.unitId === u.id).length }));
  }),
  publish: landlordOnly
    .input(z.object({ unitId: z.number(), listingTitle: z.string().min(1), listingDescription: z.string(), rent: z.number().int(), deposit: z.number().int(), availableDate: z.string() }))
    .handler(async ({ input, context }) => {
      const { unitId, ...rest } = input;
      await db.update(s.units).set({ ...rest, status: "listed" }).where(and(eq(s.units.id, unitId), eq(s.units.landlordId, context.lid)));
      await log(context.lid, "listing", unitId, `Published listing "${input.listingTitle}"`, context.user.name);
      return { ok: true };
    }),
  unpublish: landlordOnly.input(z.object({ unitId: z.number() })).handler(async ({ input, context }) => {
    await db.update(s.units).set({ status: "vacant" }).where(and(eq(s.units.id, input.unitId), eq(s.units.landlordId, context.lid)));
    return { ok: true };
  }),
  /** Public listing page for applicants */
  public: base.input(z.object({ unitId: z.number() })).handler(async ({ input }) => {
    const [u] = await db.select().from(s.units).where(eq(s.units.id, input.unitId));
    if (!u || u.status !== "listed") throw new ORPCError("NOT_FOUND", { message: "This listing is no longer available" });
    const [p] = await db.select().from(s.properties).where(eq(s.properties.id, u.propertyId));
    const [owner] = await db.select().from(s.profiles).where(eq(s.profiles.userId, u.landlordId));
    return {
      unit: { id: u.id, name: u.name, beds: u.beds, baths: u.baths, sqft: u.sqft, rent: u.rent, deposit: u.deposit, listingTitle: u.listingTitle, listingDescription: u.listingDescription, availableDate: u.availableDate },
      property: { name: p.name, address: p.address, city: p.city, state: p.state, zip: p.zip, type: p.type },
      landlordName: owner?.name ?? "",
    };
  }),
};
