import { useState } from "react";
import { Users, UserPlus, Copy, Check, Trash2, Home, HardHat, Calculator, Crown } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Table, Modal, Field, Input, Select, ErrorNote } from "../../components/ui/kit";
import { useUsers, useInviteUser, useRevokeInvite, useRemoveUser } from "../../queries/users";
import { useVendors } from "../../queries/maintenance";
import { useLeases } from "../../queries/leases";
import { useFeature, UpgradeNote } from "../../components/plan-gate";
import { useMeData } from "../../components/session";
import { fmtDate, errMsg, timeAgo } from "../../lib/format";

const ROLE_ICON = { landlord: Crown, tenant: Home, vendor: HardHat, cpa: Calculator } as const;
const ROLE_NAME: Record<string, string> = { landlord: "Owner", tenant: "Tenant", vendor: "Vendor", cpa: "CPA / Accountant" };

export default function UsersPage() {
  const q = useUsers();
  const me = useMeData();
  const revoke = useRevokeInvite();
  const remove = useRemoveUser();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  if (q.isLoading) return <Loading />;
  const { members, invites } = q.data!;
  const pending = invites.filter((i) => !i.acceptedAt);
  return (
    <div>
      <PageHeader icon={<Users />} title="Manage Users" subtitle="Everyone with access to this workspace. Each role gets its own login and portal." actions={<Button icon={<UserPlus className="size-4" />} onClick={() => setOpen(true)}>Invite user</Button>} />
      <div className="grid sm:grid-cols-4 gap-4 mb-6 stagger">
        {(["landlord", "tenant", "vendor", "cpa"] as const).map((r) => {
          const Icon = ROLE_ICON[r];
          return (
            <div key={r} className="bg-white border border-line rounded-lg p-4 flex items-center gap-3">
              <div className="size-10 rounded-md bg-tint text-brand grid place-items-center"><Icon className="size-5" /></div>
              <div><p className="text-2xl font-bold text-ink leading-none">{members.filter((m) => m.role === r).length}</p><p className="text-xs text-muted mt-1">{ROLE_NAME[r]}{r === "landlord" ? "" : "s"}</p></div>
            </div>
          );
        })}
      </div>
      <Card title="Members" bodyClass="p-0" className="mb-6">
        <Table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <td className="font-semibold text-ink">{m.name}{m.userId === me.user.id && <span className="text-muted font-normal"> (you)</span>}</td>
                <td className="text-muted">{m.email}</td>
                <td><Pill tone={m.role === "landlord" ? "navy" : "blue"}>{ROLE_NAME[m.role] ?? m.role}</Pill></td>
                <td className="text-muted">{fmtDate(m.createdAt)}</td>
                <td className="text-right">{m.userId !== me.user.id && <button title="Remove access" className="text-muted hover:text-bad cursor-pointer" onClick={() => confirm(`Remove ${m.name}'s access?`) && remove.mutate({ userId: m.userId })}><Trash2 className="size-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card title="Pending invites" info="Invite links are single-use. We email them automatically; you can also copy and text them." bodyClass="p-0">
        {!pending.length ? (
          <Empty title="No pending invites">Invite links for tenants are also created automatically when you send a lease.</Empty>
        ) : (
          <Table>
            <thead><tr><th>Name</th><th>Role</th><th>Created</th><th>Invite link</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {pending.map((i) => {
                const link = `${window.location.origin}/invite/${i.code}`;
                return (
                  <tr key={i.id}>
                    <td><p className="font-semibold text-ink">{i.name}</p><p className="text-xs text-muted">{i.email}</p></td>
                    <td><Pill tone="blue">{ROLE_NAME[i.role] ?? i.role}</Pill></td>
                    <td className="text-muted">{timeAgo(i.createdAt)}</td>
                    <td>
                      <button onClick={() => { navigator.clipboard.writeText(link); setCopied(i.id); setTimeout(() => setCopied(null), 1500); }} className="flex items-center gap-2 rounded-md bg-app px-3 py-1.5 text-xs text-body cursor-pointer hover:bg-line max-w-[320px]">
                        <span className="truncate">{link}</span>{copied === i.id ? <Check className="size-3.5 text-ok shrink-0" /> : <Copy className="size-3.5 text-brand shrink-0" />}
                      </button>
                    </td>
                    <td className="text-right"><Button size="sm" variant="ghost" className="text-bad" onClick={() => revoke.mutate({ id: i.id })}>Revoke</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {open && <InviteModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const invite = useInviteUser();
  const cpaOk = useFeature("cpa");
  const vendors = useVendors();
  const leases = useLeases();
  const [f, setF] = useState({ role: "cpa" as "tenant" | "vendor" | "cpa", name: "", email: "", vendorId: "", leaseId: "" });
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const link = code ? `${window.location.origin}/invite/${code}` : "";
  const blocked = f.role === "cpa" && !cpaOk;
  return (
    <Modal open onClose={onClose} title="Invite a user" footer={!code && <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={blocked} loading={invite.isPending} onClick={async () => { setErr(null); try { const r = await invite.mutateAsync({ role: f.role, name: f.name, email: f.email, vendorId: f.vendorId ? Number(f.vendorId) : undefined, leaseId: f.leaseId ? Number(f.leaseId) : undefined }); setCode(r.code); } catch (e) { setErr(errMsg(e)); } }}>Send invite</Button></>}>
      {code ? (
        <>
          <p className="text-sm text-body mb-3">Invite emailed to <b>{f.email}</b>. You can also share this link directly — they’ll create a login and land in their {f.role === "cpa" ? "CPA" : f.role} portal.</p>
          <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }} className="flex w-full items-center gap-2 rounded-md bg-app px-3 py-2.5 text-sm text-body cursor-pointer hover:bg-line">
            <span className="truncate flex-1 text-left">{link}</span>{copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4 text-brand" />}
          </button>
          <div className="flex justify-end mt-5"><Button onClick={onClose}>Done</Button></div>
        </>
      ) : (
        <div className="space-y-4">
          <Field label="Role">
            <Select value={f.role} onChange={set("role")}>
              <option value="cpa">CPA / Accountant — read-only books, reports & tax documents</option>
              <option value="tenant">Tenant — lease, rent ledger, maintenance requests</option>
              <option value="vendor">Vendor — work orders & invoices</option>
            </Select>
          </Field>
          {blocked && <UpgradeNote feature="cpa">Give your accountant their own login with read-only access to your books.</UpgradeNote>}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name"><Input value={f.name} onChange={set("name")} /></Field>
            <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} /></Field>
          </div>
          {f.role === "vendor" && (
            <Field label="Link to vendor record" hint="So their invoices and work orders connect.">
              <Select value={f.vendorId} onChange={set("vendorId")}><option value="">Create new vendor record</option>{(vendors.data ?? []).filter((v) => !v.userId).map((v) => <option key={v.id} value={v.id}>{v.company || v.name}</option>)}</Select>
            </Field>
          )}
          {f.role === "tenant" && (
            <Field label="Link to lease">
              <Select value={f.leaseId} onChange={set("leaseId")}><option value="">Choose a lease…</option>{(leases.data ?? []).filter((l) => !l.tenantUserId && l.status !== "ended").map((l) => <option key={l.id} value={l.id}>{l.tenantName} — {l.property?.name} {l.unit?.name}</option>)}</Select>
            </Field>
          )}
          <ErrorNote error={err} />
        </div>
      )}
    </Modal>
  );
}
