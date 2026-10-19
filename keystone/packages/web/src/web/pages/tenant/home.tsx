import { useState } from "react";
import { Link } from "wouter";
import { Home, PenLine, HandCoins, Wrench, FileText, CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Modal, ErrorNote } from "../../components/ui/kit";
import { useMyLeases, useTenantSign } from "../../queries/leases";
import { useRequests } from "../../queries/maintenance";
import { useMeData } from "../../components/session";
import { LeaseDocument } from "../../components/lease-document";
import { SignaturePad, type SignatureValue } from "../../components/signature-pad";
import { money, fmtDate, timeAgo, errMsg } from "../../lib/format";

type Lease = NonNullable<ReturnType<typeof useMyLeases>["data"]>[number];

function nextDue(dueDay: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setMonth(d.getMonth() + 1);
  return d;
}

export default function TenantHome() {
  const me = useMeData();
  const leases = useMyLeases();
  const reqs = useRequests();
  const [signing, setSigning] = useState<Lease | null>(null);
  if (leases.isLoading) return <Loading />;
  const all = leases.data ?? [];
  const toSign = all.find((l) => l.status === "sent");
  const active = all.find((l) => l.status === "active") ?? all.find((l) => l.status === "tenant_signed");
  const first = me.user.name.split(" ")[0];
  return (
    <div>
      <PageHeader icon={<Home />} title={`Welcome home, ${first}`} subtitle={active ? `${active.property?.address ?? ""}, ${active.unit?.name ?? ""} · managed by ${me.ownerName}` : `Tenant portal · ${me.ownerName}`} />

      {toSign && (
        <div className="mb-6 rounded-xl bg-navy text-white p-6 flex flex-wrap items-center gap-5 page-enter">
          <div className="size-12 rounded-lg bg-white/10 grid place-items-center"><PenLine className="size-6" /></div>
          <div className="flex-1 min-w-[240px]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Action needed</p>
            <p className="text-xl font-bold mt-0.5">Your lease for {toSign.unit?.name} is ready to sign</p>
            <p className="text-sm text-white/75 mt-0.5">{fmtDate(toSign.startDate)} – {fmtDate(toSign.endDate)} · {money(toSign.rent)}/mo</p>
          </div>
          <Button className="bg-white !text-navy hover:bg-tint" size="lg" onClick={() => setSigning(toSign)}>Review & sign</Button>
        </div>
      )}

      {!active && !toSign ? (
        <Card><Empty icon={<Home />} title="No lease yet">When your landlord sends a lease, it’ll appear here to review and sign.</Empty></Card>
      ) : active ? (
        <div className="grid lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2" title="Rent">
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current balance</p>
                <p className={`text-4xl font-bold mt-1 ${active.balance.balance > 0 ? "text-bad" : "text-ok"}`}>{money(active.balance.balance)}</p>
                {active.balance.pending > 0 && <p className="text-xs text-warn font-semibold mt-1 flex items-center gap-1"><Clock className="size-3.5" />{money(active.balance.pending)} reported, awaiting confirmation</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Monthly rent</p>
                <p className="text-2xl font-bold text-ink mt-1">{money(active.rent)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Next due</p>
                <p className="text-2xl font-bold text-ink mt-1 flex items-center gap-2"><CalendarDays className="size-5 text-brand" />{fmtDate(nextDue(active.dueDay))}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/tenant/payments"><Button icon={<HandCoins className="size-4" />}>I paid rent</Button></Link>
              <Link href="/tenant/payments"><Button variant="outline">View ledger</Button></Link>
            </div>
            <p className="text-xs text-muted mt-4">Pay {me.ownerName} by Zelle, check or cash, then report it here so it shows on your ledger. Late fee of {money(active.lateFee)} applies after {active.graceDays} days.</p>
          </Card>
          <Card title="Your lease">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Status</span><Pill>{active.status}</Pill></div>
              <div className="flex justify-between"><span className="text-muted">Term</span><span className="font-semibold text-ink">{fmtDate(active.startDate)} – {fmtDate(active.endDate)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Deposit</span><span className="font-semibold text-ink">{money(active.deposit)}</span></div>
            </div>
            <a href={`/leases/${active.id}/print`} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full mt-5" icon={<FileText className="size-4" />}>View signed lease</Button></a>
          </Card>
          <Card className="lg:col-span-3" title="Maintenance requests" action={<Link href="/tenant/maintenance"><Button size="sm" icon={<Wrench className="size-4" />}>New request</Button></Link>} bodyClass="p-0">
            {!reqs.data?.length ? (
              <p className="p-5 text-sm text-muted">Something broken? Submit a request with photos and track it here.</p>
            ) : (
              <div className="divide-y divide-line">
                {reqs.data.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                    {r.status === "completed" || r.status === "closed" ? <CheckCircle2 className="size-5 text-ok" /> : <Wrench className="size-5 text-brand" />}
                    <div className="flex-1"><p className="font-semibold text-ink text-sm">{r.title}</p><p className="text-xs text-muted">{timeAgo(r.createdAt)}{r.vendor ? ` · ${r.vendor.company || r.vendor.name}` : ""}{r.scheduledFor ? ` · scheduled ${fmtDate(r.scheduledFor)}` : ""}</p></div>
                    <Pill>{r.status}</Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {signing && <SignLeaseModal lease={signing} onClose={() => setSigning(null)} />}
    </div>
  );
}

function SignLeaseModal({ lease, onClose }: { lease: Lease; onClose: () => void }) {
  const me = useMeData();
  const sign = useTenantSign();
  const [sig, setSig] = useState<SignatureValue>(null);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Review & sign your lease"
      footer={<><Button variant="ghost" onClick={onClose}>Not now</Button><Button disabled={!sig || !agree} loading={sign.isPending} onClick={async () => { setErr(null); try { await sign.mutateAsync({ id: lease.id, signature: sig!.signature, signatureType: sig!.signatureType, agree: true }); onClose(); } catch (e) { setErr(errMsg(e)); } }}>Sign lease</Button></>}
    >
      <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-line mb-5">
        <LeaseDocument lease={{ ...lease, landlordName: me.ownerName }} />
      </div>
      <p className="text-[13px] font-semibold text-ink mb-2">Your signature</p>
      <SignaturePad defaultName={lease.tenantName} onChange={setSig} />
      <label className="flex items-start gap-2 mt-4 text-sm text-body cursor-pointer">
        <input type="checkbox" aria-label="I agree to sign electronically" className="size-4 mt-0.5 accent-brand" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I have read the lease and agree to sign electronically. I understand my electronic signature is legally binding, and that the date, time and IP address will be recorded.
      </label>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}
