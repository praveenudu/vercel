import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { PLANS, PLAN_ORDER, type PlanId } from "../../shared/plans";
import { cn } from "../lib/utils";

export type Cycle = "annual" | "monthly";

export function CycleToggle({ cycle, onChange }: { cycle: Cycle; onChange: (c: Cycle) => void }) {
  return (
    <div className="inline-flex rounded-full bg-white border border-line p-1 shadow-sm">
      {(["annual", "monthly"] as const).map((c) => (
        <button key={c} onClick={() => onChange(c)} className={cn("h-10 px-5 rounded-full text-sm font-semibold cursor-pointer transition-colors", cycle === c ? "bg-brand text-white" : "text-ink hover:text-brand")}>
          {c === "annual" ? "Billed annually" : "Billed monthly"}
          {c === "annual" && <span className={cn("ml-2 text-xs font-bold", cycle === c ? "text-white/85" : "text-ok")}>Save 20%</span>}
        </button>
      ))}
    </div>
  );
}

export function PlanCards({ current, onSelect, ctaLabel, busy, cycle: cycleProp, onCycle }: { current?: PlanId; onSelect: (p: PlanId, cycle: Cycle) => void; ctaLabel?: (p: PlanId) => string; busy?: PlanId | null; cycle?: Cycle; onCycle?: (c: Cycle) => void }) {
  const [local, setLocal] = useState<Cycle>("annual");
  const cycle = cycleProp ?? local;
  const setCycle = onCycle ?? setLocal;
  return (
    <div>
      <div className="flex justify-center mb-8">
        <CycleToggle cycle={cycle} onChange={setCycle} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3 items-stretch">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const price = cycle === "annual" ? p.annual : p.monthly;
          const featured = id === "manage";
          const isCurrent = current === id;
          return (
            <div key={id} className={cn("relative flex flex-col rounded-xl bg-white border p-7", featured ? "border-brand shadow-[0_18px_50px_-20px_rgba(47,110,181,0.5)] lg:-translate-y-2" : "border-line")}>
              {featured && <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Most popular</span>}
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{p.name}</p>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-[44px] leading-none font-extrabold text-ink">{price === 0 ? "Free" : `$${price}`}</span>
                {price > 0 && <span className="text-muted text-sm mb-1.5">/mo</span>}
              </div>
              <p className="text-xs text-muted mt-1.5 h-4">{price > 0 ? (cycle === "annual" ? `$${price * 12} billed annually` : "billed monthly, cancel anytime") : "forever"}</p>
              <p className="mt-4 text-[15px] text-body">{p.tagline}</p>
              <button
                onClick={() => onSelect(id, cycle)}
                disabled={isCurrent || busy === id}
                className={cn(
                  "mt-6 h-12 rounded-md font-semibold text-[15px] transition-colors cursor-pointer disabled:cursor-default",
                  isCurrent ? "bg-app text-muted" : featured ? "bg-brand text-white hover:bg-brand-dark" : "border border-brand text-brand hover:bg-tint",
                )}
              >
                {busy === id ? "Updating…" : isCurrent ? "Current plan" : (ctaLabel?.(id) ?? (id === "essentials" ? "Get Started Free" : `Start ${p.name}`))}
              </button>
              <ul className="mt-7 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="size-4 text-ok mt-0.5 shrink-0" strokeWidth={3} />
                    <span className={cn(f.startsWith("Everything") ? "font-semibold text-ink" : "text-body")}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MATRIX: [string, boolean | string, boolean | string, boolean | string][] = [
  ["Properties & units", "Unlimited", "Unlimited", "Unlimited"],
  ["Portfolios", "1", "1", "Unlimited"],
  ["Listings & online applications", true, true, true],
  ["Tenant screening (TransUnion-style)", true, true, true],
  ["Rent tracking & tenant ledgers", true, true, true],
  ["Maintenance requests & vendor work orders", true, true, true],
  ["Lease builder + in-app e-signature", false, true, true],
  ["Vendor invoice approvals", false, true, true],
  ["Automatic late fees", false, true, true],
  ["CPA login + tax document sharing", false, true, true],
  ["Reports", "2 core", "5 incl. Schedule E", "Unlimited (8)"],
  ["CSV export", false, false, true],
  ["Two-step approvals over threshold", false, false, true],
];

export function PlanMatrix() {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-app/70">
            <th className="text-left px-5 py-4 font-semibold text-ink">Compare plans</th>
            {PLAN_ORDER.map((p) => (
              <th key={p} className="px-5 py-4 font-bold text-ink text-center w-[18%]">{PLANS[p].name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX.map(([label, ...vals]) => (
            <tr key={label} className="border-t border-line">
              <td className="px-5 py-3.5 text-body">{label}</td>
              {vals.map((v, i) => (
                <td key={i} className="px-5 py-3.5 text-center">
                  {v === true ? <Check className="size-4 text-ok mx-auto" strokeWidth={3} /> : v === false ? <Minus className="size-4 text-line mx-auto" /> : <span className="font-semibold text-ink">{v}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
