import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Search, ShieldCheck, ArrowLeft, Briefcase, Home, Users, PawPrint, FileSignature, CheckCircle2, XCircle, HelpCircle, Copy } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Table, Tabs, Modal, Textarea, ErrorNote } from "../../components/ui/kit";
import { useApplications, useApplication, useRunScreening, useDecideApplication } from "../../queries/applications";
import { useListings } from "../../queries/listings";
import { money, fmtDate, fmtDateTime, timeAgo, errMsg } from "../../lib/format";
import { cn } from "../../lib/utils";

type Filter = "all" | "new" | "review" | "approved" | "rejected";

export function ScreeningPage() {
  const q = useApplications();
  const listings = useListings();
  const [tab, setTab] = useState<Filter>("all");
  const [, nav] = useLocation();
  const rows = q.data ?? [];
  const match = (s: string) =>
    tab === "all" ? true : tab === "new" ? ["submitted", "screening"].includes(s) : tab === "review" ? ["review", "info_requested"].includes(s) : s === tab;
  const listed = (listings.data ?? []).filter((u) => u.status === "listed");
  return (
    <div>
      <PageHeader icon={<Search />} title="Tenant Screening" subtitle="Online applications with credit, eviction and criminal background checks." actions={<Link href="/listings"><Button variant="outline">Share application link</Button></Link>} />
      <div className="grid sm:grid-cols-4 gap-4 mb-6 stagger">
        {[
          { l: "New applications", v: rows.filter((r) => r.status === "submitted").length },
          { l: "Awaiting decision", v: rows.filter((r) => ["review", "info_requested"].includes(r.status)).length },
          { l: "Approved", v: rows.filter((r) => r.status === "approved").length },
          { l: "Units accepting applications", v: listed.length },
        ].map((s) => (
          <div key={s.l} className="bg-white border border-line rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{s.l}</p>
            <p className="text-2xl font-bold text-ink mt-1">{s.v}</p>
          </div>
        ))}
      </div>
      <Card bodyClass="p-0">
        <div className="px-5 pt-2">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: "all", label: "All", count: rows.length }, { id: "new", label: "New" }, { id: "review", label: "In review" }, { id: "approved", label: "Approved" }, { id: "rejected", label: "Rejected" }]} />
        </div>
        {q.isLoading ? (
          <Loading />
        ) : !rows.filter((r) => match(r.status)).length ? (
          <Empty icon={<Users />} title="No applications here">Publish a listing and share the apply link — applications land here automatically.</Empty>
        ) : (
          <Table>
            <thead>
              <tr><th>Applicant</th><th>Unit</th><th>Income</th><th>Score</th><th>Status</th><th>Received</th></tr>
            </thead>
            <tbody>
              {rows.filter((r) => match(r.status)).map((a) => (
                <tr key={a.id} className="cursor-pointer" onClick={() => nav(`/screening/${a.id}`)}>
                  <td>
                    <p className="font-semibold text-ink">{a.firstName} {a.lastName}</p>
                    <p className="text-xs text-muted">{a.email}</p>
                  </td>
                  <td>{a.property?.name} · {a.unit?.name}</td>
                  <td>{money(a.monthlyIncome, { cents: false })}<span className="text-muted">/mo</span></td>
                  <td>{a.score != null ? <ScoreChip score={a.score} /> : <span className="text-muted">—</span>}</td>
                  <td><Pill>{a.status}</Pill></td>
                  <td className="text-muted">{timeAgo(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  return <span className={cn("inline-grid place-items-center size-9 rounded-full text-sm font-bold", score >= 75 ? "bg-ok-tint text-ok" : score >= 55 ? "bg-warn-tint text-warn" : "bg-bad-tint text-bad")}>{score}</span>;
}

const PARTS: { k: string; label: string; max: number }[] = [
  { k: "income", label: "Income-to-rent", max: 30 },
  { k: "credit", label: "Credit", max: 25 },
  { k: "eviction", label: "Eviction history", max: 15 },
  { k: "criminal", label: "Criminal background", max: 10 },
  { k: "employment", label: "Employment tenure", max: 10 },
  { k: "history", label: "Rental history & references", max: 10 },
];

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useApplication(Number(id));
  const run = useRunScreening();
  const decide = useDecideApplication();
  const [, nav] = useLocation();
  const [modal, setModal] = useState<null | "approved" | "rejected" | "info_requested">(null);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Empty title="Application not found" />;
  const a = q.data;
  const r = a.report;
  const parts = (r?.breakdown?.parts ?? {}) as Record<string, number>;
  const ratio = (r?.breakdown?.ratio ?? 0) as number;
  const score = a.score ?? 0;

  return (
    <div>
      <Link href="/screening" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-3"><ArrowLeft className="size-4" /> All applications</Link>
      <PageHeader
        icon={<Search />}
        title={`${a.firstName} ${a.lastName}`}
        subtitle={`Applied for ${a.property?.name ?? ""} · ${a.unit?.name ?? ""} — ${fmtDateTime(a.createdAt)}`}
        actions={
          <>
            <Pill className="text-sm">{a.status}</Pill>
            {a.lease ? (
              <Link href={`/leases/${a.lease.id}`}><Button variant="outline" icon={<FileSignature className="size-4" />}>View lease</Button></Link>
            ) : a.status === "approved" ? (
              <Button icon={<FileSignature className="size-4" />} onClick={() => nav(`/leases/new?applicationId=${a.id}`)}>Create lease</Button>
            ) : null}
          </>
        }
      />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title={<span className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand" /> Screening report</span>} action={r && <span className="text-xs text-muted">{r.provider} · {fmtDate(r.createdAt)}</span>}>
            {!r ? (
              <div className="text-center py-8">
                <div className="mx-auto mb-3 size-14 rounded-full bg-tint text-brand grid place-items-center"><ShieldCheck className="size-7" /></div>
                <p className="font-semibold text-ink">Run a TransUnion SmartMove screening</p>
                <p className="text-sm text-muted mt-1 max-w-md mx-auto">Credit report, nationwide eviction search and criminal background check. Applicant-paid ($40) — no cost to you.</p>
                <Button className="mt-4" loading={run.isPending} onClick={() => run.mutate({ id: a.id })}>Request screening</Button>
                <p className="text-[11px] text-muted mt-3">Sandbox mode: results are simulated for demonstration.</p>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-6">
                  <ScoreRing score={score} />
                  <div className="flex-1 min-w-[220px]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Keystone recommendation</p>
                    <p className={cn("text-2xl font-bold capitalize mt-0.5", a.recommendation === "approve" ? "text-ok" : a.recommendation === "conditional" ? "text-warn" : "text-bad")}>
                      {a.recommendation === "conditional" ? "Approve with conditions" : a.recommendation}
                    </p>
                    <p className="text-sm text-body mt-1">Risk level <Pill>{r.riskLevel}</Pill> · Income is <b>{ratio}×</b> monthly rent</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-4 gap-3 mt-6">
                  <Metric label="Credit score" value={r.creditScore} sub={r.creditBand} tone={r.creditScore >= 680 ? "ok" : r.creditScore >= 620 ? "warn" : "bad"} />
                  <Metric label="Evictions" value={r.evictionRecords} sub="Nationwide search" tone={r.evictionRecords ? "bad" : "ok"} />
                  <Metric label="Criminal" value={r.criminalRecords} sub="Records found" tone={r.criminalRecords ? "warn" : "ok"} />
                  <Metric label="Collections" value={r.collections} sub="Open accounts" tone={r.collections ? "warn" : "ok"} />
                </div>
                <div className="mt-6 space-y-3">
                  {PARTS.map((p) => (
                    <div key={p.k}>
                      <div className="flex justify-between text-sm mb-1"><span className="text-body">{p.label}</span><span className="font-semibold text-ink">{parts[p.k] ?? 0}/{p.max}</span></div>
                      <div className="h-2 rounded-full bg-app overflow-hidden"><div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${((parts[p.k] ?? 0) / p.max) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted mt-4">Income {r.incomeVerified ? "verified" : "not verified"} at {money(r.verifiedIncome, { cents: false })}/mo. Decisions must follow Fair Housing rules; adverse action notices are sent by the screening provider.</p>
              </div>
            )}
          </Card>

          <Card title="Application">
            <div className="grid sm:grid-cols-2 gap-5 text-sm">
              <Info icon={<Briefcase />} title="Employment" lines={[`${a.jobTitle || "—"} at ${a.employer || "—"}`, `${a.employmentMonths} months · ${money(a.monthlyIncome, { cents: false })}/mo gross`]} />
              <Info icon={<Home />} title="Current residence" lines={[a.currentAddress || "—", `${a.monthsAtAddress} months · Landlord: ${a.prevLandlord || "—"} ${a.prevLandlordPhone}`]} />
              <Info icon={<Users />} title="Household" lines={[`${a.occupants} occupant${a.occupants === 1 ? "" : "s"}`, `Move-in ${a.moveInDate ? fmtDate(a.moveInDate) : "flexible"}`, a.priorEviction ? "Disclosed prior eviction" : "No prior evictions disclosed"]} />
              <Info icon={<PawPrint />} title="Pets" lines={[a.pets || "None"]} />
            </div>
            {a.references.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">References</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {a.references.map((ref, i) => (
                    <div key={i} className="rounded-md bg-app px-3 py-2 text-sm"><b className="text-ink">{ref.name}</b> <span className="text-muted">· {ref.relation}</span><br /><span className="text-body">{ref.phone}</span></div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted mt-5">Contact: {a.email} · {a.phone} · Screening consent e-signed as “{a.consentSignature}”.</p>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Decision">
            {a.status === "approved" || a.status === "rejected" ? (
              <div className="text-sm">
                <p className="text-body">This application was <b className="text-ink">{a.status}</b>{a.decidedAt ? ` on ${fmtDate(a.decidedAt)}` : ""}.</p>
                {a.notes && <p className="mt-2 text-muted">“{a.notes}”</p>}
                {a.status === "approved" && !a.lease && <Button className="mt-4 w-full" onClick={() => nav(`/leases/new?applicationId=${a.id}`)}>Create lease</Button>}
              </div>
            ) : (
              <div className="space-y-2">
                {!r && <p className="text-sm text-muted mb-2">Screen the applicant before deciding.</p>}
                <Button variant="success" className="w-full" icon={<CheckCircle2 className="size-4" />} onClick={() => setModal("approved")}>Approve</Button>
                <Button variant="outline" className="w-full" icon={<HelpCircle className="size-4" />} onClick={() => setModal("info_requested")}>Request info</Button>
                <Button variant="ghost" className="w-full text-bad" icon={<XCircle className="size-4" />} onClick={() => setModal("rejected")}>Reject</Button>
              </div>
            )}
          </Card>
          <Card title="Timeline">
            <ol className="relative border-l border-line ml-2 space-y-4">
              {a.timeline.map((t) => (
                <li key={t.id} className="pl-4 relative">
                  <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-brand" />
                  <p className="text-sm text-ink">{t.message}</p>
                  <p className="text-xs text-muted">{t.actor} · {fmtDateTime(t.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Share application link">
            <p className="text-sm text-muted mb-2">Send to more prospects for this unit.</p>
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/apply/${a.unitId}`)} className="flex w-full items-center gap-2 rounded-md bg-app px-3 py-2 text-xs text-body cursor-pointer hover:bg-line">
              <span className="truncate flex-1 text-left">{window.location.origin}/apply/{a.unitId}</span><Copy className="size-4 text-brand" />
            </button>
          </Card>
        </div>
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "approved" ? "Approve application" : modal === "rejected" ? "Reject application" : "Request more information"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button
              variant={modal === "rejected" ? "danger" : modal === "approved" ? "success" : "primary"}
              loading={decide.isPending}
              onClick={async () => {
                try {
                  await decide.mutateAsync({ id: a.id, decision: modal!, notes });
                  setModal(null);
                  setNotes("");
                } catch (e) {
                  setErr(errMsg(e));
                }
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <Textarea placeholder={modal === "info_requested" ? "What do you need? e.g. two recent pay stubs" : "Internal notes (optional)"} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {modal === "rejected" && <p className="text-xs text-muted mt-2">If the decision is based on the screening report, the applicant is entitled to an adverse action notice under the FCRA.</p>}
        <div className="mt-3"><ErrorNote error={err} /></div>
      </Modal>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const c = 2 * Math.PI * 42;
  const color = score >= 75 ? "var(--color-ok)" : score >= 55 ? "var(--color-warn)" : "var(--color-bad)";
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-app)" strokeWidth="9" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><p className="text-3xl font-bold text-ink leading-none">{score}</p><p className="text-[11px] text-muted mt-0.5">of 100</p></div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: "ok" | "warn" | "bad" }) {
  return (
    <div className={cn("rounded-lg border p-3", tone === "ok" ? "border-ok/25 bg-ok-tint/50" : tone === "warn" ? "border-warn/25 bg-warn-tint/50" : "border-bad/25 bg-bad-tint/50")}>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={cn("text-2xl font-bold", tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-bad")}>{value}</p>
      <p className="text-[11px] text-muted">{sub}</p>
    </div>
  );
}

function Info({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div className="flex gap-3">
      <div className="size-9 rounded-md bg-tint text-brand grid place-items-center shrink-0 [&>svg]:size-4">{icon}</div>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {lines.map((l, i) => <p key={i} className="text-body">{l}</p>)}
      </div>
    </div>
  );
}
