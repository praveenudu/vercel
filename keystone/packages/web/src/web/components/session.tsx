import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Redirect, useLocation } from "wouter";
import { authClient } from "../lib/auth";
import { useMe } from "../queries/me";
import { Loading } from "./ui/kit";

export type Role = "landlord" | "tenant" | "vendor" | "cpa";

export const homeFor = (role: string) => (role === "tenant" ? "/tenant" : role === "vendor" ? "/vendor" : role === "cpa" ? "/cpa" : "/dashboard");

export function useAuth() {
  const session = authClient.useSession();
  const me = useMe(!!session.data);
  return { session: session.data, pending: session.isPending || (!!session.data && me.isLoading), me: me.data, meError: me.error };
}

/** Guards a route: requires a session and (optionally) one of the given roles. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session, pending, me } = useAuth();
  const [loc] = useLocation();
  if (pending) return <Loading label="Loading your workspace…" />;
  if (!session) return <Redirect to={`/sign-in?next=${encodeURIComponent(loc)}`} />;
  if (!me) return <Loading />;
  if (roles && !roles.includes(me.profile.role as Role)) return <Redirect to={homeFor(me.profile.role)} />;
  return <PortfolioProvider>{children}</PortfolioProvider>;
}

type PortfolioCtx = { portfolioId: number | null; setPortfolioId: (id: number | null) => void };
const Ctx = createContext<PortfolioCtx>({ portfolioId: null, setPortfolioId: () => {} });
const KEY = "keystone.portfolio";

function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolioId, setId] = useState<number | null>(() => {
    const v = localStorage.getItem(KEY);
    return v ? Number(v) : null;
  });
  const { me } = useAuth();
  useEffect(() => {
    if (portfolioId && me && !me.portfolios.some((p) => p.id === portfolioId)) setId(null);
  }, [me, portfolioId]);
  const setPortfolioId = (id: number | null) => {
    setId(id);
    if (id) localStorage.setItem(KEY, String(id));
    else localStorage.removeItem(KEY);
  };
  return <Ctx.Provider value={{ portfolioId, setPortfolioId }}>{children}</Ctx.Provider>;
}

export const usePortfolio = () => useContext(Ctx);

/** The signed-in profile. Only use inside <RequireAuth>. */
export function useMeData() {
  const { me } = useAuth();
  if (!me) throw new Error("useMeData outside RequireAuth");
  return me;
}
