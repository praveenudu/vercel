import { useState } from "react";
import { Link } from "wouter";
import { ReceiptText, Check, X, Paperclip, Banknote, ShieldCheck } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Table, Tabs, Modal, Field, Input, Select, Textarea, ErrorNote, Stat } from "../../components/ui/kit";
import { useInvoices, useDecideInvoice, usePayInvoice } from "../../queries/invoices";
import { useFeature, UpgradeNote } from "../../components/plan-gate";
import { METHODS } from "../../lib/constants";
import { money, fmtDate, fmtDateTime, todayISO, errMsg } from "../../lib/format";
import { openFile } from "../../lib/upload";
import { categoryLabel } from "../../../shared/plans";

type Inv = NonNullable<ReturnType<typeof useInvoices>["data"]>["rows"][number];
type Filter = "pending" | "approved" | "paid" | "rejected" | "all";

export default function InvoicesPage() {
  const q = useInvoices();
  const enabled = useFeature("invoices");
  const [tab, setTab] = useState<Filter>("pending");
  const [sel, setSel] = useState<Inv | null>(null);
  if (q.isLoading) return <Loading />;
  const d = q.data!;
  const isPending = (s: string) => s === "submitted" || s === "pending_second";
  const rows = d.rows.filter((r) => (tab === "all" ? true : tab === "pending" ? isPending(r.status) : r.status === tab));
  const sum = (f: (r: Inv) => boolean) => d.rows.filter(f).reduce((t, r) => t + r.amount, 0);
  const current = sel ? d.rows.find((r) => r.id === sel.id) ?? sel : null;
  return (
    <div>
      <PageHeader icon={<ReceiptText />} title="Invoices" subtitle="Vendor invoices with an approval workflow before anything gets paid." />
      {!enabled && <UpgradeNote feature="invoices" className="mb-5">Vendors can still submit invoices — upgrade to approve, pay and auto-post them to your books.</UpgradeNote>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
        <div className="bg-white border border-line rounded-lg p-5"><Stat label="Awaiting approval" value={money(sum((r) => isPending(r.status)), { cents: false })} tone="warn" sub={`${d.rows.filter((r) => isPending(r.status)).length} invoices`} /></div>
        <div className="bg-white border border-line rounded-lg p-5"><Stat label="Approved, unpaid" value={money(sum((r) => r.status === "approved"), { cents: false })} /></div>
        <div className="bg-white border border-line rounded-lg p-5"><Stat label={`Paid ${new Date().getFullYear()}`} value={money(sum((r) => r.status === "paid" && (r.paidAt ?? "").startsWith(String(new Date().getFullYear()))), { cents: false })} tone="ok" /></div>
        <div className="bg-white border border-line rounded-lg p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Approval rule</p>
          <p className="text-sm text-ink mt-1.5 font-semibold flex items-center gap-1.5"><ShieldCheck className="size-4 text-brand" />{d.twoStep ? `2-step over ${money(d.threshold, { cents: false })}` : "Single approval"}</p>
          <Link href="/billing" className="text-xs text-brand font-semibold">Change threshold →</Link>
        </div>
      </div>
      <Card bodyClass="p-0">
        <div className="px-5 pt-2"><Tabs value={tab} onChange={setTab} tabs={[{ id: "pending", label: "Needs approval", count: d.rows.filter((r) => isPending(r.status)).length }, { id: "approved", label: "Approved" }, { id: "paid", label: "Paid" }, { id: "rejected", label: "Rejected" }, { id: "all", label: "All" }]} /></div>
        {!rows.length ? (
          <Empty icon={<ReceiptText />} title="Nothing here">Invoices submitted by vendors from their portal appear in this queue.</Empty>
        ) : (
          <Table>
            <thead><tr><th>Invoice</th><th>Vendor</th><th>Property</th><th>Category</th><th>Due</th><th className="!text-right">Amount</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => setSel(r)}>
                  <td><p className="font-semibold text-ink">#{r.number}</p><p className="text-xs text-muted truncate max-w-[220px]">{r.request?.title ?? r.description}</p></td>
                  <td>{r.vendor?.company || r.vendor?.name}</td>
                  <td>{r.property?.name}</td>
                  <td>{categoryLabel(r.category)}</td>
                  <td className="whitespace-nowrap">{fmtDate(r.dueDate)}</td>
                  <td className="text-right font-semibold">{money(r.amount)}</td>
                  <td><Pill>{r.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {current && <InvoiceModal inv={current} enabled={enabled} threshold={d.threshold} twoStep={d.twoStep} onClose={() => setSel(null)} />}
    </div>
  );
}

function InvoiceModal({ inv, enabled, threshold, twoStep, onClose }: { inv: Inv; enabled: boolean; threshold: number; twoStep: boolean; onClose: () => void }) {
  const decide = useDecideInvoice();
  const pay = usePayInvoice();
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("check");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [err, setErr] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); } catch (e) { setErr(errMsg(e)); } };
  const pending = inv.status === "submitted" || inv.status === "pending_second";
  return (
    <Modal open onClose={onClose} wide title={`Invoice #${inv.number} — ${inv.vendor?.company || inv.vendor?.name || ""}`}>
      <div className="flex flex-wrap gap-6 text-sm mb-5">
        <div><p className="text-xs text-muted">Property</p><p className="font-semibold text-ink">{inv.property?.name}</p></div>
        <div><p className="text-xs text-muted">Work order</p><p className="font-semibold text-ink">{inv.request ? <Link href={`/maintenance/${inv.request.id}`} className="text-brand">{inv.request.title}</Link> : "—"}</p></div>
        <div><p className="text-xs text-muted">Category</p><p className="font-semibold text-ink">{categoryLabel(inv.category)}</p></div>
        <div><p className="text-xs text-muted">Due</p><p className="font-semibold text-ink">{fmtDate(inv.dueDate)}</p></div>
        <div className="ml-auto"><Pill className="text-sm">{inv.status}</Pill></div>
      </div>
      {inv.description && <p className="text-sm text-body mb-4">{inv.description}</p>}
      <div className="border border-line rounded-lg overflow-hidden">
        <Table>
          <thead><tr><th>Item</th><th className="!text-right">Qty</th><th className="!text-right">Unit price</th><th className="!text-right">Total</th></tr></thead>
          <tbody>
            {inv.lineItems.map((li, i) => (
              <tr key={i}><td>{li.description}</td><td className="text-right">{li.qty}</td><td className="text-right">{money(li.unitPrice)}</td><td className="text-right font-semibold">{money(Math.round(li.qty * li.unitPrice))}</td></tr>
            ))}
            <tr><td colSpan={3} className="text-right font-semibold">Total</td><td className="text-right text-lg font-bold text-ink">{money(inv.amount)}</td></tr>
          </tbody>
        </Table>
      </div>
      {inv.attachmentKey && <button onClick={() => openFile(inv.attachmentKey!, inv.attachmentName ?? undefined)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand cursor-pointer"><Paperclip className="size-4" />{inv.attachmentName || "Attachment"}</button>}

      {inv.approvals.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Approval trail</p>
          <ul className="space-y-1.5 text-sm">
            {inv.approvals.map((a, i) => (
              <li key={i} className="flex items-center gap-2">{a.decision === "approved" ? <Check className="size-4 text-ok" /> : <X className="size-4 text-bad" />}<span className="text-ink font-medium">Step {a.step} · {a.decision} by {a.by}</span><span className="text-muted">{fmtDateTime(a.at)}{a.note && ` — “${a.note}”`}</span></li>
            ))}
          </ul>
        </div>
      )}
      {inv.status === "paid" && <p className="mt-4 text-sm text-ok font-semibold flex items-center gap-1.5"><Banknote className="size-4" />Paid {fmtDate(inv.paidAt)} via {inv.paidMethod} — posted to Cash Management.</p>}

      {pending && (
        <div className="mt-6 border-t border-line pt-5">
          {!enabled ? (
            <UpgradeNote feature="invoices" />
          ) : (
            <>
              {twoStep && inv.amount > threshold && <p className="text-xs text-warn font-semibold mb-2">Over your {money(threshold, { cents: false })} threshold — requires two approvals{inv.status === "pending_second" ? " (step 2 of 2)" : " (step 1 of 2)"}.</p>}
              <Textarea rows={2} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="ghost" className="text-bad" icon={<X className="size-4" />} loading={decide.isPending && decide.variables?.decision === "rejected"} onClick={() => act(() => decide.mutateAsync({ id: inv.id, decision: "rejected", note }))}>Reject</Button>
                <Button variant="success" icon={<Check className="size-4" />} loading={decide.isPending && decide.variables?.decision === "approved"} onClick={() => act(() => decide.mutateAsync({ id: inv.id, decision: "approved", note }))}>{inv.status === "pending_second" ? "Give final approval" : "Approve"}</Button>
              </div>
            </>
          )}
        </div>
      )}
      {inv.status === "approved" && (
        <div className="mt-6 border-t border-line pt-5 grid sm:grid-cols-3 gap-3 items-end">
          <Field label="Paid via"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Date paid"><Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>
          <Button icon={<Banknote className="size-4" />} loading={pay.isPending} onClick={() => act(() => pay.mutateAsync({ id: inv.id, method, paidAt }))}>Mark as paid</Button>
        </div>
      )}
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}
