import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { SignatureView } from "./signature-pad";
import { LogoMark } from "./logo";
import { money, fmtDate, fmtDateTime } from "../lib/format";

type LeaseLike = {
  id: number;
  tenantName: string;
  tenantEmail: string;
  startDate: string;
  endDate: string;
  rent: number;
  deposit: number;
  dueDay: number;
  lateFee: number;
  graceDays: number;
  clauses: string;
  status: string;
  signMethod: string;
  tenantSignature: string | null;
  tenantSignatureType: string | null;
  tenantSignedAt: Date | string | null;
  tenantSignIp: string | null;
  landlordSignature: string | null;
  landlordSignatureType: string | null;
  landlordSignedAt: Date | string | null;
  sentAt: Date | string | null;
  unit: { name: string } | null;
  property: { name: string; address: string; city: string; state: string; zip: string } | null;
  landlordName: string;
};

const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** The rendered lease: summary, clauses and signature blocks with an audit trail. */
export function LeaseDocument({ lease, children }: { lease: LeaseLike; children?: ReactNode }) {
  const addr = lease.property ? `${lease.property.address}, ${lease.unit?.name ?? ""}, ${lease.property.city}, ${lease.property.state} ${lease.property.zip}` : "";
  return (
    <article className="bg-white border border-line rounded-lg shadow-sm print:shadow-none print:border-0">
      <header className="flex items-center gap-3 border-b border-line px-8 py-6">
        <LogoMark className="size-9" />
        <div>
          <h2 className="text-xl font-bold text-ink">Residential Lease Agreement</h2>
          <p className="text-xs text-muted">Lease #{String(lease.id).padStart(5, "0")} · {addr}</p>
        </div>
      </header>
      <div className="px-8 py-6">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg bg-app p-4 text-sm">
          {[
            ["Landlord", lease.landlordName],
            ["Tenant", lease.tenantName],
            ["Term", `${fmtDate(lease.startDate)} – ${fmtDate(lease.endDate)}`],
            ["Monthly rent", money(lease.rent)],
            ["Due", `${ord(lease.dueDay)} of each month`],
            ["Security deposit", money(lease.deposit)],
            ["Late fee", `${money(lease.lateFee)} after ${lease.graceDays} days`],
            ["Tenant email", lease.tenantEmail],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
              <dd className="text-ink font-medium break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 text-[14px] leading-relaxed text-body whitespace-pre-line">{lease.clauses}</div>

        <div className="mt-8 grid sm:grid-cols-2 gap-6">
          <SigBlock party="Tenant" name={lease.tenantName} sig={lease.tenantSignature} type={lease.tenantSignatureType} at={lease.tenantSignedAt} ip={lease.tenantSignIp} />
          <SigBlock party="Landlord" name={lease.landlordName} sig={lease.landlordSignature} type={lease.landlordSignatureType} at={lease.landlordSignedAt} offline={lease.signMethod === "upload"} />
        </div>
        {children}
        {(lease.tenantSignedAt || lease.landlordSignedAt) && lease.signMethod === "esign" && (
          <div className="mt-6 rounded-lg border border-line p-4 text-xs text-muted">
            <p className="flex items-center gap-1.5 font-semibold text-ink mb-1"><ShieldCheck className="size-4 text-ok" /> Certificate of completion</p>
            {lease.sentAt && <p>Sent for signature · {fmtDateTime(lease.sentAt)}</p>}
            {lease.tenantSignedAt && <p>Signed by {lease.tenantName} ({lease.tenantEmail}) · {fmtDateTime(lease.tenantSignedAt)} · IP {lease.tenantSignIp ?? "—"} · {lease.tenantSignatureType} signature</p>}
            {lease.landlordSignedAt && <p>Countersigned by {lease.landlordName} · {fmtDateTime(lease.landlordSignedAt)} · {lease.landlordSignatureType} signature</p>}
            <p className="mt-1">Electronic signatures are legally binding under the U.S. E-SIGN Act and UETA.</p>
          </div>
        )}
      </div>
    </article>
  );
}

function SigBlock({ party: role, name, sig, type, at, ip, offline }: { party: string; name: string; sig: string | null; type: string | null; at: Date | string | null; ip?: string | null; offline?: boolean }) {
  return (
    <div>
      <div className="h-20 border-b-2 border-ink/70 flex items-end pb-1">
        {offline && at ? <span className="text-sm text-muted italic">Signed on paper — copy on file</span> : <SignatureView signature={sig} type={type} />}
      </div>
      <p className="text-sm font-semibold text-ink mt-2">{name || role}</p>
      <p className="text-xs text-muted">{role}{at ? ` · ${fmtDateTime(at)}` : ""}{ip ? ` · IP ${ip}` : ""}</p>
    </div>
  );
}
