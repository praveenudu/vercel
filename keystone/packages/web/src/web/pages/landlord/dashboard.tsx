import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "motion/react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { LayoutDashboard, ChevronDown, ChevronsDownUp, ChevronsUpDown, X, CheckCircle2, Circle, ArrowRight, AlertTriangle } from "lucide-react";
import { PageHeader, Card, Button, Loading, Stat, Pill } from "../../components/ui/kit";
import { PortfolioSelect } from "../../components/portfolio-select";
import { usePortfolio, useMeData } from "../../components/session";
import { useDashboard } from "../../queries/reports";
import { money, moneyShort, timeAgo } from "../../lib/format";
import { cn } from "../../lib/utils";

const PIE = ["#2f6eb5", "#1b3a5c", "#6aa5e3", "#9cc2ec", "#b7791f", "#1e8e5a", "#c53030", "#6b7789"];

export default function Dashboard() {
  const { portfolioId } = usePortfolio();
  const me = useMeData();
  const q = useDashboard(portfolioId);
  if (q.isLoading || !q.data) return <Loading />;
  const d = q.data;
  const occ = d.portfolio.units ? Math.round((d.portfolio.occupied / d.portfolio.units) * 100) : 0;
  const rentPct = d.rent.expected ? Math.min(100, Math.round((d.rent.collected / d.rent.expected) * 100)) : 0;
  const chart = d.series.map((s) => ({ ...s, income: s.income / 100, expense: -s.expense / 100, net: s.net / 100 }));
  const hasData = d.series.some((s) => s.income || s.expense);
  const t = d.tasks;
  const tasks = [
    { n: t.emergencies, label: "Emergency maintenance", href: "/maintenance", urgent: true },
    { n: t.applicationsToReview, label: "Applications to review", href: "/screening" },
    { n: t.leasesToSign, label: "Leases awaiting your countersignature", href: "/leases" },
    { n: t.paymentsToConfirm, label: "Tenant payments to confirm", href: "/rent" },
    { n: t.invoicesToApprove, label: "Invoices awaiting approval", href: "/invoices" },
    { n: t.invoicesToPay, label: "Approved invoices to pay", href: "/invoices" },
    { n: t.openMaintenance, label: "Open maintenance requests", href: "/maintenance" },
    { n: t.leasesOut, label: "Leases out for tenant signature", href: "/leases" },
  ].filter((x) => x.n > 0);

  return (
    <div>
      <PageHeader icon={<LayoutDashboard />} title="Dashboard">
        <PortfolioSelect />
      </PageHeader>
      <p className="-mt-3 mb-6 text-sm text-muted">Welcome back, {me.user.name.split(" ")[0]}. Here's how your rentals are doing.</p>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px] stagger">
        <Card title="Net Cash Flow" info="Income minus expenses over the trailing 12 months, from Cash Management." action={<Link href="/cash" className="text-sm font-semibold text-brand">View transactions</Link>}>
          <div className="flex flex-wrap gap-x-10 gap-y-3 mb-4">
            <Stat label="Net · YTD" value={money(d.ytd.net, { cents: false })} tone={d.ytd.net >= 0 ? "ok" : "bad"} />
            <Stat label="Income · YTD" value={money(d.ytd.income, { cents: false })} />
            <Stat label="Expenses · YTD" value={money(d.ytd.expense, { cents: false })} />
          </div>
          {hasData ? (
            <div className="h-[260px] -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} stackOffset="sign" barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="#e1e6ed" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7789" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7789" }} tickFormatter={(v: number) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={52} />
                  <Tooltip formatter={(v, n) => [money(Math.abs(Number(v)) * 100), n === "net" ? "Net" : n === "income" ? "Income" : "Expenses"]} contentStyle={{ borderRadius: 8, border: "1px solid #e1e6ed", fontSize: 13 }} />
                  <Bar isAnimationActive={false} dataKey="income" stackId="a" fill="#2f6eb5" radius={[3, 3, 0, 0]} />
                  <Bar isAnimationActive={false} dataKey="expense" stackId="a" fill="#9cc2ec" radius={[0, 0, 3, 3]} />
                  <Line isAnimationActive={false} dataKey="net" stroke="#1b3a5c" strokeWidth={2.5} dot={{ r: 3, fill: "#1b3a5c" }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-10 flex flex-col items-center gap-3">
              <p className="text-5xl font-extrabold text-line">$0</p>
              <Link href="/rent"><Button variant="outline" size="lg" className="min-w-[280px]">Track Rental Income</Button></Link>
              <Link href="/cash"><Button variant="outline" size="lg" className="min-w-[280px]">Add an Expense</Button></Link>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Rent this month" action={<Link href="/rent" className="text-sm font-semibold text-brand">Rent roll</Link>}>
            <div className="flex items-end justify-between">
              <Stat label="Collected" value={money(d.rent.collected, { cents: false })} sub={`of ${money(d.rent.expected, { cents: false })} expected`} />
              <span className="text-2xl font-extrabold text-brand">{rentPct}%</span>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-app overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${rentPct}%` }} transition={{ duration: 0.8 }} className="h-full bg-brand rounded-full" />
            </div>
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-muted">Outstanding</span>
              <span className={cn("font-bold", d.rent.outstanding > 0 ? "text-bad" : "text-ok")}>{money(d.rent.outstanding)}</span>
            </div>
            {d.rent.pendingConfirm > 0 && (
              <Link href="/rent" className="mt-3 flex items-center justify-between rounded-md bg-warn-tint px-3 py-2 text-sm font-semibold text-warn">
                {d.rent.pendingConfirm} payment{d.rent.pendingConfirm > 1 ? "s" : ""} to confirm <ArrowRight className="size-4" />
              </Link>
            )}
          </Card>
          <Card title="Portfolio">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Properties" value={d.portfolio.properties} />
              <Stat label="Units" value={d.portfolio.units} sub={`${d.portfolio.listed} listed`} />
              <Stat label="Occupancy" value={`${occ}%`} tone={occ >= 90 ? "ok" : occ >= 70 ? "warn" : "bad"} />
              <Stat label="Est. value" value={moneyShort(d.portfolio.value)} sub={d.portfolio.cost ? `+${moneyShort(d.portfolio.value - d.portfolio.cost)} equity gain` : undefined} />
            </div>
          </Card>
        </div>

        <Card title="Needs your attention" bodyClass="p-0">
          {tasks.length ? (
            <ul className="divide-y divide-line">
              {tasks.map((x) => (
                <li key={x.label}>
                  <Link href={x.href} className="flex items-center gap-3 px-5 h-14 hover:bg-app/50">
                    <span className={cn("min-w-8 h-8 px-2 rounded-full grid place-items-center text-sm font-bold", x.urgent ? "bg-bad text-white" : "bg-tint text-brand")}>{x.n}</span>
                    <span className="text-[15px] text-ink font-medium flex items-center gap-2">{x.urgent && <AlertTriangle className="size-4 text-bad" />}{x.label}</span>
                    <ArrowRight className="size-4 ml-auto text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-muted">You're all caught up.</p>
          )}
        </Card>

        <Card title="Expenses by category" info="Year to date, mapped to Schedule E lines.">
          {d.expenseByCategory.length ? (
            <div className="flex items-center gap-4">
              <div className="size-[130px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie isAnimationActive={false} data={d.expenseByCategory} dataKey="amount" nameKey="label" innerRadius={38} outerRadius={62} paddingAngle={2} stroke="none">
                      {d.expenseByCategory.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-1.5 text-sm min-w-0">
                {d.expenseByCategory.slice(0, 6).map((c, i) => (
                  <li key={c.category} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: PIE[i % PIE.length] }} />
                    <span className="truncate text-body">{c.label}</span>
                    <span className="ml-auto font-semibold text-ink">{moneyShort(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">No expenses recorded this year.</p>
          )}
        </Card>

        <Card title="Recent activity" className="xl:col-span-2" bodyClass="p-0">
          <ul className="divide-y divide-line">
            {d.recent.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                <Pill tone="blue" className="mt-0.5">{a.entityType}</Pill>
                <p className="text-sm text-ink flex-1">{a.message}{a.actor && <span className="text-muted"> · {a.actor}</span>}</p>
                <span className="text-xs text-muted whitespace-nowrap">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
            {!d.recent.length && <li className="p-6 text-sm text-muted">Activity will show up here.</li>}
          </ul>
        </Card>
      </div>

      <SetupGuide setup={d.setup} />
    </div>
  );
}

function SetupGuide({ setup }: { setup: { property: boolean; listing: boolean; screening: boolean; lease: boolean; rent: boolean; expense: boolean; documents: boolean } }) {
  const [hidden, setHidden] = useState(() => localStorage.getItem("keystone.setup") === "hidden");
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const steps = [
    { t: "Add your properties", done: setup.property, d: "Add each rental and its units with rent and deposit amounts.", cta: "Add property", href: "/properties" },
    { t: "Screen tenants", done: setup.listing && setup.screening, d: "Publish a listing, share the application link and run screening on applicants.", cta: "Go to listings", href: "/listings" },
    { t: "E-sign a lease", done: setup.lease, d: "Turn an approved application into a lease and send it for e-signature.", cta: "Create lease", href: "/leases" },
    { t: "Automate rent collection", done: setup.rent, d: "Monthly charges post automatically. Record Zelle, check or cash payments.", cta: "Open rent roll", href: "/rent" },
    { t: "Track income and expenses", done: setup.expense, d: "Log expenses against Schedule E categories, or pay vendor invoices.", cta: "Add transaction", href: "/cash" },
    { t: "Prepare tax reports", done: setup.documents, d: "Upload 1098s and insurance docs, then invite your CPA.", cta: "Upload documents", href: "/documents" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="no-print fixed z-30 bottom-5 left-5 lg:left-[100px] w-[min(380px,calc(100vw-40px))] rounded-xl bg-white shadow-[0_20px_60px_-15px_rgba(27,58,92,0.45)] border border-line">
        <div className="flex items-center gap-2 px-5 pt-4">
          <p className="font-bold text-ink text-[17px]">Setup Guide</p>
          <span className="text-xs font-semibold text-muted">{done}/{steps.length}</span>
          <button onClick={() => setCollapsed((c) => !c)} className="ml-auto text-muted hover:text-ink cursor-pointer" aria-label="Collapse">
            {collapsed ? <ChevronsUpDown className="size-5" /> : <ChevronsDownUp className="size-5" />}
          </button>
          <button onClick={() => { localStorage.setItem("keystone.setup", "hidden"); setHidden(true); }} className="text-muted hover:text-ink cursor-pointer" aria-label="Dismiss">
            <X className="size-5" />
          </button>
        </div>
        <div className="mx-5 mt-3 mb-3 h-2 rounded-full bg-line overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${(done / steps.length) * 100}%` }} className="h-full bg-brand rounded-full" />
        </div>
        {!collapsed && (
          <ul className="pb-2">
            {steps.map((s, i) => (
              <li key={s.t} className="px-2">
                <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center gap-3 px-3 h-12 rounded-md hover:bg-app cursor-pointer">
                  {s.done ? <CheckCircle2 className="size-5 text-ok shrink-0" /> : <Circle className="size-5 text-line shrink-0" />}
                  <span className={cn("font-bold text-[15px] text-left", s.done ? "text-muted line-through" : "text-ink")}>{s.t}</span>
                  <ChevronDown className={cn("size-5 ml-auto text-muted transition-transform", open === i && "rotate-180")} />
                </button>
                {open === i && (
                  <div className="px-11 pb-3 page-enter">
                    <p className="text-sm text-body">{s.d}</p>
                    <Link href={s.href}><Button size="sm" className="mt-2.5">{s.cta}</Button></Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
