import { useState } from "react";
import { HardHat, Plus, Pencil, Mail, Phone, Send, Copy, Check, FileCheck2, FileWarning } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Table, Modal, Field, Input, Select, ErrorNote } from "../../components/ui/kit";
import { useVendors, useCreateVendor, useUpdateVendor } from "../../queries/maintenance";
import { useInviteUser } from "../../queries/users";
import { TRADES, tradeLabel } from "../../lib/constants";
import { money, errMsg } from "../../lib/format";

type Vendor = NonNullable<ReturnType<typeof useVendors>["data"]>[number];

export default function VendorsPage() {
  const q = useVendors();
  const [edit, setEdit] = useState<Vendor | "new" | null>(null);
  const [invite, setInvite] = useState<Vendor | null>(null);
  return (
    <div>
      <PageHeader icon={<HardHat />} title="Vendors" subtitle="Your go-to pros, their W-9 status and year-to-date payments for 1099s." actions={<Button icon={<Plus className="size-4" />} onClick={() => setEdit("new")}>Add vendor</Button>} />
      <Card bodyClass="p-0">
        {q.isLoading ? (
          <Loading />
        ) : !q.data?.length ? (
          <Empty icon={<HardHat />} title="No vendors yet" action={<Button onClick={() => setEdit("new")}>Add vendor</Button>}>Add plumbers, electricians and handymen so you can dispatch work orders in one click.</Empty>
        ) : (
          <Table>
            <thead><tr><th>Vendor</th><th>Trade</th><th>Contact</th><th>W-9</th><th className="!text-right">Paid YTD</th><th>Portal</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {q.data.map((v) => (
                <tr key={v.id}>
                  <td><p className="font-semibold text-ink">{v.company || v.name}</p>{v.company && <p className="text-xs text-muted">{v.name}</p>}</td>
                  <td>{tradeLabel(v.trade)}</td>
                  <td className="text-xs"><p className="flex items-center gap-1"><Mail className="size-3.5 text-muted" />{v.email || "—"}</p><p className="flex items-center gap-1 mt-0.5"><Phone className="size-3.5 text-muted" />{v.phone || "—"}</p></td>
                  <td>{v.w9OnFile ? <span className="flex items-center gap-1 text-ok text-xs font-semibold"><FileCheck2 className="size-4" />On file{v.taxIdLast4 && ` ·••${v.taxIdLast4}`}</span> : <span className="flex items-center gap-1 text-warn text-xs font-semibold"><FileWarning className="size-4" />Missing</span>}</td>
                  <td className="text-right font-semibold">{money(v.ytdPaid)}{v.ytdPaid >= 60000 && <Pill tone="red" className="ml-2">1099</Pill>}</td>
                  <td>{v.userId ? <Pill tone="green">Active</Pill> : <Button size="sm" variant="outline" icon={<Send className="size-3.5" />} onClick={() => setInvite(v)}>Invite</Button>}</td>
                  <td className="text-right"><button className="text-muted hover:text-brand cursor-pointer" title="Edit" onClick={() => setEdit(v)}><Pencil className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {edit && <VendorModal vendor={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {invite && <InviteVendorModal vendor={invite} onClose={() => setInvite(null)} />}
    </div>
  );
}

function VendorModal({ vendor, onClose }: { vendor: Vendor | null; onClose: () => void }) {
  const create = useCreateVendor();
  const update = useUpdateVendor();
  const [f, setF] = useState({ name: vendor?.name ?? "", company: vendor?.company ?? "", trade: vendor?.trade ?? "general", email: vendor?.email ?? "", phone: vendor?.phone ?? "", taxIdLast4: vendor?.taxIdLast4 ?? "", w9OnFile: vendor?.w9OnFile ?? false });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    try {
      if (vendor) await update.mutateAsync({ id: vendor.id, ...f });
      else await create.mutateAsync(f);
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  return (
    <Modal open onClose={onClose} title={vendor ? "Edit vendor" : "Add vendor"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={create.isPending || update.isPending} onClick={save}>Save</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Contact name"><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Company"><Input value={f.company} onChange={set("company")} /></Field>
        <Field label="Trade"><Select value={f.trade} onChange={set("trade")}>{TRADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Email" className="sm:col-span-2"><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Tax ID (last 4)"><Input maxLength={4} value={f.taxIdLast4} onChange={set("taxIdLast4")} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink mt-7 cursor-pointer"><input type="checkbox" aria-label="W-9 on file" className="size-4 accent-brand" checked={f.w9OnFile} onChange={(e) => setF((x) => ({ ...x, w9OnFile: e.target.checked }))} />W-9 on file</label>
      </div>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}

export function InviteVendorModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const invite = useInviteUser();
  const [email, setEmail] = useState(vendor.email);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const link = code ? `${window.location.origin}/invite/${code}` : "";
  return (
    <Modal open onClose={onClose} title={`Invite ${vendor.company || vendor.name} to the vendor portal`}>
      {!code ? (
        <>
          <p className="text-sm text-body mb-4">They’ll see work orders you assign, update job status and submit invoices for approval.</p>
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="mt-3"><ErrorNote error={err} /></div>
          <div className="flex justify-end mt-5"><Button loading={invite.isPending} onClick={async () => { try { const r = await invite.mutateAsync({ role: "vendor", name: vendor.name, email, vendorId: vendor.id }); setCode(r.code); } catch (e) { setErr(errMsg(e)); } }}>Create invite link</Button></div>
        </>
      ) : (
        <>
          <p className="text-sm text-body mb-3">Send this link to <b>{email}</b>:</p>
          <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }} className="flex w-full items-center gap-2 rounded-md bg-app px-3 py-2.5 text-sm text-body cursor-pointer hover:bg-line">
            <span className="truncate flex-1 text-left">{link}</span>{copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4 text-brand" />}
          </button>
        </>
      )}
    </Modal>
  );
}
