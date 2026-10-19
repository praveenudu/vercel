import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { booksAccess, landlordOnly } from "../middleware/auth";
import { leaseBalances, syncCharges, today } from "../lib/util";
import { INCOME_CATEGORIES, PLANS, REPORTS, SCHEDULE_E_EXPENSES, categoryLabel, planAtLeast, type PlanId, type ReportId } from "../../shared/plans";

type Col = { key: string; label: string; type: "text" | "money" | "number" | "pill" };
type Report = { title: string; subtitle: string; columns: Col[]; rows: Record<string, string | number | null>[]; totals?: Record<string, string | number | null> };

async function scope(lid: string, portfolioId?: number | null) {
  let props = await db.select().from(s.properties).where(eq(s.properties.landlordId, lid));
  if (portfolioId) props = props.filter((p) => p.portfolioId === portfolioId);
  const pids = new Set(props.map((p) => p.id));
  const units = (await db.select().from(s.units).where(eq(s.units.landlordId, lid))).filter((u) => pids.has(u.propertyId));
  let tx = await db.select().from(s.transactions).where(eq(s.transactions.landlordId, lid));
  if (portfolioId) tx = tx.filter((t) => t.propertyId && pids.has(t.propertyId));
  return { props, units, tx, pids };
}

const months = (year: number) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
const monthName = (p: string) => new Date(p + "-01T00:00:00Z").toLocaleString("en-US", { month: "short", timeZone: "UTC" });

