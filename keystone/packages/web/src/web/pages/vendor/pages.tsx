import { useState } from "react";
import { ClipboardList, ReceiptText, Plus, Trash2, Paperclip, MapPin, CalendarClock, KeyRound } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Table, Modal, Field, Input, Select, Textarea, ErrorNote, Tabs, StatBox } from "../../components/ui/kit";
import { useRequests, useUpdateRequestStatus, useVendorMe } from "../../queries/maintenance";
import { useInvoices, useSubmitInvoice } from "../../queries/invoices";
import { PhotoThumb, PriorityPill } from "../../components/maintenance-parts";
import { useMeData } from "../../components/session";
import { money, fmtDate, toCents, todayISO, errMsg, timeAgo, titleCase } from "../../lib/format";
import { uploadFile, openFile } from "../../lib/upload";
import { SCHEDULE_E_EXPENSES } from "../../../shared/plans";

type Req = NonNullable<ReturnType<typeof useRequests>["data"]>[number];
const VENDOR_STATUSES = [["assigned", "Assigned"], ["scheduled", "Scheduled"], ["in_progress", "In progress"], ["completed", "Completed"]] as const;
type VStatus = (typeof VENDOR_STATUSES)[number][0];

export function VendorWorkOrders() {
  const reqs = useRequests();
  const vendor = useVendorMe();
  const me = useMeData();
  const [tab, setTab] = useState<"open" | "done">("open");
  const [edit, setEdit] = useState<Req | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<Req | null>(null);
  if (reqs.isLoading) return <Loading />;
  const all = reqs.data ?? [];
  const open = all.filter((r) => !["completed", "closed"].includes(r.status));
  const done = all.filter((r) => ["completed", "closed"].includes(r.status));
  const rows = tab === "open" ? open : done;
  return (
    <div>
      <PageHeader icon={<ClipboardList />} title="Work Orders" subtitle={`Jobs assigned to ${vendor.data?.company || vendor.data?.name || "you"} by ${me.ownerName}.`} />
      <div className="grid sm:grid-cols-3 gap-4 mb-5 stagger">
        <StatBox label="Open jobs" value={open.length} />
        <StatBox label="Emergency / high" value={open.filter((r) => ["emergency", "high"].includes(r.priority)).length} tone={open.some((r) => r.priority === "emergency") ? "bad" : undefined} />
        <StatBox label="Awaiting invoice" value={done.filter((r) => !r.invoices.length).length} tone={done.some((r) => !r.invoices.length) ? "warn" : undefined} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "open", label: "Open", count: open.length }, { id: "done", label: "Completed", count: done.length }]} />
      <div className="space-y-3">
        {!rows.length ? (
          <Card><Empty icon={<ClipboardList />} title={tab === "open" ? "No open work orders" : "Nothing completed yet"}>New jobs appear here as soon as the landlord assigns them to you.</Empty></Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-ink">{r.title}</h3>
                    <PriorityPill p={r.priority} />
                    <Pill>{r.status}</Pill>
                  </div>
                  <p className="text-sm text-muted flex items-center gap-1.5"><MapPin className="size-3.5" />{r.property?.address ?? r.property?.name}{r.unit ? ` · ${r.unit.name}` : ""}</p>
                  {r.description && <p className="text-sm text-body mt-2">{r.description}</p>}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-muted">
                    <span>#{r.id} · {titleCase(r.category)} · opened {timeAgo(r.createdAt)}</span>
                    {r.scheduledFor && <span className="flex items-center gap-1"><CalendarClock className="size-3.5" />Scheduled {fmtDate(r.scheduledFor)}</span>}
                    <span className="flex items-center gap-1"><KeyRound className="size-3.5" />{r.entryPermission ? "OK to enter without tenant" : "Coordinate entry with tenant"}</span>
                    {r.tenantName && <span>Tenant: {r.tenantName}</span>}
                  </div>
                  {r.vendorNotes && <p className="mt-3 text-sm bg-app rounded-lg px-3 py-2 text-body"><b className="text-ink">Your notes:</b> {r.vendorNotes}</p>}
                  {!!r.photos.length && <div className="flex gap-2 mt-3">{r.photos.map((p) => <PhotoThumb key={p.key} file={p} className="size-16" />)}</div>}
                  {!!r.invoices.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.invoices.map((i) => <span key={i.id} className="text-xs bg-tint text-brand rounded-full px-2.5 py-1 font-semibold">Invoice {i.number} · {money(i.amount)} · {i.status.replace("_", " ")}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex md:flex-col gap-2 shrink-0">
                  {r.status !== "closed" && <Button variant="outline" size="sm" onClick={() => setEdit(r)}>Update status</Button>}
                  <Button size="sm" icon={<ReceiptText className="size-4" />} onClick={() => setInvoiceFor(r)}>Submit invoice</Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      {edit && <StatusModal req={edit} onClose={() => setEdit(null)} />}
      {invoiceFor && <InvoiceModal req={invoiceFor} requests={all} onClose={() => setInvoiceFor(null)} />}
    </div>
  );
}

function StatusModal({ req, onClose }: { req: Req; onClose: () => void }) {
  const update = useUpdateRequestStatus();
  const initial: VStatus = (VENDOR_STATUSES.find(([v]) => v === req.status)?.[0] ?? "scheduled") as VStatus;
  const [status, setStatus] = useState<VStatus>(initial);
  const [scheduledFor, setScheduled] = useState(req.scheduledFor ?? "");
  const [notes, setNotes] = useState(req.vendorNotes ?? "");
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      await update.mutateAsync({ id: req.id, status, scheduledFor: scheduledFor || undefined, vendorNotes: notes });
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  return (
    <Modal open onClose={onClose} title={`Update · ${req.title}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={update.isPending} onClick={save}>Save update</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as VStatus)}>{VENDOR_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Scheduled visit"><Input type="date" value={scheduledFor} onChange={(e) => setScheduled(e.target.value)} /></Field>
        <Field label="Notes for the landlord" className="sm:col-span-2"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you found, parts ordered, next steps…" /></Field>
      </div>
      <p className="text-xs text-muted mt-3">Only the landlord can close a request once the work is verified.</p>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}

type Line = { description: string; qty: string; unitPrice: string };

function InvoiceModal({ req, requests, onClose }: { req: Req | null; requests: Req[]; onClose: () => void }) {
  const submit = useSubmitInvoice();
  const [requestId, setRequestId] = useState<string>(req ? String(req.id) : requests[0] ? String(requests[0].id) : "");
  const [number, setNumber] = useState(`INV-${String(Date.now()).slice(-5)}`);
  const [category, setCategory] = useState("repairs");
  const [description, setDescription] = useState(req ? req.title : "");
  const [due, setDue] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().slice(0, 10); });
  const [lines, setLines] = useState<Line[]>([{ description: "Labor", qty: "1", unitPrice: "" }]);
  const [file, setFile] = useState<{ key: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const total = lines.reduce((t, l) => t + Math.round(Number(l.qty || 0) * toCents(l.unitPrice)), 0);
  const setLine = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const save = async () => {
    setErr(null);
    const items = lines.filter((l) => l.description && Number(l.qty) > 0).map((l) => ({ description: l.description, qty: Number(l.qty), unitPrice: toCents(l.unitPrice) }));
    if (!requestId) return setErr("Pick the work order this invoice is for");
    if (!items.length) return setErr("Add at least one line item");
    try {
      await submit.mutateAsync({ requestId: Number(requestId), number, category, description, lineItems: items, dueDate: due, attachmentKey: file?.key, attachmentName: file?.name });
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  return (
    <Modal open wide onClose={onClose} title="Submit an invoice" footer={<><span className="mr-auto text-sm text-muted">Total <b className="text-ink text-base ml-1">{money(total)}</b></span><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={submit.isPending} onClick={save}>Submit for approval</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Work order" className="sm:col-span-2">
          <Select value={requestId} onChange={(e) => setRequestId(e.target.value)}>
            {requests.map((r) => <option key={r.id} value={r.id}>#{r.id} · {r.title} — {r.property?.name}{r.unit ? ` ${r.unit.name}` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Invoice #"><Input value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
        <Field label="Due date"><Input type="date" value={due} min={todayISO()} onChange={(e) => setDue(e.target.value)} /></Field>
        <Field label="Expense category" hint="Schedule E line the landlord will book it to">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>{SCHEDULE_E_EXPENSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
        </Field>
        <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      </div>
      <div className="mt-5">
        <p className="text-sm font-semibold text-ink mb-2">Line items</p>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_110px_90px_32px] gap-2 items-center">
              <Input placeholder="Description" value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} />
              <Input type="number" min="0" step="0.5" placeholder="Qty" value={l.qty} onChange={(e) => setLine(i, "qty", e.target.value)} />
              <Input type="number" min="0" step="0.01" placeholder="Unit $" value={l.unitPrice} onChange={(e) => setLine(i, "unitPrice", e.target.value)} />
              <span className="text-sm text-right font-medium text-ink">{money(Math.round(Number(l.qty || 0) * toCents(l.unitPrice)))}</span>
              <button className="text-muted hover:text-bad disabled:opacity-30" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="size-4" />} onClick={() => setLines((ls) => [...ls, { description: "", qty: "1", unitPrice: "" }])}>Add line</Button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-brand cursor-pointer">
          <Paperclip className="size-4" />{uploading ? "Uploading…" : file ? file.name : "Attach PDF or photo of invoice"}
          <input type="file" aria-label="Invoice attachment" className="hidden" accept="application/pdf,image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); try { setFile(await uploadFile(f)); } catch (x) { setErr(errMsg(x)); } finally { setUploading(false); } }} />
        </label>
        {file && <button className="text-xs text-muted underline" onClick={() => setFile(null)}>remove</button>}
      </div>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}

export function VendorInvoices() {
  const inv = useInvoices();
  const reqs = useRequests();
  const [open, setOpen] = useState(false);
  if (inv.isLoading) return <Loading />;
  const rows = inv.data?.rows ?? [];
  const outstanding = rows.filter((r) => ["submitted", "pending_second", "approved"].includes(r.status)).reduce((t, r) => t + r.amount, 0);
  const paidYtd = rows.filter((r) => r.status === "paid" && (r.paidAt ?? "").startsWith(String(new Date().getFullYear()))).reduce((t, r) => t + r.amount, 0);
  return (
    <div>
      <PageHeader icon={<ReceiptText />} title="Invoices" subtitle="Submit invoices against work orders and track approval and payment." actions={<Button icon={<Plus className="size-4" />} disabled={!reqs.data?.length} onClick={() => setOpen(true)}>New invoice</Button>} />
      <div className="grid sm:grid-cols-3 gap-4 mb-5 stagger">
        <StatBox label="Outstanding" value={money(outstanding)} sub="Submitted or approved, not yet paid" />
        <StatBox label="Paid this year" value={money(paidYtd)} tone="ok" />
        <StatBox label="Invoices" value={rows.length} />
      </div>
      <Card bodyClass="p-0">
        {!rows.length ? (
          <Empty icon={<ReceiptText />} title="No invoices yet">Finish a job, then submit your invoice from the work order.</Empty>
        ) : (
          <Table>
            <thead><tr><th>Invoice</th><th>Work order</th><th>Property</th><th>Submitted</th><th>Due</th><th className="text-right">Amount</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold text-ink">{r.number}<p className="text-xs text-muted font-normal">{r.description}</p></td>
                  <td>{r.request ? `#${r.request.id} ${r.request.title}` : "—"}</td>
                  <td>{r.property?.name ?? "—"}</td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td>{r.status === "paid" ? <span className="text-ok">Paid {fmtDate(r.paidAt)}</span> : fmtDate(r.dueDate)}</td>
                  <td className="text-right font-semibold text-ink">{money(r.amount)}</td>
                  <td><Pill>{r.status}</Pill>{r.approvals.filter((a) => a.decision === "rejected").map((a, i) => <p key={i} className="text-xs text-bad mt-1">{a.note || "Rejected"}</p>)}</td>
                  <td>{r.attachmentKey && <button className="text-brand" title="Open attachment" onClick={() => openFile(r.attachmentKey!, r.attachmentName ?? undefined)}><Paperclip className="size-4" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {open && <InvoiceModal req={null} requests={reqs.data ?? []} onClose={() => setOpen(false)} />}
    </div>
  );
}
