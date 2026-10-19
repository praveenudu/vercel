import { useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import { CreditCard, Settings2, CheckCircle2, ExternalLink, CalendarClock } from "lucide-react";
import { PageHeader, Card, Button, Field, Input, ErrorNote, Loading } from "../../components/ui/kit";
import { PlanCards, PlanMatrix, type Cycle } from "../../components/pricing-table";
import { useMeData } from "../../components/session";
import { NotificationsCard } from "../../components/notifications-card";
import { useUpdateSettings } from "../../queries/me";
import { useBillingPortal, useBillingStatus, useBillingSync, useCheckout } from "../../queries/billing";
import { PLANS, type PlanId } from "../../../shared/plans";
import { money, fromCents, toCents, errMsg, fmtDate } from "../../lib/format";

export default function BillingPage() {
  const me = useMeData();
  const status = useBillingStatus();
  const checkout = useCheckout();
  const portal = useBillingPortal();
  const sync = useBillingSync();
  const search = new URLSearchParams(useSearch());
  const returned = search.get("checkout") === "success";
  const [cycle, setCycle] = useState<Cycle>((me.profile.billingCycle as Cycle) || "annual");
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const synced = useRef(false);

  useEffect(() => {
    if (!returned || synced.current) return;
    synced.current = true;
    sync.mutateAsync({}).then((r) => {
      setMsg(`Payment received. You're on ${PLANS[r.plan as PlanId]?.name ?? r.plan}.`);
      window.history.replaceState(null, "", "/billing");
    });
  }, [returned, sync]);

  if (status.isLoading || !status.data) return <Loading />;
  const st = status.data;
  const plan = st.plan as PlanId;
  const p = PLANS[plan];
  const price = st.cycle === "monthly" ? p.monthly : p.annual;
  const live = st.mode === "live";
  const pending = (id: PlanId) => (id === "essentials" ? !!st.cancelsAt || st.scheduled?.plan === "essentials" : st.scheduled?.plan === id);

  return (
    <div>
      <PageHeader icon={<CreditCard />} title="Plans & Billing" subtitle="Start free. Upgrade when you want e-sign, online rent, invoice approvals and the full report suite." />
      <div className="grid md:grid-cols-3 gap-5 mb-8">
        <Card className="md:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Current plan</p>
              <div className="flex flex-wrap items-end gap-3 mt-2">
                <h2 className="text-3xl font-bold text-ink">{p.name}</h2>
                <p className="text-body pb-1">{price ? `$${price}/mo · billed ${st.cycle === "monthly" ? "monthly" : `annually ($${price * 12}/yr)`}` : "Free forever"}</p>
              </div>
              <p className="text-sm text-muted mt-1">{p.tagline}</p>
            </div>
            {live && st.isOwner && plan !== "essentials" && (
              <Button variant="outline" icon={<ExternalLink className="size-4" />} loading={portal.isPending} onClick={async () => { setErr(null); try { const r = await portal.mutateAsync({}); window.location.href = r.url; } catch (e) { setErr(errMsg(e)); } }}>
                Manage billing
              </Button>
            )}
          </div>
          <div className="mt-3 space-y-1.5 text-sm">
            {st.renewsAt && <p className="text-body flex items-center gap-1.5"><CalendarClock className="size-4 text-muted" />Renews {fmtDate(new Date(st.renewsAt).toISOString())}</p>}
            {st.cancelsAt && <p className="text-warn font-semibold flex items-center gap-1.5"><CalendarClock className="size-4" />Cancels {fmtDate(new Date(st.cancelsAt).toISOString())} — you keep {p.name} until then</p>}
            {st.scheduled && !(st.cancelsAt && st.scheduled.plan === "essentials") && <p className="text-body flex items-center gap-1.5"><CalendarClock className="size-4 text-muted" />Switches to {PLANS[st.scheduled.plan].name}{st.scheduled.plan === "essentials" ? "" : ` (${st.scheduled.cycle})`} on {fmtDate(new Date(st.scheduled.startsAt).toISOString())}</p>}
            {(msg || sync.isPending) && <p className="text-ok font-semibold flex items-center gap-1.5"><CheckCircle2 className="size-4" />{sync.isPending ? "Confirming your payment…" : msg}</p>}
            <ErrorNote error={err} />
          </div>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Portfolios</p>
          <p className="text-3xl font-bold text-ink mt-2">{me.portfolios.length}<span className="text-base text-muted font-medium"> / {Number.isFinite(p.maxPortfolios) ? p.maxPortfolios : "∞"}</span></p>
          <p className="text-sm text-muted mt-1">{plan === "pro" ? "Unlimited on Pro" : "Upgrade to Pro for unlimited portfolios"}</p>
        </Card>
      </div>
      <PlanCards
        current={cycle === st.cycle || plan === "essentials" ? plan : undefined}
        cycle={cycle}
        onCycle={setCycle}
        busy={busy}
        ctaLabel={(id) => (pending(id) ? "Change scheduled" : id === plan && (cycle === st.cycle || id === "essentials") ? "Current plan" : id === plan ? `Switch to ${cycle}` : PLANS[id].annual > p.annual ? `Upgrade to ${PLANS[id].name}` : id === "essentials" ? "Downgrade to Essentials" : `Switch to ${PLANS[id].name}`)}
        onSelect={async (id, c) => {
          if (!st.isOwner) return setErr("Only the workspace owner can change the plan.");
          if (pending(id)) return setMsg(`Already scheduled — ${PLANS[id].name} starts when your current period ends.`);
          setBusy(id);
          setErr(null);
          try {
            const r = await checkout.mutateAsync({ plan: id, cycle: c });
            if (r.url) {
              window.location.href = r.url;
              return;
            }
            setMsg(live && PLANS[id].annual < p.annual ? `Change scheduled — you keep ${p.name} until the end of this billing period.` : `You're now on ${PLANS[id].name} (${c}).`);
          } catch (e) {
            setErr(errMsg(e));
          } finally {
            setBusy(null);
          }
        }}
      />
      <p className="text-xs text-muted text-center mt-4">
        {live ? "Secure checkout by Stripe. Upgrades apply immediately and are prorated; downgrades take effect at the end of the billing period." : "Demo workspace: plan changes apply instantly and no card is charged."}
      </p>
      <div className="mt-10"><PlanMatrix /></div>
      <SettingsCard />
      {st.isOwner && <NotificationsCard />}
    </div>
  );
}

function SettingsCard() {
  const me = useMeData();
  const save = useUpdateSettings();
  const [f, setF] = useState({ threshold: fromCents(me.profile.approvalThreshold), lateFee: fromCents(me.profile.defaultLateFee), grace: String(me.profile.defaultGraceDays) });
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card title={<span className="flex items-center gap-2"><Settings2 className="size-5 text-brand" />Workspace settings</span>} className="mt-10">
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Invoice approval threshold ($)" hint={`Pro: invoices over this need two approvals. Now ${money(toCents(f.threshold), { cents: false })}.`}><Input type="number" value={f.threshold} onChange={(e) => setF((x) => ({ ...x, threshold: e.target.value }))} /></Field>
        <Field label="Default late fee ($)" hint="Pre-filled on new leases."><Input type="number" value={f.lateFee} onChange={(e) => setF((x) => ({ ...x, lateFee: e.target.value }))} /></Field>
        <Field label="Default grace period (days)"><Input type="number" value={f.grace} onChange={(e) => setF((x) => ({ ...x, grace: e.target.value }))} /></Field>
      </div>
      <div className="flex items-center justify-end gap-3 mt-5">
        {ok && <span className="text-sm text-ok font-semibold">Saved</span>}
        <ErrorNote error={err} />
        <Button loading={save.isPending} onClick={async () => { setErr(null); try { await save.mutateAsync({ approvalThreshold: toCents(f.threshold), defaultLateFee: toCents(f.lateFee), defaultGraceDays: Number(f.grace) }); setOk(true); setTimeout(() => setOk(false), 2000); } catch (e) { setErr(errMsg(e)); } }}>Save settings</Button>
      </div>
    </Card>
  );
}
