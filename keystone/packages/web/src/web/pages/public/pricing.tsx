import { useLocation } from "wouter";
import { SitePage } from "../../components/layout/site-chrome";
import { PlanCards, PlanMatrix } from "../../components/pricing-table";

const FAQ = [
  ["Is Essentials really free?", "Yes. Unlimited properties and units, listings, applications, screening, rent tracking, maintenance and documents — free forever."],
  ["What unlocks on Manage?", "The lease builder with unlimited in-app e-signatures, vendor invoice approvals, automatic late fees, CPA access and the Income Statement, Schedule E and Tenant Ledger reports."],
  ["Why Pro?", "Run multiple portfolios (e.g. separate LLCs), unlock every report with CSV export, and require a second approval for invoices over your threshold."],
  ["Who pays for screening?", "Screening is applicant-paid in the real integration. In this app, screening runs against a TransUnion SmartMove-style sandbox so you can try the full flow."],
];

export default function Pricing() {
  const [, nav] = useLocation();
  return (
    <SitePage>
      <section className="bg-[#eaf2fb]">
        <div className="max-w-[1140px] mx-auto px-5 pt-16 pb-20">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand text-center">Plans & Pricing</p>
          <h1 className="mt-3 text-[44px] font-extrabold text-navy text-center leading-tight">Simple pricing that grows with you</h1>
          <p className="mt-3 text-center text-lg text-body">Every plan includes unlimited properties and units.</p>
          <div className="mt-12">
            <PlanCards onSelect={() => nav("/sign-in?mode=signup")} />
          </div>
        </div>
      </section>
      <section className="max-w-[1140px] mx-auto px-5 py-16">
        <h2 className="text-[28px] font-extrabold text-navy mb-6">Compare features</h2>
        <PlanMatrix />
      </section>
      <section className="max-w-[900px] mx-auto px-5 pb-20">
        <h2 className="text-[28px] font-extrabold text-navy mb-6">Questions</h2>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="cursor-pointer list-none flex justify-between items-center font-semibold text-ink text-[17px]">
                {q}
                <span className="text-brand text-2xl leading-none group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-body leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </SitePage>
  );
}
