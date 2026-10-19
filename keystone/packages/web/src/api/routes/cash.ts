import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { booksAccess, landlordOnly } from "../middleware/auth";
import { log } from "../lib/util";

export const cash = {
  list: booksAccess
    .input(z.object({ propertyId: z.number().nullable().optional(), portfolioId: z.number().nullable().optional(), year: z.number().optional(), type: z.enum(["income", "expense"]).optional() }).optional())
    .handler(async ({ input, context }) => {
      let rows = await db.select().from(s.transactions).where(eq(s.transactions.landlordId, context.lid)).orderBy(desc(s.transactions.date), desc(s.transactions.id));
      const props = await db.select().from(s.properties).where(eq(s.properties.landlordId, context.lid));
      if (input?.portfolioId) {
        const ids = new Set(props.filter((p) => p.portfolioId === input.portfolioId).map((p) => p.id));
        rows = rows.filter((r) => r.propertyId && ids.has(r.propertyId));
      }
      if (input?.propertyId) rows = rows.filter((r) => r.propertyId === input.propertyId);
      if (input?.year) rows = rows.filter((r) => r.date.startsWith(String(input.year)));
      if (input?.type) rows = rows.filter((r) => r.type === input.type);
      const income = rows.filter((r) => r.type === "income").reduce((t, r) => t + r.amount, 0);
      const expense = rows.filter((r) => r.type === "expense").reduce((t, r) => t + r.amount, 0);
      return { rows: rows.map((r) => ({ ...r, propertyName: props.find((p) => p.id === r.propertyId)?.name ?? "Portfolio-wide" })), income, expense, net: income - expense };
    }),
  create: landlordOnly
    .input(z.object({ propertyId: z.number().nullable(), date: z.string(), amount: z.number().int().positive(), type: z.enum(["income", "expense"]), category: z.string(), payee: z.string().default(""), description: z.string().default(""), account: z.string().default("Operating") }))
    .handler(async ({ input, context }) => {
      const [t] = await db.insert(s.transactions).values({ ...input, landlordId: context.lid, source: "manual" }).returning();
      await log(context.lid, "transaction", t.id, `Added ${input.type} $${(input.amount / 100).toFixed(2)} (${input.category})`, context.user.name);
      return t;
    }),
  update: landlordOnly.input(z.object({ id: z.number(), category: z.string(), propertyId: z.number().nullable(), description: z.string() })).handler(async ({ input, context }) => {
    const { id, ...rest } = input;
    await db.update(s.transactions).set(rest).where(and(eq(s.transactions.id, id), eq(s.transactions.landlordId, context.lid)));
    return { ok: true };
  }),
  remove: landlordOnly.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const [t] = await db.select().from(s.transactions).where(and(eq(s.transactions.id, input.id), eq(s.transactions.landlordId, context.lid)));
    if (!t) throw new ORPCError("NOT_FOUND");
    if (t.source !== "manual") throw new ORPCError("BAD_REQUEST", { message: "Linked transactions are managed from Rent Collection / Invoices" });
    await db.delete(s.transactions).where(eq(s.transactions.id, t.id));
    return { ok: true };
  }),
};
