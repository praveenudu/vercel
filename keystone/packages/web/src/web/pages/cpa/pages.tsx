import { useMemo, useState } from "react";
import { Link } from "wouter";
import { LayoutDashboard, BarChart3, Landmark, FileText, ArrowRight, FolderOpen } from "lucide-react";
import { PageHeader, Card, Loading, StatBox, Select, Table } from "../../components/ui/kit";
import { PortfolioSelect } from "../../components/portfolio-select";
import { useMeData, usePortfolio } from "../../components/session";
import { useTransactions } from "../../queries/cash";
import { useDocuments } from "../../queries/documents";
import { ReportsView } from "../landlord/reports";
import { TransactionsView } from "../landlord/cash";
import { DocumentsView } from "../landlord/documents";
import { money, fmtDate } from "../../lib/format";
import { SCHEDULE_E_EXPENSES, categoryLabel } from "../../../shared/plans";

const YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

export function CpaOverview() {
  const me = useMeData();
  const { portfolioId } = usePortfolio();
  const [year, setYear] = useState(new Date().getFullYear());
  const tx = useTransactions({ portfolioId, year });
  const docs = useDocuments(year);

  const scheduleE = useMemo(() => {
    const exp = (tx.data?.rows ?? []).filter((r) => r.type === "expense");
    return SCHEDULE_E_EXPENSES.map((c) => ({ ...c, total: exp.filter((r) => r.category === c.id).reduce((t, r) => t + r.amount, 0) })).filter((c) => c.total > 0);
  }, [tx.data]);

  const byProperty = useMemo(() => {
    const m = new Map<string, { income: number; expense: number }>();
    for (const r of tx.data?.rows ?? []) {
      const e = m.get(r.propertyName) ?? { income: 0, expense: 0 };
      e[r.type as "income" | "expense"] += r.amount;
      m.set(r.propertyName, e);
    }
    return [...m.entries()].sort((a, b) => b[1].income - a[1].income);
  }, [tx.data]);

  if (tx.isLoading) return <Loading />;
  const d = tx.data!;
  const uncategorized = d.rows.filter((r) => !r.category || r.category === "other").length;
  // Refundable security deposits are liabilities, not Schedule E income.
  const deposits = d.rows.filter((r) => r.type === "income" && r.category === "deposits").reduce((t, r) => t + r.amount, 0);
  const rentalIncome = d.income - deposits;
  const net = rentalIncome - d.expense;

  return (
    <div>
      <PageHeader icon={<LayoutDashboard />} title="Client Overview" subtitle={`Read-only books for ${me.ownerName}. Everything here is ready for Schedule E.`}>
        <PortfolioSelect />
        <Select className="h-12 w-48 text-[16px] text-ink" value={year} onChange={(e) => setYear(Number(e.target.value))}>{YEARS.map((y) => <option key={y} value={y}>Tax year {y}</option>)}</Select>
      </PageHeader>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5 stagger">
        <StatBox label="Rental income" value={money(rentalIncome)} tone="ok" sub={deposits ? `Excludes ${money(deposits)} in security deposits` : undefined} />
        <StatBox label="Expenses" value={money(d.expense)} />
        <StatBox label="Net income" value={money(net)} tone={net >= 0 ? "ok" : "bad"} sub="Before depreciation" />
        <StatBox label="Tax documents shared" value={docs.data?.length ?? 0} sub={uncategorized ? `${uncategorized} transactions marked "other"` : "All transactions categorized"} tone={uncategorized ? "warn" : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2" title={`Schedule E expenses · ${year}`} action={<Link href="/cpa/reports" className="text-sm font-semibold text-brand inline-flex items-center gap-1">Full reports <ArrowRight className="size-4" /></Link>} bodyClass="p-0">
          {!scheduleE.length ? (
            <p className="p-5 text-sm text-muted">No expenses recorded for {year}.</p>
          ) : (
            <Table>
              <thead><tr><th className="w-16">Line</th><th>Category</th><th className="text-right">Amount</th><th className="text-right w-24">Share</th></tr></thead>
              <tbody>
                {scheduleE.map((c) => (
                  <tr key={c.id}>
                    <td className="text-muted">{c.line}</td>
                    <td className="text-ink">{c.label}</td>
                    <td className="text-right font-semibold text-ink">{money(c.total)}</td>
                    <td className="text-right text-muted">{d.expense ? Math.round((c.total / d.expense) * 100) : 0}%</td>
                  </tr>
                ))}
                <tr className="bg-app"><td className="text-muted">20</td><td className="font-semibold text-ink">Total expenses</td><td className="text-right font-bold text-ink">{money(d.expense)}</td><td className="text-right text-muted">100%</td></tr>
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="By property" bodyClass="p-0">
            <div className="divide-y divide-line">
              {byProperty.map(([name, v]) => (
                <div key={name} className="px-5 py-3 text-sm">
                  <p className="font-semibold text-ink">{name}</p>
                  <p className="text-xs text-muted">In {money(v.income)} · Out {money(v.expense)} · <span className={v.income - v.expense >= 0 ? "text-ok" : "text-bad"}>Net {money(v.income - v.expense)}</span></p>
                </div>
              ))}
              {!byProperty.length && <p className="p-5 text-sm text-muted">No activity.</p>}
            </div>
          </Card>
          <Card title="Recently shared documents" action={<Link href="/cpa/documents" className="text-sm font-semibold text-brand">View all</Link>} bodyClass="p-0">
            <div className="divide-y divide-line">
              {(docs.data ?? []).slice(0, 5).map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <FileText className="size-4 text-brand shrink-0" />
                  <div className="min-w-0 flex-1"><p className="font-medium text-ink truncate">{doc.name}</p><p className="text-xs text-muted">{doc.propertyName} · {fmtDate(doc.createdAt)}</p></div>
                </div>
              ))}
              {!docs.data?.length && <p className="p-5 text-sm text-muted">Nothing shared for {year} yet.</p>}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-5" title="Latest transactions" action={<Link href="/cpa/transactions" className="text-sm font-semibold text-brand">All transactions</Link>} bodyClass="p-0">
        <Table>
          <thead><tr><th>Date</th><th>Property</th><th>Payee</th><th>Category</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {d.rows.slice(0, 8).map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.propertyName}</td>
                <td className="text-ink">{r.payee || r.description || "—"}</td>
                <td>{categoryLabel(r.category)}</td>
                <td className={`text-right font-semibold ${r.type === "income" ? "text-ok" : "text-ink"}`}>{r.type === "income" ? "+" : "−"}{money(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

export function CpaReports() {
  return (
    <div>
      <PageHeader icon={<BarChart3 />} title="Reports" subtitle="Schedule E, P&L and cash flow — print or export for your workpapers.">
        <PortfolioSelect />
      </PageHeader>
      <ReportsView viewer="cpa" />
    </div>
  );
}

export function CpaTransactions() {
  const { portfolioId } = usePortfolio();
  return (
    <div>
      <PageHeader icon={<Landmark />} title="Transactions" subtitle="Read-only ledger of every income and expense item.">
        <PortfolioSelect />
      </PageHeader>
      <TransactionsView portfolioId={portfolioId} readOnly />
    </div>
  );
}

export function CpaDocuments() {
  const me = useMeData();
  return (
    <div>
      <PageHeader icon={<FolderOpen />} title="Tax Documents" subtitle={`Documents ${me.ownerName} has shared with you. Upload workpapers or returns back to the client.`} />
      <DocumentsView viewer="cpa" />
    </div>
  );
}
