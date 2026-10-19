import { useState } from "react";
import { HandCoins, Plus, Check, X, BookOpen, BellRing } from "lucide-react";
import { Link } from "wouter";
import { PageHeader, Card, Button, Loading, Empty, Pill, Table, Tabs, Modal, Field, Input, Select, Textarea, ErrorNote, Stat } from "../../components/ui/kit";
import { useRentRoll, useRecordPayment, useReviewPayment, useSendReminders } from "../../queries/rent";
import { LedgerModal } from "../../components/ledger";
import { METHODS, type Method } from "../../lib/constants";
import { money, fmtDate, toCents, fromCents, todayISO, errMsg, timeAgo } from "../../lib/format";


function RemindersButton({ disabled }: { disabled?: boolean }) {
  const send = useSendReminders();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="relative">
      <Button
        variant="outline"
        icon={<BellRing className="size-4" />}
        disabled={disabled}
        loading={send.isPending}
        onClick={async () => {
          setMsg(null);
          try {
            const r = await send.mutateAsync(undefined);
            const sent = r.reminders + r.overdue;
            const parts = [sent ? `${r.reminders} reminder${r.reminders === 1 ? "" : "s"} and ${r.overdue} overdue notice${r.overdue === 1 ? "" : "s"} sent` : "No new reminders to send"];
            if (r.skipped) parts.push(`${r.skipped} skipped (demo addresses)`);
            if (r.failed) parts.push(`${r.failed} failed: ${r.errors[0] ?? "unknown error"}`);
            setMsg({ ok: !r.failed, text: parts.join(" · ") });
          } catch (e) {
            setMsg({ ok: false, text: errMsg(e) });
          }
        }}
      >
        Send reminders now
      </Button>
      {msg && (
        <div className={`absolute right-0 top-12 z-20 w-80 rounded-lg border bg-white p-3 text-xs shadow-lg ${msg.ok ? "border-line text-body" : "border-warn text-warn"}`}>
          <p className="font-semibold">{msg.text}</p>
          <p className="mt-1 text-muted">Tenants due within your reminder window, overdue past grace, or carrying a balance are emailed once. <Link href="/billing" className="text-brand font-semibold">Reminder settings</Link></p>
          <button className="absolute top-1.5 right-2 text-muted hover:text-ink cursor-pointer" onClick={() => setMsg(null)} aria-label="Dismiss"><X className="size-3.5" /></button>
        </div>
      )}
    </div>
  );
}

