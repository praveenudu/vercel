import { useState } from "react";
import { Link } from "wouter";
import { Megaphone, Copy, ExternalLink, Check, Users } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Modal, Field, Input, Textarea, ErrorNote } from "../../components/ui/kit";
import { useListings, usePublishListing, useUnpublishListing } from "../../queries/listings";
import { money, fromCents, toCents, errMsg, fmtDate } from "../../lib/format";

type Row = NonNullable<ReturnType<typeof useListings>["data"]>[number];

export default function ListingsPage() {
  const q = useListings();
  const unpublish = useUnpublishListing();
  const [edit, setEdit] = useState<Row | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const link = (id: number) => `${window.location.origin}/apply/${id}`;
  return (
    <div>
      <PageHeader icon={<Megaphone />} title="Listings" subtitle="Advertise vacant units and collect online applications." />
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Card><Empty icon={<Megaphone />} title="No vacant units">Every unit is occupied. Units appear here when a lease ends or you add a new one.</Empty></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 stagger">
          {q.data.map((u) => (
            <Card key={u.id} bodyClass="p-0">
              <div className="flex">
                <img src="/images/listing.jpg" alt="" className="w-40 object-cover rounded-l-lg hidden sm:block" />
                <div className="p-5 flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-ink truncate">{u.listingTitle || `${u.property.name} · ${u.name}`}</h3>
                      <p className="text-sm text-muted">{u.property.address} · {u.name} · {u.beds} bd / {u.baths} ba</p>
                    </div>
                    <Pill className="ml-auto">{u.status}</Pill>
                  </div>
                  <div className="mt-3 flex gap-5 text-sm">
                    <span><b className="text-ink">{money(u.rent, { cents: false })}</b><span className="text-muted">/mo</span></span>
                    <span className="text-muted">Available {u.availableDate ? fmtDate(u.availableDate) : "now"}</span>
                    <Link href="/screening" className="flex items-center gap-1 text-brand font-semibold"><Users className="size-4" />{u.applicationCount} applicant{u.applicationCount === 1 ? "" : "s"}</Link>
                  </div>
                  {u.status === "listed" && (
                    <div className="mt-3 flex items-center gap-2 rounded-md bg-app px-3 py-2">
                      <code className="text-xs text-body truncate flex-1">{link(u.id)}</code>
                      <button title="Copy link" className="text-brand cursor-pointer" onClick={() => { navigator.clipboard.writeText(link(u.id)); setCopied(u.id); setTimeout(() => setCopied(null), 1500); }}>{copied === u.id ? <Check className="size-4" /> : <Copy className="size-4" />}</button>
                      <a href={`/apply/${u.id}`} target="_blank" rel="noreferrer" className="text-brand"><ExternalLink className="size-4" /></a>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={() => setEdit(u)}>{u.status === "listed" ? "Edit listing" : "Publish listing"}</Button>
                    {u.status === "listed" && <Button size="sm" variant="ghost" onClick={() => unpublish.mutate({ unitId: u.id })}>Unpublish</Button>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {edit && <PublishModal unit={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function PublishModal({ unit, onClose }: { unit: Row; onClose: () => void }) {
  const publish = usePublishListing();
  const [f, setF] = useState({
    listingTitle: unit.listingTitle || `${unit.beds}BR ${unit.property.type === "single_family" ? "home" : "apartment"} at ${unit.property.name}`,
    listingDescription: unit.listingDescription || "Bright, updated unit close to transit and parks. In-unit laundry, off-street parking. Tenant pays electric; landlord covers water and trash.",
    rent: fromCents(unit.rent),
    deposit: fromCents(unit.deposit),
    availableDate: unit.availableDate || new Date().toISOString().slice(0, 10),
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={`Listing · ${unit.property.name} ${unit.name}`} wide footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={publish.isPending} onClick={async () => { try { await publish.mutateAsync({ unitId: unit.id, listingTitle: f.listingTitle, listingDescription: f.listingDescription, rent: toCents(f.rent), deposit: toCents(f.deposit), availableDate: f.availableDate }); onClose(); } catch (e) { setErr(errMsg(e)); } }}>Publish</Button></>}>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Headline" className="sm:col-span-3"><Input value={f.listingTitle} onChange={set("listingTitle")} /></Field>
        <Field label="Description" className="sm:col-span-3"><Textarea rows={5} value={f.listingDescription} onChange={set("listingDescription")} /></Field>
        <Field label="Rent ($/mo)"><Input type="number" value={f.rent} onChange={set("rent")} /></Field>
        <Field label="Deposit ($)"><Input type="number" value={f.deposit} onChange={set("deposit")} /></Field>
        <Field label="Available"><Input type="date" value={f.availableDate} onChange={set("availableDate")} /></Field>
      </div>
      {err && <div className="mt-4"><ErrorNote error={err} /></div>}
    </Modal>
  );
}
