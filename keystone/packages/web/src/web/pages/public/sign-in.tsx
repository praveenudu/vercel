import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Building2, KeyRound, HardHat, Calculator, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "../../components/logo";
import { Button, Field, Input, ErrorNote } from "../../components/ui/kit";
import { authClient, emailSignIn, emailSignUp } from "../../lib/auth";
import { client } from "../../lib/api";
import { homeFor } from "../../components/session";
import { cn } from "../../lib/utils";

const DEMOS = [
  { role: "landlord", label: "Landlord", who: "Jordan Rivera · Pro plan", icon: Building2 },
  { role: "tenant", label: "Tenant", who: "Maya Chen · 1428 Maple St", icon: KeyRound },
  { role: "vendor", label: "Vendor", who: "Marco Diaz · Ace Plumbing", icon: HardHat },
  { role: "cpa", label: "CPA", who: "Dana Brooks, CPA", icon: Calculator },
] as const;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}

export default function SignIn() {
  const search = new URLSearchParams(useSearch());
  const next = search.get("next");
  const [mode, setMode] = useState<"signin" | "signup">(search.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { data: session } = authClient.useSession();

  const finish = async () => {
    await qc.invalidateQueries();
    if (next) return nav(next);
    const me = await client.me.get();
    nav(homeFor(me.profile.role));
  };

  useEffect(() => {
    if (session && !busy) void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const run = async (key: string, fn: () => Promise<{ error?: { message?: string } | null } | void>) => {
    setBusy(key);
    setError(null);
    try {
      const r = await fn();
      if (r && r.error) throw new Error(r.error.message || "Could not sign in");
      await finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run("email", () => (mode === "signin" ? emailSignIn(email, password) : emailSignUp(name, email, password)));
  };

  const google = () =>
    run("google", async () => {
      const r = await authClient.managedAuth.signIn({ provider: "google" });
      if (r.error && r.error.code === "POPUP_CLOSED") throw new Error("Sign-in window closed");
      return r;
    });

  const demo = (role: (typeof DEMOS)[number]["role"]) =>
    run(role, async () => {
      const c = await client.demo.credentials({ role });
      return emailSignIn(c.email, c.password);
    });

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.05fr] bg-white">
      <div className="flex flex-col px-6 sm:px-12 py-8">
        <Link href="/"><Logo /></Link>
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-[420px] mx-auto py-10 page-enter">
            <h1 className="text-[32px] font-extrabold text-navy">{mode === "signin" ? "Welcome back" : "Create your free account"}</h1>
            <p className="text-body mt-1.5">{mode === "signin" ? "Sign in to manage your rentals." : "Essentials is free forever. No credit card needed."}</p>

            <button onClick={google} disabled={!!busy} className="mt-7 w-full h-12 rounded-md border border-line bg-white flex items-center justify-center gap-3 font-semibold text-ink hover:bg-app cursor-pointer disabled:opacity-60">
              <GoogleIcon /> {busy === "google" ? "Connecting…" : "Continue with Google"}
            </button>
            <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted">
              <span className="flex-1 h-px bg-line" /> or <span className="flex-1 h-px bg-line" />
            </div>
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jordan Rivera" /></Field>
              )}
              <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" /></Field>
              <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" /></Field>
              <ErrorNote error={error} />
              <Button type="submit" size="lg" className="w-full" loading={busy === "email"}>
                {mode === "signin" ? "Sign In" : "Create Account"}
              </Button>
            </form>
            <p className="mt-5 text-sm text-center text-body">
              {mode === "signin" ? "New to Keystone? " : "Already have an account? "}
              <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-semibold text-brand hover:underline cursor-pointer">
                {mode === "signin" ? "Create a free account" : "Sign in"}
              </button>
            </p>

            <div className={cn("mt-9 rounded-xl border p-4", search.get("demo") ? "border-brand bg-tint/60" : "border-line bg-app/50")}>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Explore the live demo</p>
              <p className="text-sm text-body mt-1">One click signs you into a seeded workspace as:</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEMOS.map((d) => (
                  <button key={d.role} onClick={() => demo(d.role)} disabled={!!busy} className="group text-left rounded-lg bg-white border border-line px-3 py-2.5 hover:border-brand cursor-pointer disabled:opacity-60">
                    <span className="flex items-center gap-2 text-sm font-bold text-ink">
                      <d.icon className="size-4 text-brand" /> {busy === d.role ? "Signing in…" : d.label}
                      <ArrowRight className="size-3.5 ml-auto text-muted group-hover:text-brand" />
                    </span>
                    <span className="block text-[11px] text-muted mt-0.5 truncate">{d.who}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative bg-[#eaf2fb] overflow-hidden">
        <img src="/images/street.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-transparent" />
        <div className="absolute bottom-0 p-12 text-white max-w-lg">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#a9cbf0]">Keystone</p>
          <p className="mt-3 text-[30px] font-extrabold leading-tight">Screening, leases, rent, repairs and taxes — handled.</p>
        </div>
      </div>
    </div>
  );
}
