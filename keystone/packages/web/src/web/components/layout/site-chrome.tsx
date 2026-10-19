import type { ReactNode } from "react";
import { Link } from "wouter";
import { Logo } from "../logo";
import { authClient } from "../../lib/auth";

export function SiteNav() {
  const { data: session } = authClient.useSession();
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
      <div className="max-w-[1240px] mx-auto h-[72px] px-5 flex items-center gap-8">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-[15px] font-medium text-ink">
          <a href="/#services" className="hover:text-brand">Features</a>
          <Link href="/pricing" className="hover:text-brand">Pricing</Link>
          <a href="/#roles" className="hover:text-brand">For Tenants & Vendors</a>
          <a href="/#cpa" className="hover:text-brand">For CPAs</a>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {session ? (
            <Link href="/dashboard" className="h-11 px-5 rounded-md bg-brand text-white font-semibold text-[15px] inline-flex items-center hover:bg-brand-dark">
              Open App
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="hidden sm:inline-flex h-11 px-4 items-center font-semibold text-[15px] text-brand hover:underline">
                Sign In
              </Link>
              <Link href="/sign-in?mode=signup" className="h-11 px-5 rounded-md bg-brand text-white font-semibold text-[15px] inline-flex items-center hover:bg-brand-dark">
                Get Started Free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-navy text-white/80">
      <div className="max-w-[1240px] mx-auto px-5 py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed max-w-xs">Screening, leases, rent, maintenance and tax-ready books — one place for independent landlords and the people they work with.</p>
        </div>
        {[
          { h: "Product", l: [["Tenant Screening", "/#services"], ["Lease E-Sign", "/#services"], ["Rent Collection", "/#services"], ["Reports", "/#services"]] },
          { h: "Plans", l: [["Essentials — Free", "/pricing"], ["Manage", "/pricing"], ["Pro", "/pricing"]] },
          { h: "Access", l: [["Sign In", "/sign-in"], ["Try the demo", "/sign-in"], ["Create account", "/sign-in?mode=signup"]] },
        ].map((c) => (
          <div key={c.h}>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white mb-3">{c.h}</p>
            <ul className="space-y-2 text-sm">
              {c.l.map(([t, h]) => (
                <li key={t}>
                  <a href={h} className="hover:text-white">{t}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="max-w-[1240px] mx-auto px-5 py-5 text-xs text-white/50">© {new Date().getFullYear()} Keystone. Screening results shown in this app are simulated (TransUnion SmartMove sandbox). Not tax advice.</p>
      </div>
    </footer>
  );
}

export function SitePage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
