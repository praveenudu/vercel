/** Small product-UI illustrations used on the marketing site's service cards. */
import { Check, FileSignature, HandCoins, Wrench, Search, BarChart3, ReceiptText } from "lucide-react";
import type { ReactNode } from "react";

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="relative h-[180px] rounded-lg bg-gradient-to-br from-tint to-[#f5f9fe] overflow-hidden grid place-items-center">{children}</div>
);

export function ScreeningArt() {
  return (
    <Frame>
      <div className="w-[230px] rounded-lg bg-white shadow-lg p-4 rotate-[-2deg]">
        <div className="flex items-center gap-2.5">
          <span className="size-9 rounded-full bg-navy text-white grid place-items-center text-xs font-bold">AP</span>
          <div className="leading-tight">
            <p className="text-[13px] font-bold text-ink">Alex Park</p>
            <p className="text-[11px] text-muted">Unit 2B · $1,950/mo</p>
          </div>
          <span className="ml-auto text-[22px] font-extrabold text-ok">86</span>
        </div>
        {[["Credit", "742 · Excellent", 92], ["Income", "3.4× rent", 85], ["Evictions", "None found", 100]].map(([k, v, w]) => (
          <div key={k as string} className="mt-2.5">
            <div className="flex justify-between text-[10.5px]"><span className="text-muted">{k}</span><span className="font-semibold text-ink">{v}</span></div>
            <div className="h-1.5 rounded-full bg-app mt-1"><div className="h-full rounded-full bg-brand" style={{ width: `${w}%` }} /></div>
          </div>
        ))}
      </div>
      <span className="absolute right-6 top-6 size-10 rounded-full bg-white shadow grid place-items-center text-brand"><Search className="size-5" /></span>
    </Frame>
  );
}

export function RentArt() {
  return (
    <Frame>
      <div className="w-[240px] space-y-2">
        {[["Maya Chen", "Zelle · Oct 1", "$1,850", "Confirmed"], ["Luis Ortega", "Check #1042", "$2,100", "Confirmed"], ["Priya Shah", "Cash", "$1,400", "Pending"]].map(([n, m, a, s], i) => (
          <div key={n} className="flex items-center gap-2.5 rounded-lg bg-white shadow-md px-3 py-2.5" style={{ marginLeft: i * 10 }}>
            <span className="size-7 rounded-full bg-tint text-brand grid place-items-center"><HandCoins className="size-3.5" /></span>
            <div className="leading-tight min-w-0">
              <p className="text-[12px] font-bold text-ink">{n}</p>
              <p className="text-[10px] text-muted">{m}</p>
            </div>
            <div className="ml-auto text-right leading-tight">
              <p className="text-[12px] font-bold text-ink">{a}</p>
              <p className={`text-[10px] font-semibold ${s === "Pending" ? "text-warn" : "text-ok"}`}>{s}</p>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function LeaseArt() {
  return (
    <Frame>
      <div className="w-[200px] h-[150px] rounded-lg bg-white shadow-lg p-4 rotate-[2deg]">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-ink"><FileSignature className="size-3.5 text-brand" /> Residential Lease</div>
        {[100, 90, 95, 70].map((w, i) => (
          <div key={i} className="h-1.5 rounded bg-app mt-2" style={{ width: `${w}%` }} />
        ))}
        <div className="mt-4 border-b border-ink/30 pb-0.5 font-sig text-[24px] leading-none text-navy">Maya Chen</div>
        <p className="mt-1 text-[9px] text-muted">E-signed Oct 2 · 10:42 AM · IP logged</p>
      </div>
      <span className="absolute left-6 bottom-6 rounded-full bg-ok text-white text-[10px] font-bold px-2.5 py-1 inline-flex items-center gap-1"><Check className="size-3" strokeWidth={3} /> Fully executed</span>
    </Frame>
  );
}

export function MaintenanceArt() {
  return (
    <Frame>
      <div className="flex gap-2">
        {[["New", "Leaky faucet", "bg-tint text-brand"], ["Scheduled", "HVAC tune-up", "bg-warn-tint text-warn"], ["Done", "Smoke alarm", "bg-ok-tint text-ok"]].map(([c, t, tone], i) => (
          <div key={c} className="w-[92px] rounded-lg bg-white/70 p-1.5" style={{ marginTop: i * 14 }}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted px-1 mb-1">{c}</p>
            <div className="rounded-md bg-white shadow-md p-2">
              <Wrench className="size-3.5 text-brand" />
              <p className="text-[10.5px] font-bold text-ink mt-1 leading-tight">{t}</p>
              <span className={`inline-block mt-1.5 rounded-full px-1.5 text-[8.5px] font-bold ${tone}`}>{c}</span>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function InvoiceArt() {
  return (
    <Frame>
      <div className="w-[230px] rounded-lg bg-white shadow-lg p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-ink"><ReceiptText className="size-3.5 text-brand" /> ACE-1043</span>
          <span className="text-[13px] font-extrabold text-ink">$1,256.00</span>
        </div>
        <p className="text-[10px] text-muted mt-0.5">Ace Plumbing · Water heater</p>
        <div className="mt-3 space-y-1.5">
          {[["Step 1 · Jordan R.", true], ["Step 2 · over $1,000", false]].map(([l, ok]) => (
            <div key={l as string} className="flex items-center gap-2 text-[10.5px]">
              <span className={`size-4 rounded-full grid place-items-center ${ok ? "bg-ok text-white" : "border border-warn text-warn"}`}>{ok ? <Check className="size-2.5" strokeWidth={4} /> : "2"}</span>
              <span className="text-ink">{l}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-1.5">
          <span className="flex-1 h-6 rounded bg-brand text-white text-[10px] font-bold grid place-items-center">Approve</span>
          <span className="flex-1 h-6 rounded border border-line text-[10px] font-bold grid place-items-center text-muted">Reject</span>
        </div>
      </div>
    </Frame>
  );
}

export function TaxArt() {
  return (
    <Frame>
      <div className="w-[240px] rounded-lg bg-white shadow-lg overflow-hidden">
        <div className="bg-navy text-white text-[10.5px] font-bold px-3 py-2 flex items-center gap-1.5"><BarChart3 className="size-3.5" /> Schedule E · Tax year</div>
        {[["3 Rents received", "$64,200"], ["7 Cleaning & maint.", "$2,140"], ["9 Insurance", "$3,380"], ["14 Repairs", "$5,912"], ["16 Taxes", "$7,480"]].map(([l, v]) => (
          <div key={l} className="flex justify-between px-3 py-1.5 text-[10.5px] border-t border-line"><span className="text-body">{l}</span><span className="font-bold text-ink">{v}</span></div>
        ))}
      </div>
    </Frame>
  );
}