export default function RentPage() {
  const q = useRentRoll();
  const review = useReviewPayment();
  const [tab, setTab] = useState<"roll" | "payments">("roll");
  const [record, setRecord] = useState<{ leaseId: number; amount: number } | null>(null);
  const [ledger, setLedger] = useState<{ id: number; name: string } | null>(null);
  if (q.isLoading) return <Loading />;
  const d = q.data!;
  const pending = d.payments.filter((p) => p.status === "reported");
  return (
    <div>
      <PageHeader icon={<HandCoins />} title="Rent Collection" subtitle="Track rent paid by Zelle, check or cash — tenants can report payments from their portal." actions={<><RemindersButton disabled={!d.rows.length} /><Button icon={<Plus className="size-4" />} disabled={!d.rows.length} onClick={() => setRecord({ leaseId: d.rows[0].lease.id, amount: Math.max(0, d.rows[0].balance) })}>Record payment</Button></>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
        <div className="bg-white border border-line rounded-lg p-5"><Stat label="Expected this month" value={money(d.totals.expected, { cents: false })} /></div>
        <div className="bg-white border border-line rounded-lg p-5"><Stat label="Collected this month" value={money(d.totals.collectedThisMonth, { cents: false })} tone="ok" /></div>
        <div className="bg-white border border-line rounded-lg p-5"><Stat label="Outstanding" value={money(d.totals.outstanding, { cents: false })} tone={d.totals.outstanding > 0 ? "bad" : undefined} /></div>
        <div className="bg-white border border-line rounded-lg p-5"><Stat label="Awaiting confirmation" value={money(d.totals.pending, { cents: false })} tone={d.totals.pending ? "warn" : undefined} sub={`${pending.length} reported by tenants`} /></div>
      </div>

      {pending.length > 0 && (
        <Card title="Tenant-reported payments" info="Tenants report Zelle/check/cash payments; confirm once the money has landed." className="mb-6 border-warn/40" bodyClass="p-0">
          <Table>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id}>
                  <td><p className="font-semibold text-ink">{p.lease?.tenantName}</p><p className="text-xs text-muted">Reported {timeAgo(p.createdAt)}</p></td>
                  <td className="font-semibold">{money(p.amount)}</td>
                  <td className="capitalize">{p.method}{p.reference && <span className="text-muted"> · {p.reference}</span>}</td>
                  <td className="text-muted">Paid {fmtDate(p.paidAt)}{p.note && ` · “${p.note}”`}</td>
                  <td className="text-right whitespace-nowrap">
                    <Button size="sm" variant="success" icon={<Check className="size-4" />} loading={review.isPending && review.variables?.id === p.id && review.variables.decision === "confirmed"} onClick={() => review.mutate({ id: p.id, decision: "confirmed" })}>Confirm</Button>
                    <Button size="sm" variant="ghost" className="ml-1 text-bad" icon={<X className="size-4" />} onClick={() => review.mutate({ id: p.id, decision: "rejected" })}>Reject</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card bodyClass="p-0">
        <div className="px-5 pt-2"><Tabs value={tab} onChange={setTab} tabs={[{ id: "roll", label: "Rent roll", count: d.rows.length }, { id: "payments", label: "Payment history", count: d.payments.length }]} /></div>
        {tab === "roll" ? (
          !d.rows.length ? (
            <Empty icon={<HandCoins />} title="No active leases">Once a lease is signed, its rent schedule shows up here.</Empty>
          ) : (
            <Table>
              <thead><tr><th>Tenant</th><th>Unit</th><th className="!text-right">Rent</th><th className="!text-right">Paid to date</th><th className="!text-right">Balance</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.lease.id}>
                    <td><p className="font-semibold text-ink">{r.lease.tenantName}</p><p className="text-xs text-muted">Due on the {r.lease.dueDay}{r.lease.dueDay === 1 ? "st" : "th"}</p></td>
                    <td>{r.property?.name} · {r.unit?.name}</td>
                    <td className="text-right">{money(r.lease.rent)}</td>
                    <td className="text-right">{money(r.paid)}</td>
                    <td className={`text-right font-semibold ${r.balance > 0 ? "text-bad" : "text-ink"}`}>{money(r.balance)}</td>
                    <td><Pill>{r.status}</Pill></td>
                    <td className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" icon={<BookOpen className="size-4" />} onClick={() => setLedger({ id: r.lease.id, name: r.lease.tenantName })}>Ledger</Button>
                      <Button size="sm" variant="outline" className="ml-1" onClick={() => setRecord({ leaseId: r.lease.id, amount: Math.max(0, r.balance) })}>Record</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        ) : !d.payments.length ? (
          <Empty title="No payments yet" />
        ) : (
          <Table>
            <thead><tr><th>Date</th><th>Tenant</th><th>Method</th><th>Reference</th><th>Source</th><th className="!text-right">Amount</th><th>Status</th></tr></thead>
            <tbody>
              {d.payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{fmtDate(p.paidAt)}</td>
                  <td>{p.lease?.tenantName}</td>
                  <td className="capitalize">{p.method}</td>
                  <td className="text-muted">{p.reference || "—"}</td>
                  <td className="text-muted capitalize">{p.reportedBy}</td>
                  <td className="text-right font-semibold">{money(p.amount)}</td>
                  <td><Pill>{p.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {record && <RecordModal leases={d.rows.map((r) => ({ id: r.lease.id, label: `${r.lease.tenantName} — ${r.property?.name ?? ""} ${r.unit?.name ?? ""}`, balance: r.balance }))} initial={record} onClose={() => setRecord(null)} />}
      <LedgerModal leaseId={ledger?.id ?? null} title={`Tenant ledger — ${ledger?.name ?? ""}`} onClose={() => setLedger(null)} />
    </div>
  );
}

function RecordModal({ leases, initial, onClose }: { leases: { id: number; label: string; balance: number }[]; initial: { leaseId: number; amount: number }; onClose: () => void }) {
  const rec = useRecordPayment();
  const [f, setF] = useState({ leaseId: String(initial.leaseId), amount: fromCents(initial.amount), method: "zelle" as Method, reference: "", paidAt: todayISO(), note: "" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal
      open
      onClose={onClose}
      title="Record a payment"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={rec.isPending} onClick={async () => { try { await rec.mutateAsync({ leaseId: Number(f.leaseId), amount: toCents(f.amount), method: f.method, reference: f.reference, paidAt: f.paidAt, note: f.note }); onClose(); } catch (e) { setErr(errMsg(e)); } }}>Save payment</Button></>}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Lease" className="sm:col-span-2">
          <Select value={f.leaseId} onChange={(e) => { const l = leases.find((x) => x.id === Number(e.target.value)); setF((x) => ({ ...x, leaseId: e.target.value, amount: fromCents(Math.max(0, l?.balance ?? 0)) })); }}>
            {leases.map((l) => <option key={l.id} value={l.id}>{l.label} (bal. {money(l.balance)})</option>)}
          </Select>
        </Field>
        <Field label="Amount ($)"><Input type="number" step="0.01" value={f.amount} onChange={set("amount")} /></Field>
        <Field label="Date received"><Input type="date" value={f.paidAt} onChange={set("paidAt")} /></Field>
        <Field label="Method"><Select value={f.method} onChange={set("method")}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label={f.method === "check" ? "Check #" : "Reference"}><Input value={f.reference} onChange={set("reference")} placeholder={f.method === "zelle" ? "Zelle confirmation" : ""} /></Field>
        <Field label="Note" className="sm:col-span-2"><Textarea rows={2} value={f.note} onChange={set("note")} /></Field>
      </div>
      <p className="text-xs text-muted mt-3">Recorded payments post to the tenant ledger and to Cash Management as rental income.</p>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}
