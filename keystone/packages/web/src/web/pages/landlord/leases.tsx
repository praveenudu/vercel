import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { FileSignature, Plus, ArrowLeft, Send, Upload, Printer, Copy, Check, PenLine, Ban, Trash2, Mail } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Table, Tabs, Modal, Field, Input, Select, ErrorNote } from "../../components/ui/kit";
import { useLeases, useLease, useLeaseDefaults, useCreateLease, useSendLease, useCountersign, useMarkSignedOffline, useEndLease, useRemoveLease } from "../../queries/leases";
import { useProperties } from "../../queries/properties";
import { useFeature, UpgradeNote } from "../../components/plan-gate";
import { useMeData } from "../../components/session";
import { LeaseDocument } from "../../components/lease-document";
import { SignaturePad, type SignatureValue } from "../../components/signature-pad";
import { money, fmtDate, fmtDateTime, toCents, fromCents, errMsg } from "../../lib/format";
import { uploadFile } from "../../lib/upload";

type Filter = "all" | "active" | "pending" | "draft" | "ended";

export function LeasesPage() {
  const q = useLeases();
  const [tab, setTab] = useState<Filter>("all");
  const [, nav] = useLocation();
  const esign = useFeature("esign");
  const rows = (q.data ?? []).filter((l) => (tab === "all" ? true : tab === "pending" ? ["sent", "tenant_signed"].includes(l.status) : l.status === tab));
  return (
    <div>
      <PageHeader icon={<FileSignature />} title="Leases" subtitle="Build, e-sign and store every lease in one place." actions={<Button icon={<Plus className="size-4" />} onClick={() => nav("/leases/new")}>New lease</Button>} />
      {!esign && <UpgradeNote feature="esign" className="mb-5">You can draft leases and mark them signed on paper. Upgrade to send leases for legally-binding e-signature.</UpgradeNote>}
      <Card bodyClass="p-0">
        <div className="px-5 pt-2">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: "all", label: "All", count: q.data?.length }, { id: "active", label: "Active" }, { id: "pending", label: "Awaiting signature" }, { id: "draft", label: "Drafts" }, { id: "ended", label: "Ended" }]} />
        </div>
        {q.isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty icon={<FileSignature />} title="No leases here" action={<Button onClick={() => nav("/leases/new")}>Draft a lease</Button>}>Approve an applicant in Screening, or start a lease from scratch.</Empty>
        ) : (
          <Table>
            <thead><tr><th>Tenant</th><th>Property</th><th>Term</th><th>Rent</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="cursor-pointer" onClick={() => nav(`/leases/${l.id}`)}>
                  <td><p className="font-semibold text-ink">{l.tenantName}</p><p className="text-xs text-muted">{l.tenantEmail}</p></td>
                  <td>{l.property?.name} · {l.unit?.name}</td>
                  <td className="whitespace-nowrap">{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</td>
                  <td>{money(l.rent)}</td>
                  <td className={l.balance.balance > 0 ? "text-bad font-semibold" : ""}>{l.status === "active" ? money(l.balance.balance) : "—"}</td>
                  <td><Pill>{l.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

export function NewLeasePage() {
  const search = new URLSearchParams(useSearch());
  const applicationId = search.get("applicationId") ? Number(search.get("applicationId")) : undefined;
  const props = useProperties(null);
  const [unitId, setUnitId] = useState<number | undefined>(search.get("unitId") ? Number(search.get("unitId")) : undefined);
  const defaults = useLeaseDefaults({ applicationId, unitId }, applicationId != null || unitId != null);
  const create = useCreateLease();
  const [, nav] = useLocation();
  const [f, setF] = useState({ tenantName: "", tenantEmail: "", startDate: "", endDate: "", rent: "", deposit: "", dueDay: "1", lateFee: "", graceDays: "5" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const d = defaults.data;
    if (!d) return;
    if (d.unitId && !unitId) setUnitId(d.unitId);
    setF((x) => ({
      tenantName: x.tenantName || d.tenantName,
      tenantEmail: x.tenantEmail || d.tenantEmail,
      startDate: d.startDate,
      endDate: d.endDate,
      rent: fromCents(d.rent),
      deposit: fromCents(d.deposit),
      dueDay: String(d.dueDay),
      lateFee: fromCents(d.lateFee),
      graceDays: String(d.graceDays),
    }));
  }, [defaults.data, unitId]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const units = (props.data ?? []).flatMap((p) => p.units.map((u) => ({ ...u, propertyName: p.name })));

  const submit = async () => {
    setErr(null);
    if (!unitId) return setErr("Choose a unit");
    try {
      const l = await create.mutateAsync({
        unitId,
        applicationId: applicationId ?? null,
        tenantName: f.tenantName,
        tenantEmail: f.tenantEmail,
        startDate: f.startDate,
        endDate: f.endDate,
        rent: toCents(f.rent),
        deposit: toCents(f.deposit),
        dueDay: Number(f.dueDay),
        lateFee: toCents(f.lateFee),
        graceDays: Number(f.graceDays),
      });
      nav(`/leases/${l.id}`);
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <div className="max-w-3xl">
      <Link href="/leases" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-3"><ArrowLeft className="size-4" /> Leases</Link>
      <PageHeader icon={<FileSignature />} title="New lease" subtitle={applicationId ? "Pre-filled from the approved application." : "Our attorney-reviewed residential template, filled with your terms."} />
      <Card>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Unit" className="sm:col-span-2">
            <Select value={unitId ?? ""} onChange={(e) => setUnitId(Number(e.target.value) || undefined)}>
              <option value="">Select a unit…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.propertyName} · {u.name} ({u.status})</option>)}
            </Select>
          </Field>
          {defaults.data?.address && <p className="sm:col-span-2 -mt-2 text-xs text-muted">{defaults.data.address}</p>}
          <Field label="Tenant name"><Input value={f.tenantName} onChange={set("tenantName")} /></Field>
          <Field label="Tenant email" hint="They’ll get a link to create their tenant login."><Input type="email" value={f.tenantEmail} onChange={set("tenantEmail")} /></Field>
          <Field label="Start date"><Input type="date" value={f.startDate} onChange={set("startDate")} /></Field>
          <Field label="End date"><Input type="date" value={f.endDate} onChange={set("endDate")} /></Field>
          <Field label="Monthly rent ($)"><Input type="number" value={f.rent} onChange={set("rent")} /></Field>
          <Field label="Security deposit ($)"><Input type="number" value={f.deposit} onChange={set("deposit")} /></Field>
          <Field label="Rent due day"><Select value={f.dueDay} onChange={set("dueDay")}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Late fee ($)"><Input type="number" value={f.lateFee} onChange={set("lateFee")} /></Field>
            <Field label="Grace days"><Input type="number" value={f.graceDays} onChange={set("graceDays")} /></Field>
          </div>
        </div>
        <div className="mt-5"><ErrorNote error={err} /></div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => nav("/leases")}>Cancel</Button>
          <Button loading={create.isPending} onClick={submit}>Create draft</Button>
        </div>
      </Card>
    </div>
  );
}

export function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useLease(Number(id));
  const me = useMeData();
  const esign = useFeature("esign");
  const send = useSendLease();
  const countersign = useCountersign();
  const offline = useMarkSignedOffline();
  const end = useEndLease();
  const remove = useRemoveLease();
  const [, nav] = useLocation();
  const [signOpen, setSignOpen] = useState(false);
  const [offOpen, setOffOpen] = useState(false);
  const [sig, setSig] = useState<SignatureValue>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (q.isLoading) return <Loading />;
  if (!q.data) return <Empty title="Lease not found" />;
  const l = q.data;
  const invite = l.inviteCode ? `${window.location.origin}/invite/${l.inviteCode}` : null;

  const act = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <div>
      <Link href="/leases" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-3 no-print"><ArrowLeft className="size-4" /> Leases</Link>
      <PageHeader
        icon={<FileSignature />}
        title={`${l.tenantName} — ${l.unit?.name ?? ""}`}
        subtitle={`${l.property?.name ?? ""} · ${fmtDate(l.startDate)} – ${fmtDate(l.endDate)}`}
        actions={
          <>
            <Pill className="text-sm">{l.status}</Pill>
            {l.status !== "draft" && <a href={`/leases/${l.id}/print?print=1`} target="_blank" rel="noreferrer"><Button variant="outline" icon={<Printer className="size-4" />}>Print / PDF</Button></a>}
          </>
        }
      />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2"><LeaseDocument lease={l} /></div>
        <div className="space-y-5 no-print">
          <Card title="Next step">
            {l.status === "draft" && (
              <div className="space-y-3">
                <p className="text-sm text-body">Review the lease, then send it to {l.tenantName} for e-signature.</p>
                {esign ? (
                  <Button className="w-full" icon={<Send className="size-4" />} loading={send.isPending} onClick={() => act(() => send.mutateAsync({ id: l.id }))}>Send for e-signature</Button>
                ) : (
                  <UpgradeNote feature="esign">Send leases for e-signature with a full audit trail.</UpgradeNote>
                )}
                <Button variant="outline" className="w-full" icon={<Upload className="size-4" />} onClick={() => setOffOpen(true)}>Signed on paper? Upload it</Button>
                <Button variant="ghost" className="w-full text-bad" icon={<Trash2 className="size-4" />} onClick={() => act(async () => { await remove.mutateAsync({ id: l.id }); nav("/leases"); })}>Delete draft</Button>
              </div>
            )}
            {l.status === "sent" && <p className="text-sm text-body">Waiting for <b>{l.tenantName}</b> to sign. Sent {fmtDate(l.sentAt)}.</p>}
            {l.status === "tenant_signed" && (
              <div className="space-y-3">
                <p className="text-sm text-body"><b>{l.tenantName}</b> signed on {fmtDate(l.tenantSignedAt)}. Countersign to execute the lease and start the rent schedule.</p>
                <Button className="w-full" icon={<PenLine className="size-4" />} onClick={() => setSignOpen(true)}>Countersign lease</Button>
              </div>
            )}
            {l.status === "active" && (
              <div className="space-y-3 text-sm">
                <p className="text-body">Fully executed. Current balance <b className={l.balance.balance > 0 ? "text-bad" : "text-ok"}>{money(l.balance.balance)}</b>.</p>
                <Link href="/rent"><Button variant="outline" className="w-full">Go to Rent Collection</Button></Link>
                <Button variant="ghost" className="w-full text-bad" icon={<Ban className="size-4" />} loading={end.isPending} onClick={() => confirm("End this lease and mark the unit vacant?") && act(() => end.mutateAsync({ id: l.id }))}>End lease</Button>
              </div>
            )}
            {l.status === "ended" && <p className="text-sm text-muted">This lease has ended. The unit is back to vacant.</p>}
            <div className="mt-3"><ErrorNote error={err} /></div>
          </Card>
          {invite && (
            <Card title="Tenant portal invite">
              <p className="text-sm text-muted mb-2">Share this link with {l.tenantName} so they can create their login{l.status === "sent" ? " and sign" : ""}.</p>
              <button onClick={() => { navigator.clipboard.writeText(invite); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="flex w-full items-center gap-2 rounded-md bg-app px-3 py-2 text-xs text-body cursor-pointer hover:bg-line">
                <span className="truncate flex-1 text-left">{invite}</span>{copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4 text-brand" />}
              </button>
            </Card>
          )}
          <Card title="Terms">
            <dl className="text-sm space-y-2">
              {[["Rent", money(l.rent)], ["Deposit", money(l.deposit)], ["Due day", String(l.dueDay)], ["Late fee", `${money(l.lateFee)} after ${l.graceDays} days`], ["Signing", l.signMethod === "upload" ? "Paper (uploaded)" : "Keystone e-sign"]].map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>
              ))}
            </dl>
          </Card>
          {l.timeline.length > 0 && (
            <Card title="Activity">
              <ol className="relative border-l border-line ml-2 space-y-4">
                {l.timeline.map((t) => {
                  const mail = t.actor === "Keystone" && t.message.startsWith("Email");
                  const failed = mail && !t.message.startsWith("Emailed ");
                  return (
                    <li key={t.id} className="pl-4 relative">
                      {mail ? (
                        <span className={`absolute -left-[9px] top-0.5 grid size-[18px] place-items-center rounded-full bg-white border ${failed ? "border-warn text-warn" : "border-brand text-brand"}`}><Mail className="size-2.5" /></span>
                      ) : (
                        <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-brand" />
                      )}
                      <p className={`text-sm break-words ${failed ? "text-muted" : "text-ink"}`}>{t.message}</p>
                      <p className="text-xs text-muted">{t.actor} · {fmtDateTime(t.createdAt)}</p>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}
        </div>
      </div>

      <Modal open={signOpen} onClose={() => setSignOpen(false)} title="Countersign lease" footer={<><Button variant="ghost" onClick={() => setSignOpen(false)}>Cancel</Button><Button disabled={!sig} loading={countersign.isPending} onClick={() => act(async () => { await countersign.mutateAsync({ id: l.id, ...sig! }); setSignOpen(false); })}>Sign & execute</Button></>}>
        <SignaturePad defaultName={me.ownerName || me.user.name} onChange={setSig} />
        <p className="text-xs text-muted mt-3">By signing you agree this electronic signature is the legal equivalent of your handwritten signature. Timestamp: {new Date().toLocaleString()}.</p>
      </Modal>

      <Modal open={offOpen} onClose={() => setOffOpen(false)} title="Mark as signed on paper" footer={<><Button variant="ghost" onClick={() => setOffOpen(false)}>Cancel</Button><Button loading={busy} onClick={() => act(async () => { setBusy(true); try { const up = file ? await uploadFile(file) : null; await offline.mutateAsync({ id: l.id, fileKey: up?.key, fileName: up?.name }); setOffOpen(false); } finally { setBusy(false); } })}>Activate lease</Button></>}>
        <p className="text-sm text-body mb-4">Upload the signed copy (optional). The lease becomes active, the unit is marked occupied and a monthly rent schedule is created.</p>
        <Field label="Signed lease (PDF)"><Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="pt-1.5" /></Field>
      </Modal>
    </div>
  );
}

/** Clean, print-ready lease at /leases/:id/print (landlord or tenant). */
export function LeasePrintPage() {
  const { id } = useParams<{ id: string }>();
  const q = useLease(Number(id));
  const autoPrint = new URLSearchParams(useSearch()).get("print") === "1";
  useEffect(() => {
    if (q.data && autoPrint) setTimeout(() => window.print(), 400);
  }, [q.data, autoPrint]);
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Empty title="Lease not found" />;
  return (
    <div className="max-w-3xl mx-auto p-6 bg-white min-h-screen">
      <div className="no-print mb-4 flex justify-end"><Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button></div>
      <LeaseDocument lease={q.data} />
    </div>
  );
}

