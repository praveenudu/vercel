import { Link, useLocation } from "wouter";
import { motion } from "motion/react";
import { ArrowRight, Check, Star, Building2, KeyRound, HardHat, Calculator, ShieldCheck } from "lucide-react";
import { SitePage } from "../../components/layout/site-chrome";
import { PlanCards } from "../../components/pricing-table";
import { ScreeningArt, RentArt, LeaseArt, MaintenanceArt, InvoiceArt, TaxArt } from "./vignettes";

const SERVICES = [
  { label: "Tenant Screening", title: "Find great tenants, faster", copy: "Publish a listing, collect online applications and run TransUnion-style credit, eviction and criminal checks with a 100-point score.", Art: ScreeningArt },
  { label: "Lease Agreements", title: "Leases signed in minutes", copy: "Generate a state-ready lease from the approved application, send it for typed or drawn e-signature, and countersign — every signature timestamped.", Art: LeaseArt },
  { label: "Rent Collection", title: "Never lose track of rent", copy: "Tenants report Zelle, check or cash payments; you confirm in one click. Automatic monthly charges, late fees and running ledgers.", Art: RentArt },
  { label: "Maintenance", title: "Repairs, handled end to end", copy: "Tenants submit requests with photos, you assign a vendor, and they update the work order from their own portal.", Art: MaintenanceArt },
  { label: "Vendor Invoices", title: "Approve every dollar", copy: "Vendors submit itemized invoices against the job. Approve, reject or require a second approval over your threshold — then pay and book it.", Art: InvoiceArt },
  { label: "Taxes & CPA", title: "Tax season, solved", copy: "Every transaction lands on a Schedule E line. Invite your CPA to pull reports and 1098s, receipts and W-9s without a single email.", Art: TaxArt },
];

