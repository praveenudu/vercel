import { useState } from "react";
import { HandCoins, Wrench, FolderOpen, Plus, FileText, FileSignature, ExternalLink } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Table, Modal, Field, Input, Select, Textarea, ErrorNote } from "../../components/ui/kit";
import { useMyLeases } from "../../queries/leases";
import { useMyPayments, useReportPayment } from "../../queries/rent";
import { useRequests, useCreateRequest } from "../../queries/maintenance";
import { useMyDocuments } from "../../queries/documents";
import { LedgerTable } from "../../components/ledger";
import { PhotoThumb, PhotoUploader, PriorityPill } from "../../components/maintenance-parts";
import { useMeData } from "../../components/session";
import { METHODS, MAINT_CATEGORIES, type Method } from "../../lib/constants";
import { money, fmtDate, toCents, fromCents, todayISO, errMsg, timeAgo, titleCase } from "../../lib/format";
import { openFile } from "../../lib/upload";

function useActiveLease() {
  const q = useMyLeases();
  return { ...q, lease: (q.data ?? []).find((l) => l.status === "active") ?? null };
}

export function TenantPayments() {
  const { lease, isLoading } = useActiveLease();
  const pays = useMyPayments();
  const me = useMeData();
  const [open, setOpen] = useState(false);
  if (isLoading) return <Loading />;
  return (
    <div>
      <PageHeader icon={<HandCoins />} title="Rent & Payments" subtitle={`Pay ${me.ownerName} by Zelle, check or cash — then report it here.`} actions={lease && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Report a payment</Button>} />
      {!lease ? (
        <Card><Empty icon={<HandCoins />} title="No active lease">Your ledger starts once your lease is fully signed.</Empty></Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2" title="Ledger" bodyClass="p-0"><LedgerTable leaseId={lease.id} /></Card>
          <div className="space-y-5">
            <Card title="How to pay">
              <ol className="text-sm text-body space-y-2 list-decimal list-inside">
                <li>Send {money(lease.rent)} to {me.ownerName} via Zelle, check or cash by the {lease.dueDay}{lease.dueDay === 1 ? "st" : "th"}.</li>
                <li>Click <b>Report a payment</b> and add the Zelle confirmation or check number.</li>
                <li>Your landlord confirms it and it posts to your ledger.</li>
              </ol>
            </Card>
            <Card title="Payment history" bodyClass="p-0">
              {!pays.data?.length ? (
                <p className="p-5 text-sm text-muted">No payments yet.</p>
              ) : (
                <div className="divide-y divide-line">
                  {pays.data.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <div className="flex-1"><p className="font-semibold text-ink">{money(p.amount)}</p><p className="text-xs text-muted capitalize">{p.method} · {fmtDate(p.paidAt)}</p></div>
                      <Pill>{p.status}</Pill>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
      {open && lease && <ReportModal leaseId={lease.id} amount={Math.max(0, lease.balance.balance - lease.balance.pending) || lease.rent} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ReportModal({ leaseId, amount, onClose }: { leaseId: number; amount: number; onClose: () => void }) {
  const report = useReportPayment();
  const [f, setF] = useState({ amount: fromCents(amount), method: "zelle" as Method, reference: "", paidAt: todayISO(), note: "" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title="Report a rent payment" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={report.isPending} onClick={async () => { try { await report.mutateAsync({ leaseId, amount: toCents(f.amount), method: f.method, reference: f.reference, paidAt: f.paidAt, note: f.note }); onClose(); } catch (e) { setErr(errMsg(e)); } }}>Submit</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Amount ($)"><Input type="number" step="0.01" value={f.amount} onChange={set("amount")} /></Field>
        <Field label="Date paid"><Input type="date" value={f.paidAt} onChange={set("paidAt")} /></Field>
        <Field label="Method"><Select value={f.method} onChange={set("method")}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label={f.method === "check" ? "Check #" : "Confirmation / reference"}><Input value={f.reference} onChange={set("reference")} /></Field>
        <Field label="Note (optional)" className="sm:col-span-2"><Textarea rows={2} value={f.note} onChange={set("note")} /></Field>
      </div>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}

export function TenantMaintenance() {
  const { lease, isLoading } = useActiveLease();
  const q = useRequests();
  const [open, setOpen] = useState(false);
  if (isLoading || q.isLoading) return <Loading />;
  return (
    <div>
      <PageHeader icon={<Wrench />} title="Maintenance" subtitle="Report an issue with photos — we’ll keep you posted as it moves along." actions={lease && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>New request</Button>} />
      {!q.data?.length ? (
        <Card><Empty icon={<Wrench />} title="No requests" action={lease && <Button onClick={() => setOpen(true)}>Submit a request</Button>}>Leaky faucet? Broken heater? Let your landlord know here.</Empty></Card>
      ) : (
        <div className="space-y-4 stagger">
          {q.data.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-ink">{r.title}</p>
                  <p className="text-xs text-muted mt-0.5">{titleCase(r.category)} · submitted {timeAgo(r.createdAt)}</p>
                </div>
                <PriorityPill p={r.priority} />
                <Pill>{r.status}</Pill>
              </div>
              {r.description && <p className="text-sm text-body mt-3">{r.description}</p>}
              {r.photos.length > 0 && <div className="flex gap-2 mt-3">{r.photos.map((p) => <PhotoThumb key={p.key} file={p} />)}</div>}
              <Progress status={r.status} />
              {(r.vendor || r.scheduledFor) && <p className="text-sm text-body mt-3">{r.vendor && <>Assigned to <b>{r.vendor.company || r.vendor.name}</b></>}{r.scheduledFor && <> · scheduled for <b>{fmtDate(r.scheduledFor)}</b></>}</p>}
            </Card>
          ))}
        </div>
      )}
      {open && <TenantRequestModal onClose={() => setOpen(false)} />}
    </div>
  );
}

const STEPS = ["new", "assigned", "scheduled", "in_progress", "completed"];
function Progress({ status }: { status: string }) {
  const idx = status === "closed" ? 4 : STEPS.indexOf(status);
  return (
    <div className="mt-4 flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s} className="flex-1">
          <div className={`h-1.5 rounded-full ${i <= idx ? "bg-brand" : "bg-line"}`} />
          <p className={`text-[10px] mt-1 font-semibold uppercase tracking-wide ${i <= idx ? "text-brand" : "text-muted"}`}>{titleCase(s)}</p>
        </div>
      ))}
    </div>
  );
}

function TenantRequestModal({ onClose }: { onClose: () => void }) {
  const create = useCreateRequest();
  const [f, setF] = useState({ title: "", description: "", category: "plumbing", priority: "normal" as "low" | "normal" | "high" | "emergency", entry: true });
  const [photos, setPhotos] = useState<{ key: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title="New maintenance request" wide footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={create.isPending} onClick={async () => { try { await create.mutateAsync({ title: f.title, description: f.description, category: f.category, priority: f.priority, entryPermission: f.entry, photos }); onClose(); } catch (e) { setErr(errMsg(e)); } }}>Submit request</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="What’s wrong?" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} placeholder="e.g. Kitchen sink is leaking" /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => setF((x) => ({ ...x, category: e.target.value }))}>{MAINT_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
        <Field label="Urgency"><Select value={f.priority} onChange={(e) => setF((x) => ({ ...x, priority: e.target.value as typeof f.priority }))}><option value="low">Low — whenever</option><option value="normal">Normal</option><option value="high">High — this week</option><option value="emergency">Emergency — flooding, no heat, gas</option></Select></Field>
        <Field label="Details" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} placeholder="When did it start? Where exactly?" /></Field>
        <div className="sm:col-span-2"><p className="text-[13px] font-semibold text-ink mb-1.5">Photos</p><PhotoUploader value={photos} onChange={setPhotos} /></div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm text-body cursor-pointer"><input type="checkbox" aria-label="Permission to enter" className="size-4 accent-brand" checked={f.entry} onChange={(e) => setF((x) => ({ ...x, entry: e.target.checked }))} />Maintenance may enter if I’m not home</label>
      </div>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}

export function TenantDocuments() {
  const q = useMyDocuments();
  return (
    <div>
      <PageHeader icon={<FolderOpen />} title="Documents" subtitle="Your lease and anything your landlord has shared." />
      <Card bodyClass="p-0">
        {q.isLoading ? (
          <Loading />
        ) : !q.data?.length ? (
          <Empty icon={<FolderOpen />} title="No documents yet">Your executed lease will appear here once it’s signed by both parties.</Empty>
        ) : (
          <Table>
            <thead><tr><th>Name</th><th>Added</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {q.data.map((d) => (
                <tr key={d.id}>
                  <td className="flex items-center gap-2"><span className="size-8 rounded-md bg-tint text-brand grid place-items-center">{d.category === "lease" ? <FileSignature className="size-4" /> : <FileText className="size-4" />}</span><span className="font-semibold text-ink">{d.name}</span></td>
                  <td className="text-muted">{fmtDate(d.createdAt)}</td>
                  <td className="text-right">
                    {d.fileKey ? (
                      <Button size="sm" variant="outline" icon={<ExternalLink className="size-3.5" />} onClick={() => openFile(d.fileKey!, d.name)}>Open</Button>
                    ) : d.leaseId ? (
                      <a href={`/leases/${d.leaseId}/print`} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" icon={<ExternalLink className="size-3.5" />}>Open</Button></a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