export const reports = {
  dashboard: landlordOnly.input(z.object({ portfolioId: z.number().nullable().optional() }).optional()).handler(async ({ input, context }) => {
    const lid = context.lid;
    const { props, units, tx } = await scope(lid, input?.portfolioId);
    const now = today();
    const period = now.slice(0, 7);
    // last 12 months series
    const series: { month: string; label: string; income: number; expense: number; net: number }[] = [];
    const d = new Date(period + "-01T00:00:00Z");
    for (let i = 11; i >= 0; i--) {
      const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
      const inc = tx.filter((t) => t.type === "income" && t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0);
      const exp = tx.filter((t) => t.type === "expense" && t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0);
      series.push({ month: m, label: monthName(m), income: inc, expense: exp, net: inc - exp });
    }
    const year = now.slice(0, 4);
    const ytdIncome = tx.filter((t) => t.type === "income" && t.date.startsWith(year)).reduce((a, t) => a + t.amount, 0);
    const ytdExpense = tx.filter((t) => t.type === "expense" && t.date.startsWith(year)).reduce((a, t) => a + t.amount, 0);
    const expenseByCat = new Map<string, number>();
    tx.filter((t) => t.type === "expense" && t.date.startsWith(year)).forEach((t) => expenseByCat.set(t.category, (expenseByCat.get(t.category) ?? 0) + t.amount));

    const uids = units.map((u) => u.id);
    const active = uids.length ? (await db.select().from(s.leases).where(and(eq(s.leases.landlordId, lid), eq(s.leases.status, "active")))).filter((l) => uids.includes(l.unitId)) : [];
    for (const l of active) await syncCharges(l.id, planAtLeast(context.plan, "manage"));
    const bal = await leaseBalances(active.map((l) => l.id));
    const charges = active.length ? await db.select().from(s.rentCharges).where(inArray(s.rentCharges.leaseId, active.map((l) => l.id))) : [];
    const expected = charges.filter((c) => c.period === period && c.type === "rent").reduce((a, c) => a + c.amount, 0);
    const collected = tx.filter((t) => t.source === "rent" && t.date.startsWith(period)).reduce((a, t) => a + t.amount, 0);
    const outstanding = [...bal.values()].reduce((a, b) => a + Math.max(0, b.balance), 0);

    const maint = await db.select().from(s.maintenanceRequests).where(eq(s.maintenanceRequests.landlordId, lid));
    const invs = await db.select().from(s.invoices).where(eq(s.invoices.landlordId, lid));
    const pays = await db.select().from(s.payments).where(and(eq(s.payments.landlordId, lid), eq(s.payments.status, "reported")));
    const apps = await db.select().from(s.applications).where(eq(s.applications.landlordId, lid));
    const allLeases = await db.select().from(s.leases).where(eq(s.leases.landlordId, lid));
    const docs = await db.select().from(s.documents).where(eq(s.documents.landlordId, lid));
    const recent = await db.select().from(s.activity).where(eq(s.activity.landlordId, lid)).orderBy(desc(s.activity.createdAt)).limit(12);

    return {
      series,
      ytd: { income: ytdIncome, expense: ytdExpense, net: ytdIncome - ytdExpense },
      expenseByCategory: [...expenseByCat.entries()].map(([k, v]) => ({ category: k, label: categoryLabel(k), amount: v })).sort((a, b) => b.amount - a.amount),
      portfolio: {
        properties: props.length,
        units: units.length,
        occupied: units.filter((u) => u.status === "occupied").length,
        listed: units.filter((u) => u.status === "listed").length,
        value: props.reduce((a, p) => a + p.currentValue, 0),
        cost: props.reduce((a, p) => a + p.purchasePrice, 0),
      },
      rent: { expected, collected, outstanding, pendingConfirm: pays.length },
      tasks: {
        applicationsToReview: apps.filter((a) => ["submitted", "review"].includes(a.status)).length,
        leasesToSign: allLeases.filter((l) => l.status === "tenant_signed").length,
        leasesOut: allLeases.filter((l) => l.status === "sent").length,
        paymentsToConfirm: pays.length,
        invoicesToApprove: invs.filter((i) => ["submitted", "pending_second"].includes(i.status)).length,
        invoicesToPay: invs.filter((i) => i.status === "approved").length,
        openMaintenance: maint.filter((m) => !["completed", "closed"].includes(m.status)).length,
        emergencies: maint.filter((m) => m.priority === "emergency" && !["completed", "closed"].includes(m.status)).length,
      },
      setup: {
        property: props.length > 0,
        listing: units.some((u) => u.status === "listed") || apps.length > 0,
        screening: apps.some((a) => a.score != null),
        lease: allLeases.some((l) => l.status === "active"),
        rent: tx.some((t) => t.source === "rent"),
        expense: tx.some((t) => t.type === "expense"),
        documents: docs.some((x) => x.category !== "lease"),
      },
      recent,
    };
  }),

  catalog: booksAccess.handler(({ context }) => REPORTS.map((r) => ({ ...r, unlocked: planAtLeast(context.plan, r.minPlan), planName: PLANS[r.minPlan].name }))),

  run: booksAccess
    .input(z.object({ id: z.string(), year: z.number(), portfolioId: z.number().nullable().optional() }))
    .handler(async ({ input, context }): Promise<Report> => {
      const def = REPORTS.find((r) => r.id === input.id);
      if (!def) throw new ORPCError("NOT_FOUND");
      if (!planAtLeast(context.plan, def.minPlan)) throw new ORPCError("FORBIDDEN", { message: `${def.name} requires the ${PLANS[def.minPlan as PlanId].name} plan.` });
      const lid = context.lid;
      const { props, units, tx: allTx } = await scope(lid, input.portfolioId);
      const Y = String(input.year);
      const tx = allTx.filter((t) => t.date.startsWith(Y));
      const sum = (arr: typeof tx) => arr.reduce((a, t) => a + t.amount, 0);
      const sub = `Tax year ${Y}${input.portfolioId ? "" : " · All properties"}`;
      switch (input.id as ReportId) {
        case "net_cash_flow": {
          const rows = months(input.year).map((m) => {
            const inc = sum(tx.filter((t) => t.type === "income" && t.date.startsWith(m)));
            const exp = sum(tx.filter((t) => t.type === "expense" && t.date.startsWith(m)));
            return { month: monthName(m) + " " + Y, income: inc, expense: exp, net: inc - exp };
          });
          const inc = sum(tx.filter((t) => t.type === "income"));
          const exp = sum(tx.filter((t) => t.type === "expense"));
          return { title: def.name, subtitle: sub, columns: [{ key: "month", label: "Month", type: "text" }, { key: "income", label: "Income", type: "money" }, { key: "expense", label: "Expenses", type: "money" }, { key: "net", label: "Net Cash Flow", type: "money" }], rows, totals: { month: "Total", income: inc, expense: exp, net: inc - exp } };
        }
        case "rent_roll": {
          const ls = (await db.select().from(s.leases).where(and(eq(s.leases.landlordId, lid), eq(s.leases.status, "active")))).filter((l) => units.some((u) => u.id === l.unitId));
          const bal = await leaseBalances(ls.map((l) => l.id));
          const rows = units.map((u) => {
            const l = ls.find((x) => x.unitId === u.id);
            const p = props.find((x) => x.id === u.propertyId)!;
            return { property: p.name, unit: u.name, status: u.status, tenant: l?.tenantName ?? "—", term: l ? `${l.startDate} → ${l.endDate}` : "—", rent: l?.rent ?? u.rent, deposit: l?.deposit ?? 0, balance: l ? bal.get(l.id)!.balance : 0 };
          });
          return { title: def.name, subtitle: `As of ${today()}`, columns: [{ key: "property", label: "Property", type: "text" }, { key: "unit", label: "Unit", type: "text" }, { key: "status", label: "Status", type: "pill" }, { key: "tenant", label: "Tenant", type: "text" }, { key: "term", label: "Lease term", type: "text" }, { key: "rent", label: "Rent", type: "money" }, { key: "deposit", label: "Deposit", type: "money" }, { key: "balance", label: "Balance", type: "money" }], rows, totals: { property: `${rows.length} units`, rent: rows.reduce((a, r) => a + (r.rent as number), 0), deposit: rows.reduce((a, r) => a + (r.deposit as number), 0), balance: rows.reduce((a, r) => a + (r.balance as number), 0) } };
        }
        case "income_statement": {
          const rows: Report["rows"] = [];
          rows.push({ section: "INCOME", category: "", amount: null });
          for (const c of INCOME_CATEGORIES) {
            const v = sum(tx.filter((t) => t.type === "income" && t.category === c.id));
            if (v) rows.push({ section: "", category: c.label, amount: v });
          }
          const inc = sum(tx.filter((t) => t.type === "income"));
          rows.push({ section: "", category: "Total income", amount: inc });
          rows.push({ section: "EXPENSES", category: "", amount: null });
          for (const c of SCHEDULE_E_EXPENSES) {
            const v = sum(tx.filter((t) => t.type === "expense" && t.category === c.id));
            if (v) rows.push({ section: "", category: c.label, amount: v });
          }
          const exp = sum(tx.filter((t) => t.type === "expense"));
          rows.push({ section: "", category: "Total expenses", amount: exp });
          return { title: def.name, subtitle: sub, columns: [{ key: "section", label: "", type: "text" }, { key: "category", label: "Category", type: "text" }, { key: "amount", label: "Amount", type: "money" }], rows, totals: { section: "NET OPERATING INCOME", category: "", amount: inc - exp } };
        }
        case "schedule_e": {
          const cols: Col[] = [{ key: "line", label: "Line", type: "text" }, { key: "label", label: "Schedule E item", type: "text" }, ...props.map((p) => ({ key: `p${p.id}`, label: p.name, type: "money" as const })), { key: "total", label: "Total", type: "money" }];
          const mk = (line: string, label: string, f: (t: (typeof tx)[number]) => boolean) => {
            const r: Record<string, string | number | null> = { line, label };
            let total = 0;
            for (const p of props) {
              const v = sum(tx.filter((t) => t.propertyId === p.id && f(t)));
              r[`p${p.id}`] = v;
              total += v;
            }
            r.total = total;
            return r;
          };
          const rows = [mk("3", "Rents received", (t) => t.type === "income" && t.category !== "deposits"), ...SCHEDULE_E_EXPENSES.map((c) => mk(String(c.line), c.label, (t) => t.type === "expense" && t.category === c.id))];
          const totals = mk("20/21", "Total expenses · Net income (loss)", () => false);
          for (const p of props) {
            const inc = sum(tx.filter((t) => t.propertyId === p.id && t.type === "income" && t.category !== "deposits"));
            const exp = sum(tx.filter((t) => t.propertyId === p.id && t.type === "expense"));
            totals[`p${p.id}`] = inc - exp;
          }
          totals.total = props.reduce((a, p) => a + (totals[`p${p.id}`] as number), 0);
          return { title: def.name, subtitle: `${sub} · IRS Form 1040 Schedule E, Part I`, columns: cols, rows, totals };
        }
        case "tenant_ledger": {
          const ls = (await db.select().from(s.leases).where(eq(s.leases.landlordId, lid))).filter((l) => units.some((u) => u.id === l.unitId) && ["active", "ended"].includes(l.status));
          const bal = await leaseBalances(ls.map((l) => l.id));
          const rows = ls.map((l) => {
            const u = units.find((x) => x.id === l.unitId)!;
            const b = bal.get(l.id)!;
            return { tenant: l.tenantName, unit: `${props.find((p) => p.id === u.propertyId)?.name} · ${u.name}`, status: l.status, charged: b.charged, paid: b.paid, balance: b.balance };
          });
          return { title: def.name, subtitle: `Lifetime, as of ${today()}`, columns: [{ key: "tenant", label: "Tenant", type: "text" }, { key: "unit", label: "Unit", type: "text" }, { key: "status", label: "Lease", type: "pill" }, { key: "charged", label: "Charged", type: "money" }, { key: "paid", label: "Paid", type: "money" }, { key: "balance", label: "Balance", type: "money" }], rows };
        }
        case "expense_by_category": {
          const cats = SCHEDULE_E_EXPENSES.filter((c) => tx.some((t) => t.type === "expense" && t.category === c.id));
          const rows = cats.map((c) => {
            const r: Record<string, string | number | null> = { category: c.label };
            let total = 0;
            for (const p of props) {
              const v = sum(tx.filter((t) => t.type === "expense" && t.category === c.id && t.propertyId === p.id));
              r[`p${p.id}`] = v;
              total += v;
            }
            r.total = total;
            return r;
          });
          return { title: def.name, subtitle: sub, columns: [{ key: "category", label: "Category", type: "text" }, ...props.map((p) => ({ key: `p${p.id}`, label: p.name, type: "money" as const })), { key: "total", label: "Total", type: "money" }], rows };
        }
        case "vendor_1099": {
          const vs = await db.select().from(s.vendors).where(eq(s.vendors.landlordId, lid));
          const paid = (await db.select().from(s.invoices).where(and(eq(s.invoices.landlordId, lid), eq(s.invoices.status, "paid")))).filter((i) => (i.paidAt ?? "").startsWith(Y));
          const rows = vs
            .map((v) => {
              const total = paid.filter((i) => i.vendorId === v.id).reduce((a, i) => a + i.amount, 0);
              return { vendor: v.company || v.name, trade: v.trade, tin: v.taxIdLast4 ? `•••-••-${v.taxIdLast4}` : "missing", w9: v.w9OnFile ? "on file" : "missing", invoices: paid.filter((i) => i.vendorId === v.id).length, total, required: total >= 60000 ? "1099-NEC required" : "not required" };
            })
            .filter((r) => r.total > 0)
            .sort((a, b) => b.total - a.total);
          return { title: def.name, subtitle: `${sub} · threshold $600`, columns: [{ key: "vendor", label: "Vendor", type: "text" }, { key: "trade", label: "Trade", type: "text" }, { key: "tin", label: "TIN", type: "text" }, { key: "w9", label: "W-9", type: "pill" }, { key: "invoices", label: "Invoices", type: "number" }, { key: "total", label: "Paid YTD", type: "money" }, { key: "required", label: "1099 status", type: "pill" }], rows };
        }
        case "portfolio_comparison": {
          const ports = await db.select().from(s.portfolios).where(eq(s.portfolios.landlordId, lid));
          const allProps = await db.select().from(s.properties).where(eq(s.properties.landlordId, lid));
          const allUnits = await db.select().from(s.units).where(eq(s.units.landlordId, lid));
          const allTxY = (await db.select().from(s.transactions).where(eq(s.transactions.landlordId, lid))).filter((t) => t.date.startsWith(Y));
          const rows = ports.map((pf) => {
            const pids = new Set(allProps.filter((p) => p.portfolioId === pf.id).map((p) => p.id));
            const us = allUnits.filter((u) => pids.has(u.propertyId));
            const t = allTxY.filter((x) => x.propertyId && pids.has(x.propertyId));
            const inc = sum(t.filter((x) => x.type === "income"));
            const exp = sum(t.filter((x) => x.type === "expense"));
            const value = allProps.filter((p) => pids.has(p.id)).reduce((a, p) => a + p.currentValue, 0);
            return { portfolio: pf.name, properties: pids.size, units: us.length, occupancy: us.length ? `${Math.round((us.filter((u) => u.status === "occupied").length / us.length) * 100)}%` : "—", income: inc, expense: exp, net: inc - exp, value };
          });
          return { title: def.name, subtitle: `Tax year ${Y}`, columns: [{ key: "portfolio", label: "Portfolio", type: "text" }, { key: "properties", label: "Properties", type: "number" }, { key: "units", label: "Units", type: "number" }, { key: "occupancy", label: "Occupancy", type: "text" }, { key: "income", label: "Income", type: "money" }, { key: "expense", label: "Expenses", type: "money" }, { key: "net", label: "Net", type: "money" }, { key: "value", label: "Est. value", type: "money" }], rows };
        }
      }
      throw new ORPCError("NOT_FOUND");
    }),
};
