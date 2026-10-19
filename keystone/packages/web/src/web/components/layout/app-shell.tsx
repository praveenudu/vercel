import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, LogOut, Menu, CreditCard, X } from "lucide-react";
import { Logo, LogoMark } from "../logo";
import { NAV } from "./nav";
import { useMeData } from "../session";
import { signOut } from "../../lib/auth";
import { cn } from "../../lib/utils";
import { PLANS, type PlanId } from "../../../shared/plans";
import { useQueryClient } from "@tanstack/react-query";

const ROLE_LABEL: Record<string, string> = { landlord: "Landlord", tenant: "Tenant portal", vendor: "Vendor portal", cpa: "CPA access" };

function isActive(loc: string, href: string) {
  if (href === "/tenant" || href === "/vendor" || href === "/cpa") return loc === href;
  return loc === href || loc.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMeData();
  const [loc] = useLocation();
  const [expanded, setExpanded] = useState(() => localStorage.getItem("keystone.rail") === "open");
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = NAV[me.profile.role] ?? NAV.landlord;
  const isLandlord = me.profile.role === "landlord";

  useEffect(() => setMobileOpen(false), [loc]);
  const toggle = () => {
    setExpanded((e) => {
      localStorage.setItem("keystone.rail", e ? "closed" : "open");
      return !e;
    });
  };

  const tabs = isLandlord
    ? [
        { href: "/dashboard", label: "Manage", match: (l: string) => !l.startsWith("/reports") && !l.startsWith("/billing") },
        { href: "/reports", label: "Reports", match: (l: string) => l.startsWith("/reports") },
        { href: "/billing", label: "Plans", match: (l: string) => l.startsWith("/billing") },
      ]
    : [];

  const rail = (full: boolean) => (
    <nav className="flex flex-col h-full py-3">
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 space-y-1">
        {groups.map((g, gi) => (
          <div key={gi} className={cn(gi > 0 && "pt-2")}>
            {g.label && (full ? <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{g.label}</p> : <div className="mx-2 my-2 border-t border-line" />)}
            {g.items.map((it) => {
              const active = isActive(loc, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  title={full ? undefined : it.label}
                  className={cn(
                    "group relative flex items-center gap-3 h-11 rounded-md transition-colors",
                    full ? "px-3" : "justify-center",
                    active ? "bg-tint text-brand" : "text-ink hover:bg-app",
                  )}
                >
                  <it.icon className="size-[22px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                  {full && <span className={cn("text-[14px] truncate", active ? "font-semibold" : "font-medium")}>{it.label}</span>}
                  {!full && (
                    <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-md bg-navy px-2.5 py-1 text-xs font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      {it.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <button onClick={toggle} className={cn("hidden lg:flex items-center gap-2 h-10 mx-3 rounded-md text-brand hover:bg-app cursor-pointer", full ? "px-3" : "justify-center")}>
        {full ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
        {full && <span className="text-sm font-semibold">Collapse</span>}
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-app">
      <header className="no-print sticky top-0 z-40 h-16 bg-white border-b border-line flex items-center px-4 lg:px-5 gap-4">
        <button className="lg:hidden text-ink cursor-pointer" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="size-6" />
        </button>
        <Link href={isLandlord ? "/dashboard" : "/"} className="shrink-0">
          <Logo className="hidden sm:inline-flex" />
          <LogoMark className="sm:hidden text-navy" />
        </Link>
        {tabs.length > 0 && <div className="hidden md:block h-8 w-px bg-line mx-2" />}
        <div className="hidden md:flex items-stretch h-16 gap-6">
          {tabs.map((t) => (
            <Link key={t.label} href={t.href} className={cn("flex items-center text-[17px] border-b-[3px] transition-colors", t.match(loc) ? "border-brand text-brand font-semibold" : "border-transparent text-ink hover:text-brand")}>
              {t.label}
            </Link>
          ))}
          {!isLandlord && <span className="flex items-center text-[15px] font-semibold text-brand">{ROLE_LABEL[me.profile.role]}{me.profile.role !== "landlord" && <span className="ml-2 text-muted font-normal">· {me.ownerName}</span>}</span>}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {isLandlord && (
            <Link href="/billing" className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand">
              <CreditCard className="size-3.5" /> {PLANS[me.plan as PlanId]?.name ?? me.plan}
            </Link>
          )}
          <UserMenu />
        </div>
      </header>

      <div className="flex">
        <aside className={cn("no-print hidden lg:block sticky top-16 h-[calc(100vh-4rem)] bg-white border-r border-line shrink-0 transition-[width] duration-200", expanded ? "w-[248px]" : "w-[76px]")}>{rail(expanded)}</aside>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <button aria-label="Close menu" className="absolute inset-0 bg-navy/40 cursor-default" onClick={() => setMobileOpen(false)} />
            <aside className="relative w-[270px] h-full bg-white shadow-xl page-enter">
              <div className="h-16 flex items-center justify-between px-4 border-b border-line">
                <Logo />
                <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="cursor-pointer"><X className="size-5" /></button>
              </div>
              <div className="h-[calc(100%-4rem)]">{rail(true)}</div>
            </aside>
          </div>
        )}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-9 py-7 page-enter" key={loc}>
          <div className="max-w-[1320px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

function UserMenu() {
  const me = useMeData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [, nav] = useLocation();
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const initials = me.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 cursor-pointer">
        <span className="size-9 rounded-full bg-navy text-white grid place-items-center text-sm font-bold">{initials}</span>
        <span className="hidden md:block text-left leading-tight">
          <span className="block text-sm font-semibold text-ink">{me.user.name}</span>
          <span className="block text-xs text-muted">{ROLE_LABEL[me.profile.role]}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-line bg-white shadow-xl py-2 page-enter">
          <div className="px-4 py-2 border-b border-line mb-1">
            <p className="text-sm font-semibold text-ink truncate">{me.user.name}</p>
            <p className="text-xs text-muted truncate">{me.user.email}</p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              qc.clear();
              nav("/");
            }}
            className="w-full flex items-center gap-2 px-4 h-10 text-sm text-ink hover:bg-app cursor-pointer"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
