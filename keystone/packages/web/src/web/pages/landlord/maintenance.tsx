import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Wrench, Plus, ArrowLeft, CalendarClock, User, HardHat, ReceiptText, KeyRound } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Modal, Field, Input, Select, Textarea, ErrorNote } from "../../components/ui/kit";
import { useRequests, useRequest, useCreateRequest, useAssignRequest, useUpdateRequestStatus, useVendors } from "../../queries/maintenance";
import { useProperties } from "../../queries/properties";
import { PhotoThumb, PhotoUploader, PriorityPill } from "../../components/maintenance-parts";
import { MAINT_CATEGORIES, MAINT_STATUSES, PRIORITIES, tradeLabel } from "../../lib/constants";
import { money, fmtDate, fmtDateTime, timeAgo, errMsg, titleCase } from "../../lib/format";
import { cn } from "../../lib/utils";

const COLUMNS = [
  { id: "new", label: "New", statuses: ["new"] },
  { id: "assigned", label: "Assigned / Scheduled", statuses: ["assigned", "scheduled"] },
  { id: "in_progress", label: "In progress", statuses: ["in_progress"] },
  { id: "done", label: "Completed", statuses: ["completed", "closed"] },
];

export function MaintenancePage() {
  const q = useRequests();
  const [open, setOpen] = useState(false);
  const rows = q.data ?? [];
  return (
    <div>
      <PageHeader icon={<Wrench />} title="Maintenance" subtitle="Requests from tenants, work orders for vendors, invoices for you." actions={<Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>New request</Button>} />
      {q.isLoading ? (
        <Loading />
      ) : !rows.length ? (
        <Card><Empty icon={<Wrench />} title="No maintenance requests">Tenants submit requests with photos from their portal. You can also log one yourself.</Empty></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-start">
          {COLUMNS.map((c) => {
            const items = rows.filter((r) => c.statuses.includes(r.status));
            return (
              <div key={c.id} className="rounded-lg bg-app/70 border border-line p-3">
                <div className="flex items-center justify-between px-1 pb-3">
                  <h3 className="text-sm font-bold text-ink">{c.label}</h3>
                  <span className="text-xs font-semibold text-muted bg-white rounded-full px-2 py-0.5 border border-line">{items.length}</span>
                </div>
                <div className="space-y-3 stagger">
                  {items.map((r) => (
                    <Link key={r.id} href={`/maintenance/${r.id}`} className={cn("block rounded-md bg-white border border-line p-3 hover:shadow-md transition-shadow", r.priority === "emergency" && "border-l-4 border-l-bad")}>
                      <div className="flex items-start gap-2">
                        <p className="font-semibold text-ink text-sm leading-snug flex-1">{r.title}</p>
                        <PriorityPill p={r.priority} />
                      </div>
                      <p className="text-xs text-muted mt-1">{r.property?.name} · {r.unit?.name}</p>
                      <div className="flex items-center gap-2 mt-3 text-xs text-muted">
                        {r.vendor ? <span className="flex items-center gap-1"><HardHat className="size-3.5" />{r.vendor.company || r.vendor.name}</span> : <span className="text-warn font-semibold">Unassigned</span>}
                        <span className="ml-auto">{timeAgo(r.createdAt)}</span>
                      </div>
                      {r.invoices.length > 0 && <p className="mt-2 text-xs text-brand font-semibold flex items-center gap-1"><ReceiptText className="size-3.5" />{r.invoices.length} invoice · {money(r.invoices.reduce((t, i) => t + i.amount, 0))}</p>}
                    </Link>
                  ))}
                  {!items.length && <p className="text-xs text-muted text-center py-6">Nothing here</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {open && <NewRequestModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const props = useProperties(null);
  const create = useCreateRequest();
  const [, nav] = useLocation();
  const [f, setF] = useState({ unitId: "", title: "", description: "", category: "general", priority: "normal" as (typeof PRIORITIES)[number] });
  const [photos, setPhotos] = useState<{ key: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title="New maintenance request" wide footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={create.isPending} onClick={async () => { try { const r = await create.mutateAsync({ unitId: Number(f.unitId) || undefined, title: f.title, description: f.description, category: f.category, priority: f.priority, entryPermission: true, photos }); nav(`/maintenance/${r.id}`); } catch (e) { setErr(errMsg(e)); } }}>Create request</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Unit" className="sm:col-span-2"><Select value={f.unitId} onChange={set("unitId")}><option value="">Select…</option>{(props.data ?? []).flatMap((p) => p.units.map((u) => <option key={u.id} value={u.id}>{p.name} · {u.name}</option>))}</Select></Field>
        <Field label="Title" className="sm:col-span-2"><Input value={f.title} onChange={set("title")} placeholder="e.g. Water heater leaking" /></Field>
        <Field label="Category"><Select value={f.category} onChange={set("category")}>{MAINT_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
        <Field label="Priority"><Select value={f.priority} onChange={set("priority")}>{PRIORITIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={set("description")} /></Field>
        <div className="sm:col-span-2"><p className="text-[13px] font-semibold text-ink mb-1.5">Photos</p><PhotoUploader value={photos} onChange={setPhotos} /></div>
      </div>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}

export function MaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useRequest(Number(id));
  const vendors = useVendors();
  const assign = useAssignRequest();
  const status = useUpdateRequestStatus();
  const [vendorId, setVendorId] = useState("");
  const [when, setWhen] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Empty title="Request not found" />;
  const r = q.data;
  const act = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <div>
      <Link href="/maintenance" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-3"><ArrowLeft className="size-4" /> Maintenance</Link>
      <PageHeader icon={<Wrench />} title={r.title} subtitle={`${r.property?.name ?? ""} · ${r.unit?.name ?? ""} — opened ${fmtDateTime(r.createdAt)} by ${r.submittedBy} (${r.submittedByRole})`} actions={<><PriorityPill p={r.priority} /><Pill className="text-sm">{r.status}</Pill></>} />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Details">
            <p className="text-body whitespace-pre-line">{r.description || "No description."}</p>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted">
              <span className="flex items-center gap-1.5"><Wrench className="size-4" />{titleCase(r.category)}</span>
              <span className="flex items-center gap-1.5"><KeyRound className="size-4" />{r.entryPermission ? "Permission to enter" : "Call before entry"}</span>
              {r.tenantName && <span className="flex items-center gap-1.5"><User className="size-4" />{r.tenantName}</span>}
              {r.scheduledFor && <span className="flex items-center gap-1.5"><CalendarClock className="size-4" />Scheduled {fmtDate(r.scheduledFor)}</span>}
            </div>
            {r.photos.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{r.photos.map((p) => <PhotoThumb key={p.key} file={p} className="size-28" />)}</div>}
            {r.vendorNotes && <div className="mt-4 rounded-md bg-app px-4 py-3 text-sm"><p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Vendor notes</p>{r.vendorNotes}</div>}
          </Card>
          <Card title="Invoices" action={<Link href="/invoices" className="text-sm font-semibold text-brand">All invoices →</Link>} bodyClass={r.invoices.length ? "p-0" : undefined}>
            {!r.invoices.length ? (
              <p className="text-sm text-muted">No invoices yet. The vendor submits one from their portal when the work is done.</p>
            ) : (
              <div className="divide-y divide-line">
                {r.invoices.map((i) => (
                  <Link key={i.id} href="/invoices" className="flex items-center gap-3 px-5 py-3 hover:bg-app/50">
                    <ReceiptText className="size-5 text-brand" />
                    <div className="flex-1"><p className="font-semibold text-ink text-sm">Invoice {i.number}</p><p className="text-xs text-muted">{i.description}</p></div>
                    <span className="font-semibold">{money(i.amount)}</span>
                    <Pill>{i.status}</Pill>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Work order">
            {r.vendor ? (
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-full bg-tint text-brand grid place-items-center"><HardHat className="size-5" /></div>
                <div><p className="font-semibold text-ink">{r.vendor.company || r.vendor.name}</p><p className="text-xs text-muted">{tradeLabel(r.vendor.trade)} · {r.vendor.phone}</p></div>
              </div>
            ) : (
              <p className="text-sm text-warn font-semibold mb-3">No vendor assigned</p>
            )}
            {!["completed", "closed"].includes(r.status) && (
              <div className="space-y-3">
                <Field label={r.vendor ? "Reassign vendor" : "Assign vendor"}>
                  <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                    <option value="">Choose…</option>
                    {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.company || v.name} — {tradeLabel(v.trade)}</option>)}
                  </Select>
                </Field>
                <Field label="Schedule for (optional)"><Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
                <Button className="w-full" disabled={!vendorId} loading={assign.isPending} onClick={() => act(() => assign.mutateAsync({ id: r.id, vendorId: Number(vendorId), scheduledFor: when || undefined }))}>Send work order</Button>
                {!vendors.data?.length && <Link href="/vendors" className="block text-xs text-brand font-semibold">Add a vendor first →</Link>}
              </div>
            )}
          </Card>
          <Card title="Status">
            <Select value={r.status} onChange={(e) => act(() => status.mutateAsync({ id: r.id, status: e.target.value as (typeof MAINT_STATUSES)[number] }))}>
              {MAINT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </Select>
            {r.status === "completed" && <Button variant="success" className="w-full mt-3" onClick={() => act(() => status.mutateAsync({ id: r.id, status: "closed" }))}>Close request</Button>}
            <div className="mt-3"><ErrorNote error={err} /></div>
          </Card>
          <Card title="Activity">
            <ol className="relative border-l border-line ml-2 space-y-4">
              {r.timeline.map((t) => (
                <li key={t.id} className="pl-4 relative">
                  <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-brand" />
                  <p className="text-sm text-ink">{t.message}</p>
                  <p className="text-xs text-muted">{t.actor} · {fmtDateTime(t.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
