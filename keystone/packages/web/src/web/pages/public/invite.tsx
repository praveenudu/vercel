import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { MailOpen } from "lucide-react";
import { Logo } from "../../components/logo";
import { Button, Loading, ErrorNote } from "../../components/ui/kit";
import { useInvite, useAcceptInvite } from "../../queries/me";
import { authClient } from "../../lib/auth";
import { homeFor } from "../../components/session";
import { errMsg } from "../../lib/format";

const ROLE_COPY: Record<string, string> = {
  tenant: "Sign your lease, see your rent ledger, report payments and request maintenance.",
  vendor: "See work orders assigned to you, update job status and submit invoices.",
  cpa: "Read-only access to the books, tax reports and shared documents.",
};

export default function Invite() {
  const { code } = useParams<{ code: string }>();
  const inv = useInvite(code);
  const { data: session } = authClient.useSession();
  const accept = useAcceptInvite();
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const [err, setErr] = useState<unknown>(null);

  const doAccept = async () => {
    setErr(null);
    try {
      const r = await accept.mutateAsync({ code });
      await qc.invalidateQueries();
      nav(homeFor(r.role));
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <div className="min-h-screen bg-[#eaf2fb] flex flex-col items-center px-5 py-10">
      <Link href="/"><Logo /></Link>
      <div className="mt-10 w-full max-w-md rounded-xl bg-white border border-line shadow-xl p-8 page-enter">
        {inv.isLoading ? (
          <Loading />
        ) : inv.error || !inv.data ? (
          <p className="text-center text-body">This invite link is invalid or has expired. Ask your landlord to send a new one.</p>
        ) : inv.data.accepted ? (
          <div className="text-center">
            <p className="font-semibold text-ink">This invite has already been accepted.</p>
            <Link href="/sign-in" className="mt-4 inline-block font-semibold text-brand">Sign in →</Link>
          </div>
        ) : (
          <>
            <span className="size-12 rounded-full bg-tint text-brand grid place-items-center"><MailOpen className="size-6" /></span>
            <h1 className="mt-4 text-2xl font-extrabold text-navy">{inv.data.landlordName} invited you</h1>
            <p className="mt-1 text-body">
              Join as <b className="capitalize text-ink">{inv.data.role === "cpa" ? "CPA" : inv.data.role}</b>{inv.data.name ? `, ${inv.data.name}` : ""}.
            </p>
            <p className="mt-3 text-sm text-muted">{ROLE_COPY[inv.data.role]}</p>
            <div className="mt-6 space-y-3">
              <ErrorNote error={err} />
              {session ? (
                <Button size="lg" className="w-full" onClick={doAccept} loading={accept.isPending}>
                  Accept as {session.user.email}
                </Button>
              ) : (
                <>
                  <Button size="lg" className="w-full" onClick={() => nav(`/sign-in?mode=signup&next=${encodeURIComponent(`/invite/${code}`)}`)}>
                    Create account to accept
                  </Button>
                  <Button size="lg" variant="outline" className="w-full" onClick={() => nav(`/sign-in?next=${encodeURIComponent(`/invite/${code}`)}`)}>
                    I already have an account
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
