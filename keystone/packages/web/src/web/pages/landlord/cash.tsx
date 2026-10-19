import { useMemo, useState } from "react";
import { Landmark, Plus, Trash2, Download, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Table, Modal, Field, Input, Select, ErrorNote, Stat } from "../../components/ui/kit";
import { PortfolioSelect } from "../../components/portfolio-select";
import { usePortfolio } from "../../components/session";
import { useTransactions, useCreateTransaction, useRemoveTransaction } from "../../queries/cash";
import { useProperties } from "../../queries/properties";
import { money, fmtDate, toCents, todayISO, errMsg } from "../../lib/format";
import { SCHEDULE_E_EXPENSES, INCOME_CATEGORIES, categoryLabel } from "../../../shared/plans";
import { cn } from "../../lib/utils";

const YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

export default function CashPage() {
  const { portfolioId } = usePortfolio();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <PageHeader icon={<Landmark />} title="Cash Management" subtitle="Every dollar in and out, tagged to IRS Schedule E categories." actions={<Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Add transaction</Button>}>
        <PortfolioSelect />
      </PageHeader>
      <TransactionsView portfolioId={portfolioId} />
      {open && <AddTxModal onClose={() => setOpen(false)} />}
    </div>
  );
}

/** Shared by landlord (editable) and CPA (read-only). */
export function TransactionsView({ portfolioId, readOnly }: { portfolioId?: number | null; readOnly?: boolean }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [type, setType] = useState<"" | "income" | "expense">("");
  const [prop, setProp] = useState("");
  const [cat, setCat] = useState("");
  const q = useTransactions({ portfolioId: portfolioId ?? null, year, type: type || undefined });
  const remove = useRemoveTransaction();
  const all = useMemo(() => q.data?.rows ?? [], [q.data]);
  const propsList = useMemo(() => [...new Map(all.map((r) => [String(r.propertyId ?? "none"), r.propertyName])).entries()], [all]);
  const rows = all.filter((r) => (!prop || String(r.propertyId ?? "none") === prop) && (!cat || r.category === cat));
  const income = rows.filter((r) => r.type === "income").reduce((t, r) => t + r.amount, 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((t, r) => t + r.amount, 0);

  const exportCsv = () => {
    const head = ["Date", "Type", "Property", "Category", "Payee", "Description", "Amount", "Source"];
    const lines = rows.map((r) => [r.date, r.type, r.propertyName, categoryLabel(r.category), r.payee, r.description, (r.type === "expense" ? -r.amount : r.amount) / 100, r.source]);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `keystone-transactions-${year}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-4 mb-5 stagger">
        <div className="bg-white border border-line rounded-lg p-5"><Stat label={`Income · ${year}`} value={money(income, { cents: false })} tone="ok" /></div>
        <div className="bg-white border border-line rounded-lg p-5"><Stat label={`Expenses · ${year}`} value={money(expense, { cents: false })} tone="bad" /></div>
        <div className="bg-white border border-line rounded-lg p-5"><Stat label="Net cash flow" value={money(income - expense, { cents: false })} tone={income - expense >= 0 ? "ok" : "bad"} /></div>
      </div>
      <Card bodyClass="p-0">
        <div className="flex flex-wrap gap-2 p-4 border-b border-line">
          <Select className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>{YEARS.map((y) => <option key={y}>{y}</option>)}</Select>
          <Select className="w-36" value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="">All types</option><option value="income">Income</option><option value="expense">Expenses</option></Select>
          <Select className="w-48" value={prop} onChange={(e) => setProp(e.target.value)}><option value="">All properties</option>{propsList.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select>
          <Select className="w-56" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            <optgroup label="Income">{INCOME_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
            <optgroup label="Schedule E expenses">{SCHEDULE_E_EXPENSES.map((c) => <option key={c.id} value={c.id}>Line {c.line} · {c.label}</option>)}</optgroup>
          </Select>
          <Button variant="outline" className="ml-auto" icon={<Download className="size-4" />} onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
        </div>
        {q.isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty icon={<Landmark />} title="No transactions">Rent payments and paid invoices post here automatically. Add anything else manually.</Empty>
        ) : (
          <Table>
            <thead><tr><th>Date</th><th>Description</th><th>Property</th><th>Category</th><th>Source</th><th className="!text-right">Amount</th>{!readOnly && <th><span className="sr-only">Actions</span></th>}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-muted">{fmtDate(r.date)}</td>
                  <td aria-label={r.payee || r.description || "Transaction"}>
                    <div className="flex items-center gap-2">
                      <span className={cn("size-7 rounded-full grid place-items-center shrink-0", r.type === "income" ? "bg-ok-tint text-ok" : "bg-bad-tint text-bad")}>{r.type === "income" ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}</span>
                      <div className="min-w-0"><p className="font-semibold text-ink truncate max-w-[260px]">{r.payee || "—"}</p><p className="text-xs text-muted truncate max-w-[260px]">{r.description}</p></div>
                    </div>
                  </td>
                  <td>{r.propertyName}</td>
                  <td>{categoryLabel(r.category)}</td>
                  <td><Pill tone={r.source === "manual" ? "gray" : "blue"}>{r.source}</Pill></td>
                  <td className={cn("text-right font-semibold whitespace-nowrap", r.type === "income" ? "text-ok" : "text-ink")}>{r.type === "expense" ? "−" : "+"}{money(r.amount)}</td>
                  {!readOnly && <td className="text-right">{r.source === "manual" && <button title="Delete" className="text-muted hover:text-bad cursor-pointer" onClick={() => confirm("Delete this transaction?") && remove.mutate({ id: r.id })}><Trash2 className="size-4" /></button>}</td>}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function AddTxModal({ onClose }: { onClose: () => void }) {
  const create = useCreateTransaction();
  const props = useProperties(null);
  const [f, setF] = useState({ type: "expense" as "income" | "expense", date: todayISO(), amount: "", category: "repairs", propertyId: "", payee: "", description: "", account: "Operating" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal
      open
      onClose={onClose}
      title="Add transaction"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={create.isPending} onClick={async () => { try { await create.mutateAsync({ type: f.type, date: f.date, amount: toCents(f.amount), category: f.category, propertyId: f.propertyId ? Number(f.propertyId) : null, payee: f.payee, description: f.description, account: f.account }); onClose(); } catch (e) { setErr(errMsg(e)); } }}>Save</Button></>}
    >
      <div className="inline-flex rounded-md border border-line p-0.5 mb-4 bg-app">
        {(["expense", "income"] as const).map((t) => (
          <button key={t} onClick={() => setF((x) => ({ ...x, type: t, category: t === "income" ? "rents" : "repairs" }))} className={cn("px-4 h-8 rounded text-sm font-semibold capitalize cursor-pointer", f.type === t ? "bg-white text-brand shadow-sm" : "text-muted")}>{t}</button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Amount ($)"><Input type="number" step="0.01" value={f.amount} onChange={set("amount")} /></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={set("date")} /></Field>
        <Field label={f.type === "expense" ? "Schedule E category" : "Category"} className="sm:col-span-2">
          <Select value={f.category} onChange={set("category")}>
            {f.type === "expense" ? SCHEDULE_E_EXPENSES.map((c) => <option key={c.id} value={c.id}>Line {c.line} · {c.label}</option>) : INCOME_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Property"><Select value={f.propertyId} onChange={set("propertyId")}><option value="">Portfolio-wide</option>{(props.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label={f.type === "expense" ? "Payee" : "Payer"}><Input value={f.payee} onChange={set("payee")} /></Field>
        <Field label="Description" className="sm:col-span-2"><Input value={f.description} onChange={set("description")} /></Field>
      </div>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}
