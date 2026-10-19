import { useState } from "react";
import { Link } from "wouter";
import { BarChart3, Lock, Download, Printer, FileBarChart } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Table, Select, ErrorNote } from "../../components/ui/kit";
import { PortfolioSelect } from "../../components/portfolio-select";
import { usePortfolio } from "../../components/session";
import { useFeature } from "../../components/plan-gate";
import { useReportCatalog, useReport } from "../../queries/reports";
import { money } from "../../lib/format";
import { cn } from "../../lib/utils";

const YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

export default function ReportsPage() {
  return (
    <div>
      <PageHeader icon={<BarChart3 />} title="Reports" subtitle="Tax-ready financial reports, built from your rent and expense records.">
        <PortfolioSelect />
      </PageHeader>
      <ReportsView viewer="landlord" />
    </div>
  );
}

export function ReportsView({ viewer: role }: { viewer: "landlord" | "cpa" }) {
  const cat = useReportCatalog();
  const { portfolioId } = usePortfolio();
  const csv = useFeature("csv_export");
  const [sel, setSel] = useState("net_cash_flow");
  const [year, setYear] = useState(new Date().getFullYear());
  const item = cat.data?.find((r) => r.id === sel);
  const rep = useReport({ id: sel, year, portfolioId }, !!item?.unlocked);

  const fmt = (v: string | number | null | undefined, type: string) => {
    if (v == null || v === "") return "";
    if (type === "money") return money(Number(v));
    if (type === "number") return Number(v).toLocaleString();
    return String(v);
  };

  const exportCsv = () => {
    const r = rep.data;
    if (!r) return;
    const rows = [...r.rows, ...(r.totals ? [r.totals] : [])];
    const lines = [r.columns.map((c) => c.label), ...rows.map((row) => r.columns.map((c) => (c.type === "money" ? (Number(row[c.key] ?? 0) / 100).toFixed(2) : String(row[c.key] ?? ""))))];
    const blob = new Blob([lines.map((l) => l.map((x) => `"${x.replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sel}-${year}.csv`;
    a.click();
  };

  if (cat.isLoading) return <Loading />;
  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-5 items-start">
      <div className="space-y-2 no-print">
        {cat.data?.map((r) => (
          <button key={r.id} onClick={() => setSel(r.id)} className={cn("w-full text-left rounded-lg border p-4 transition-colors cursor-pointer", sel === r.id ? "border-brand bg-tint" : "border-line bg-white hover:border-brand/40")}>
            <div className="flex items-center gap-2">
              <FileBarChart className={cn("size-4", sel === r.id ? "text-brand" : "text-muted")} />
              <span className="font-semibold text-ink text-sm flex-1">{r.name}</span>
              {!r.unlocked && <Lock className="size-3.5 text-muted" />}
            </div>
            <p className="text-xs text-muted mt-1 leading-snug">{r.description}</p>
            {!r.unlocked && <p className="text-[11px] font-semibold text-brand mt-1.5 uppercase tracking-wide">{r.planName} plan</p>}
          </button>
        ))}
      </div>
      <Card
        title={item?.name ?? "Report"}
        action={
          item?.unlocked && (
            <div className="flex items-center gap-2 no-print">
              <Select className="w-28 h-9" value={year} onChange={(e) => setYear(Number(e.target.value))}>{YEARS.map((y) => <option key={y}>{y}</option>)}</Select>
              <Button size="sm" variant="ghost" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button>
              <Button size="sm" variant="outline" icon={csv ? <Download className="size-4" /> : <Lock className="size-3.5" />} disabled={!csv || !rep.data} title={csv ? "" : "CSV export is a Pro feature"} onClick={exportCsv}>CSV</Button>
            </div>
          )
        }
        bodyClass="p-0"
      >
        {!item?.unlocked ? (
          <Empty icon={<Lock />} title={`${item?.name} is on the ${item?.planName} plan`} action={role === "landlord" ? <Link href="/billing"><Button>See plans</Button></Link> : undefined}>
            {role === "landlord" ? "Upgrade to unlock this report and the rest of the reporting suite." : "Ask the property owner to upgrade to unlock this report."}
          </Empty>
        ) : rep.isLoading ? (
          <Loading label="Building report…" />
        ) : rep.error ? (
          <div className="p-5"><ErrorNote error={rep.error} /></div>
        ) : rep.data ? (
          <div>
            <div className="px-5 py-3 border-b border-line text-sm text-muted">{rep.data.subtitle}</div>
            {!rep.data.rows.length ? (
              <Empty title="No data for this period" />
            ) : (
              <Table>
                <thead><tr>{rep.data.columns.map((c) => <th key={c.key} className={cn(c.type === "money" || c.type === "number" ? "!text-right" : "")}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {rep.data.rows.map((row, i) => (
                    <tr key={i} className={cn(row._heading ? "bg-app/60 font-semibold" : "")}>
                      {rep.data!.columns.map((c) => (
                        <td key={c.key} className={cn(c.type === "money" || c.type === "number" ? "text-right tabular-nums" : "", c.type === "money" && Number(row[c.key]) < 0 && "text-bad")}>
                          {c.type === "pill" ? (row[c.key] ? <Pill>{String(row[c.key])}</Pill> : null) : fmt(row[c.key], c.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rep.data.totals && (
                    <tr className="bg-tint/60 font-bold text-ink">
                      {rep.data.columns.map((c) => <td key={c.key} className={cn(c.type === "money" || c.type === "number" ? "text-right tabular-nums" : "")}>{c.type === "pill" ? "" : fmt(rep.data!.totals![c.key], c.type)}</td>)}
                    </tr>
                  )}
                </tbody>
              </Table>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