export default function Landing() {
  const [, nav] = useLocation();
  return (
    <SitePage>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#eaf2fb]">
        <div className="absolute -right-40 -top-40 size-[640px] rounded-full bg-white/50" />
        <div className="absolute right-[30%] -bottom-56 size-[420px] rounded-full bg-[#dbe9f8]" />
        <div className="relative max-w-[1240px] mx-auto px-5 pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-[1.02fr_1fr] gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand">The all-in-one app for landlords</p>
            <h1 className="mt-4 text-[44px] sm:text-[56px] leading-[1.05] font-extrabold text-navy">
              Manage rentals from <span className="text-brand">application</span> to <span className="text-brand">tax time.</span>
            </h1>
            <p className="mt-6 text-lg text-body max-w-[540px] leading-relaxed">
              Screen tenants, e-sign leases, track every rent payment, run maintenance with your vendors and hand your CPA tax-ready books — all in Keystone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/sign-in?mode=signup" className="h-14 px-7 rounded-md bg-brand text-white font-bold text-[16px] inline-flex items-center gap-2 hover:bg-brand-dark shadow-lg shadow-brand/25">
                Get Started Free <ArrowRight className="size-5" />
              </Link>
              <button onClick={() => nav("/sign-in?demo=1")} className="h-14 px-7 rounded-md bg-white border border-brand text-brand font-bold text-[16px] hover:bg-tint cursor-pointer">
                Explore the live demo
              </button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-body">
              {["Free forever plan", "No credit card", "Unlimited units"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-ok" strokeWidth={3} /> {t}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-navy/20 aspect-[4/3]">
              <img src="/images/hero-house.jpg" alt="Single-family rental home with a wraparound porch" className="size-full object-cover" />
            </div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="absolute -left-6 sm:-left-10 bottom-8 w-[230px] rounded-xl bg-white shadow-xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Net Cash Flow · YTD</p>
              <p className="text-[26px] font-extrabold text-ok mt-1">+$38,412</p>
              <div className="mt-2 flex items-end gap-1 h-10">
                {[40, 55, 48, 62, 58, 70, 66, 78, 74, 85].map((h, i) => (
                  <span key={i} className="flex-1 rounded-sm bg-brand/80" style={{ height: `${h}%` }} />
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="absolute -right-3 sm:-right-6 top-8 rounded-xl bg-white shadow-xl px-4 py-3 flex items-center gap-3">
              <span className="size-9 rounded-full bg-ok-tint text-ok grid place-items-center"><ShieldCheck className="size-5" /></span>
              <div className="leading-tight">
                <p className="text-[13px] font-bold text-ink">Application approved</p>
                <p className="text-[11px] text-muted">Score 86/100 · low risk</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-b border-line">
        <div className="max-w-[1240px] mx-auto px-5 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            ["$0", "to get started"],
            ["4 roles", "landlord · tenant · vendor · CPA"],
            ["15 lines", "mapped to IRS Schedule E"],
            ["8 reports", "from cash flow to 1099s"],
          ].map(([a, b]) => (
            <div key={a}>
              <p className="text-[28px] font-extrabold text-navy">{a}</p>
              <p className="text-sm text-muted">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SAVINGS LINE */}
      <section className="max-w-[1240px] mx-auto px-5 pt-20 text-center">
        <div className="inline-flex items-center gap-1 text-warn">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-5 fill-current" />
          ))}
        </div>
        <h2 className="mt-3 text-[34px] sm:text-[40px] font-extrabold text-navy leading-tight max-w-3xl mx-auto">Replace the spreadsheet, the lease PDF, the rent notebook and the shoebox of receipts.</h2>
        <p className="mt-4 text-lg text-body max-w-2xl mx-auto">One workflow for every rental — and a login for everyone who touches it.</p>
      </section>

      {/* SERVICES */}
      <section id="services" className="max-w-[1240px] mx-auto px-5 py-16 scroll-mt-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <motion.article
              key={s.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              className="group rounded-xl bg-white border border-line p-5 shadow-[0_2px_10px_-4px_rgba(27,58,92,0.12)] hover:shadow-[0_18px_40px_-18px_rgba(27,58,92,0.35)] transition-shadow flex flex-col"
            >
              <s.Art />
              <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.18em] text-brand">{s.label}</p>
              <h3 className="mt-2 text-[22px] font-extrabold text-navy leading-snug">{s.title}</h3>
              <p className="mt-2 text-[15px] text-body leading-relaxed flex-1">{s.copy}</p>
              <Link href="/sign-in?demo=1" className="mt-5 self-start h-11 px-5 rounded-md border border-brand text-brand font-semibold text-[15px] inline-flex items-center gap-2 group-hover:bg-brand group-hover:text-white transition-colors">
                Learn More <ArrowRight className="size-4" />
              </Link>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" className="bg-app scroll-mt-20">
        <div className="max-w-[1240px] mx-auto px-5 py-20">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand text-center">Built for the whole team</p>
          <h2 className="mt-3 text-[34px] font-extrabold text-navy text-center">Everyone gets their own login</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Building2, t: "Landlords", d: "Run the portfolio: properties, screening, leases, rent, approvals and reports." },
              { icon: KeyRound, t: "Tenants", d: "Apply online, e-sign the lease, report payments, see the ledger and request repairs." },
              { icon: HardHat, t: "Vendors", d: "See assigned work orders, update job status and submit itemized invoices." },
              { icon: Calculator, t: "CPAs", d: "Read-only books, Schedule E worksheet, 1099 summary and shared tax documents." },
            ].map((r) => (
              <div key={r.t} className="rounded-xl bg-white border border-line p-6">
                <span className="size-12 rounded-lg bg-tint text-brand grid place-items-center"><r.icon className="size-6" /></span>
                <h3 className="mt-4 text-lg font-bold text-navy">{r.t}</h3>
                <p className="mt-1.5 text-sm text-body leading-relaxed">{r.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted">Tenants, vendors and CPAs join from a secure invite link you send from Manage Users.</p>
        </div>
      </section>

      {/* CPA BAND */}
      <section id="cpa" className="bg-navy text-white scroll-mt-20">
        <div className="max-w-[1240px] mx-auto px-5 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#8db8ea]">Tax-ready, year-round</p>
            <h2 className="mt-3 text-[36px] font-extrabold leading-tight">Your CPA logs in. You skip the April scramble.</h2>
            <p className="mt-4 text-white/75 text-lg leading-relaxed">Rent, invoices and manual expenses are categorized as they happen. Your accountant pulls the Schedule E worksheet, P&L and 1099 vendor summary and downloads the 1098s and receipts you've shared.</p>
            <ul className="mt-6 space-y-2.5 text-white/85">
              {["Schedule E worksheet by property", "1099-NEC flag for vendors paid $600+", "Receipts auto-filed when invoices are paid"].map((t) => (
                <li key={t} className="flex gap-2.5"><Check className="size-5 text-[#8db8ea]" strokeWidth={3} />{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-white text-ink overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <p className="font-bold">Schedule E Worksheet</p>
              <span className="text-xs font-semibold rounded-full bg-tint text-brand px-2.5 py-1">Tax year {new Date().getFullYear() - 1}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-app/70 text-xs uppercase tracking-wide text-muted">
                <tr><th className="text-left px-5 py-2.5">Line</th><th className="text-right px-5 py-2.5">Maple St</th><th className="text-right px-5 py-2.5">Oak Duplex</th></tr>
              </thead>
              <tbody>
                {[["3 · Rents received", "$22,200", "$42,000"], ["9 · Insurance", "$1,240", "$2,140"], ["12 · Mortgage interest", "$6,810", "$11,920"], ["14 · Repairs", "$1,860", "$4,052"], ["16 · Taxes", "$2,980", "$4,500"]].map((r) => (
                  <tr key={r[0]} className="border-t border-line"><td className="px-5 py-2.5">{r[0]}</td><td className="px-5 py-2.5 text-right font-semibold">{r[1]}</td><td className="px-5 py-2.5 text-right font-semibold">{r[2]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-[#eaf2fb] scroll-mt-20">
        <div className="max-w-[1140px] mx-auto px-5 py-20">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand text-center">Pricing</p>
          <h2 className="mt-3 text-[36px] font-extrabold text-navy text-center">Start free. Upgrade when you're ready.</h2>
          <p className="mt-3 text-center text-body">E-signatures and advanced reports unlock on Manage. Pro adds unlimited portfolios and unlimited reports.</p>
          <div className="mt-10">
            <PlanCards onSelect={() => nav("/sign-in?mode=signup")} />
          </div>
          <p className="mt-8 text-center">
            <Link href="/pricing" className="font-semibold text-brand hover:underline">Compare every feature →</Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1240px] mx-auto px-5 py-20">
        <div className="rounded-2xl overflow-hidden relative">
          <img src="/images/street.jpg" alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/90 to-navy/40" />
          <div className="relative px-8 sm:px-14 py-16 max-w-xl">
            <h2 className="text-[34px] font-extrabold text-white leading-tight">Your rentals, finally organized.</h2>
            <p className="mt-3 text-white/80 text-lg">Set up your first property in under five minutes.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/sign-in?mode=signup" className="h-13 px-7 py-3.5 rounded-md bg-white text-brand font-bold hover:bg-tint">Get Started Free</Link>
              <Link href="/sign-in?demo=1" className="h-13 px-7 py-3.5 rounded-md border border-white/60 text-white font-bold hover:bg-white/10">Try the demo</Link>
            </div>
          </div>
        </div>
      </section>
    </SitePage>
  );
}
