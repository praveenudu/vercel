import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Building2, Plus, Trash2, MapPin, Pencil, ChevronLeft } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Pill, Modal, Field, Input, Select, Table, ErrorNote, Stat } from "../../components/ui/kit";
import { PortfolioSelect } from "../../components/portfolio-select";
import { useMeData, usePortfolio } from "../../components/session";
import { useProperties, useProperty, useCreateProperty, useUpdateProperty, useRemoveProperty, useCreateUnit, useUpdateUnit, useRemoveUnit } from "../../queries/properties";
import { useCreatePortfolio } from "../../queries/me";
import { money, moneyShort, toCents, fromCents, errMsg, fmtDate } from "../../lib/format";
import { PLANS, type PlanId } from "../../../shared/plans";

const TYPES = [["single_family", "Single family"], ["multi_family", "Multi-family"], ["condo", "Condo"], ["townhouse", "Townhouse"], ["commercial", "Commercial"]];

type UnitDraft = { name: string; beds: string; baths: string; sqft: string; rent: string; deposit: string };
const blankUnit = (): UnitDraft => ({ name: "", beds: "2", baths: "1", sqft: "", rent: "", deposit: "" });

export function PropertiesPage() {
  const { portfolioId } = usePortfolio();
  const q = useProperties(portfolioId);
  const [open, setOpen] = useState(false);
  const [pfOpen, setPfOpen] = useState(false);
  return (
    <div>
      <PageHeader icon={<Building2 />} title="Properties" actions={<><Button variant="outline" onClick={() => setPfOpen(true)}>New portfolio</Button><Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Add Property</Button></>}>
        <PortfolioSelect />
      </PageHeader>
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Card><Empty icon={<Building2 />} title="No properties yet" action={<Button onClick={() => setOpen(true)}>Add your first property</Button>}>Add a rental and its units to start tracking rent, leases and expenses.</Empty></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 stagger">
          {q.data.map((p, i) => {
            const occ = p.units.filter((u) => u.status === "occupied").length;
            const rent = p.units.reduce((t, u) => t + u.rent, 0);
            return (
              <Link key={p.id} href={`/properties/${p.id}`} className="group rounded-lg bg-white border border-line overflow-hidden hover:shadow-lg transition-shadow">
                <div className="h-36 relative overflow-hidden">
                  <img src={["/images/hero-house.jpg", "/images/listing.jpg", "/images/street.jpg"][i % 3]} alt="" className="size-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  <span className="absolute left-3 top-3"><Pill tone="navy">{TYPES.find((t) => t[0] === p.type)?.[1] ?? p.type}</Pill></span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg text-ink">{p.name}</h3>
                  <p className="text-sm text-muted flex items-center gap-1 mt-0.5"><MapPin className="size-3.5" />{p.address}, {p.city}, {p.state}</p>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div><p className="text-lg font-bold text-ink">{p.units.length}</p><p className="text-[11px] uppercase tracking-wide text-muted font-semibold">Units</p></div>
                    <div><p className="text-lg font-bold text-ink">{occ}/{p.units.length}</p><p className="text-[11px] uppercase tracking-wide text-muted font-semibold">Occupied</p></div>
                    <div><p className="text-lg font-bold text-ink">{moneyShort(rent)}</p><p className="text-[11px] uppercase tracking-wide text-muted font-semibold">Rent/mo</p></div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <PropertyModal open={open} onClose={() => setOpen(false)} />
      <PortfolioModal open={pfOpen} onClose={() => setPfOpen(false)} />
    </div>
  );
}

function PortfolioModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMeData();
  const create = useCreatePortfolio();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const plan = PLANS[me.plan as PlanId];
  return (
    <Modal open={open} onClose={onClose} title="New portfolio" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={create.isPending} disabled={!name} onClick={async () => { setErr(null); try { await create.mutateAsync({ name }); setName(""); onClose(); } catch (e) { setErr(errMsg(e)); } }}>Create</Button></>}>
      <p className="text-sm text-body mb-4">Group properties by LLC or partnership. Your {plan.name} plan includes {Number.isFinite(plan.maxPortfolios) ? `${plan.maxPortfolios} portfolio` : "unlimited portfolios"}; you have {me.portfolios.length}.</p>
      <Field label="Portfolio name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rivera Holdings LLC" /></Field>
      {err && <div className="mt-3"><ErrorNote error={err} />{err.includes("Upgrade") && <Link href="/billing" className="mt-2 inline-block text-sm font-semibold text-brand">See plans →</Link>}</div>}
    </Modal>
  );
}

type PropForm = { name: string; address: string; city: string; state: string; zip: string; type: string; portfolioId: string; purchasePrice: string; currentValue: string };

function PropertyModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: PropForm & { id: number } }) {
  const me = useMeData();
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const [, nav] = useLocation();
  const [f, setF] = useState<PropForm>(initial ?? { name: "", address: "", city: "", state: "", zip: "", type: "single_family", portfolioId: String(me.portfolios[0]?.id ?? ""), purchasePrice: "", currentValue: "" });
  const [unitsDraft, setUnits] = useState<UnitDraft[]>([{ ...blankUnit(), name: "Main" }]);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof PropForm) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setErr(null);
    const base = { name: f.name, address: f.address, city: f.city, state: f.state, zip: f.zip, type: f.type, portfolioId: f.portfolioId ? Number(f.portfolioId) : null, purchasePrice: toCents(f.purchasePrice), currentValue: toCents(f.currentValue) };
    try {
      if (initial) {
        await update.mutateAsync({ ...base, id: initial.id });
        onClose();
      } else {
        const p = await create.mutateAsync({ ...base, units: unitsDraft.filter((u) => u.name).map((u) => ({ name: u.name, beds: Number(u.beds || 0), baths: Number(u.baths || 0), sqft: Number(u.sqft || 0), rent: toCents(u.rent), deposit: toCents(u.deposit) })) });
        onClose();
        nav(`/properties/${p.id}`);
      }
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  return (
    <Modal open={open} onClose={onClose} wide title={initial ? "Edit property" : "Add property"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!f.name} loading={create.isPending || update.isPending}>{initial ? "Save" : "Add property"}</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Property name" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} placeholder="e.g. 14 Maple St" /></Field>
        <Field label="Street address" className="sm:col-span-2"><Input value={f.address} onChange={set("address")} /></Field>
        <Field label="City"><Input value={f.city} onChange={set("city")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State"><Input value={f.state} onChange={set("state")} maxLength={2} placeholder="TX" /></Field>
          <Field label="ZIP"><Input value={f.zip} onChange={set("zip")} /></Field>
        </div>
        <Field label="Type"><Select value={f.type} onChange={set("type")}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Portfolio"><Select value={f.portfolioId} onChange={set("portfolioId")}>{me.portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Purchase price ($)"><Input type="number" value={f.purchasePrice} onChange={set("purchasePrice")} /></Field>
        <Field label="Current value ($)"><Input type="number" value={f.currentValue} onChange={set("currentValue")} /></Field>
      </div>
      {!initial && (
        <div className="mt-6">
          <p className="text-[13px] font-semibold text-ink mb-2">Units</p>
          <div className="space-y-2">
            <div className="grid grid-cols-[1.4fr_.6fr_.6fr_.8fr_1fr_1fr_32px] gap-2 text-[11px] font-semibold uppercase text-muted">
              <span>Name</span><span>Beds</span><span>Baths</span><span>Sqft</span><span>Rent $</span><span>Deposit $</span><span />
            </div>
            {unitsDraft.map((u, i) => (
              <div key={i} className="grid grid-cols-[1.4fr_.6fr_.6fr_.8fr_1fr_1fr_32px] gap-2">
                {(["name", "beds", "baths", "sqft", "rent", "deposit"] as const).map((k) => (
                  <Input key={k} type={k === "name" ? "text" : "number"} value={u[k]} onChange={(e) => setUnits(unitsDraft.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                ))}
                <button onClick={() => setUnits(unitsDraft.filter((_, j) => j !== i))} className="text-muted hover:text-bad cursor-pointer"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => setUnits([...unitsDraft, { ...blankUnit(), name: `Unit ${unitsDraft.length + 1}` }])} className="mt-2 text-sm font-semibold text-brand cursor-pointer">+ Add unit</button>
        </div>
      )}
      {err && <div className="mt-4"><ErrorNote error={err} /></div>}
    </Modal>
  );
}

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useProperty(Number(id));
  const remove = useRemoveProperty();
  const removeUnit = useRemoveUnit();
  const [, nav] = useLocation();
  const [edit, setEdit] = useState(false);
  const [unitModal, setUnitModal] = useState<null | { id?: number; draft: UnitDraft }>(null);
  if (q.isLoading || !q.data) return <Loading />;
  const p = q.data;
  const rent = p.units.reduce((t, u) => t + (u.lease?.rent ?? 0), 0);
  return (
    <div>
      <Link href="/properties" className="inline-flex items-center gap-1 text-sm font-semibold text-brand mb-3"><ChevronLeft className="size-4" />All properties</Link>
      <PageHeader icon={<Building2 />} title={p.name} subtitle={`${p.address}, ${p.city}, ${p.state} ${p.zip}`} actions={<>
        <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>Edit</Button>
        <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={async () => { if (confirm(`Delete ${p.name} and its units?`)) { await remove.mutateAsync({ id: p.id }); nav("/properties"); } }}>Delete</Button>
      </>} />
      <div className="grid gap-5 sm:grid-cols-4 mb-5 stagger">
        <Card><Stat label="Units" value={p.units.length} /></Card>
        <Card><Stat label="Occupied" value={`${p.units.filter((u) => u.status === "occupied").length}/${p.units.length}`} /></Card>
        <Card><Stat label="Lease rent / mo" value={money(rent, { cents: false })} /></Card>
        <Card><Stat label="Current value" value={moneyShort(p.currentValue)} sub={p.purchasePrice ? `Bought for ${moneyShort(p.purchasePrice)}` : undefined} /></Card>
      </div>
      <Card title="Units" bodyClass="p-0" action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setUnitModal({ draft: { ...blankUnit(), name: `Unit ${p.units.length + 1}` } })}>Add unit</Button>}>
        <Table>
          <thead><tr><th>Unit</th><th>Beds / Baths</th><th>Status</th><th>Tenant</th><th>Lease ends</th><th className="!text-right">Rent</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {p.units.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold text-ink">{u.name}</td>
                <td>{u.beds} bd · {u.baths} ba{u.sqft ? ` · ${u.sqft} sqft` : ""}</td>
                <td><Pill>{u.status}</Pill></td>
                <td>{u.lease ? <Link href={`/leases/${u.lease.id}`} className="text-brand font-semibold">{u.lease.tenantName}</Link> : <Link href="/listings" className="text-muted hover:text-brand">List this unit →</Link>}</td>
                <td>{u.lease ? fmtDate(u.lease.endDate) : "—"}</td>
                <td className="text-right font-semibold">{money(u.lease?.rent ?? u.rent)}</td>
                <td className="text-right whitespace-nowrap">
                  <button className="text-muted hover:text-brand cursor-pointer mr-3" onClick={() => setUnitModal({ id: u.id, draft: { name: u.name, beds: String(u.beds), baths: String(u.baths), sqft: String(u.sqft), rent: fromCents(u.rent), deposit: fromCents(u.deposit) } })}><Pencil className="size-4" /></button>
                  {u.status !== "occupied" && <button className="text-muted hover:text-bad cursor-pointer" onClick={() => confirm(`Remove ${u.name}?`) && removeUnit.mutate({ id: u.id })}><Trash2 className="size-4" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {edit && <PropertyModal open onClose={() => setEdit(false)} initial={{ id: p.id, name: p.name, address: p.address, city: p.city, state: p.state, zip: p.zip, type: p.type, portfolioId: String(p.portfolioId ?? ""), purchasePrice: fromCents(p.purchasePrice), currentValue: fromCents(p.currentValue) }} />}
      {unitModal && <UnitModal propertyId={p.id} state={unitModal} onClose={() => setUnitModal(null)} />}
    </div>
  );
}

function UnitModal({ propertyId, state, onClose }: { propertyId: number; state: { id?: number; draft: UnitDraft }; onClose: () => void }) {
  const [u, setU] = useState(state.draft);
  const create = useCreateUnit();
  const update = useUpdateUnit();
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const body = { name: u.name, beds: Number(u.beds || 0), baths: Number(u.baths || 0), sqft: Number(u.sqft || 0), rent: toCents(u.rent), deposit: toCents(u.deposit) };
    try {
      if (state.id) await update.mutateAsync({ ...body, id: state.id });
      else await create.mutateAsync({ ...body, propertyId });
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  const set = (k: keyof UnitDraft) => (e: { target: { value: string } }) => setU((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={state.id ? "Edit unit" : "Add unit"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!u.name} loading={create.isPending || update.isPending}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Unit name" className="col-span-2"><Input value={u.name} onChange={set("name")} /></Field>
        <Field label="Beds"><Input type="number" value={u.beds} onChange={set("beds")} /></Field>
        <Field label="Baths"><Input type="number" value={u.baths} onChange={set("baths")} /></Field>
        <Field label="Sqft"><Input type="number" value={u.sqft} onChange={set("sqft")} /></Field>
        <Field label="Market rent ($/mo)"><Input type="number" value={u.rent} onChange={set("rent")} /></Field>
        <Field label="Deposit ($)"><Input type="number" value={u.deposit} onChange={set("deposit")} /></Field>
      </div>
      {err && <div className="mt-4"><ErrorNote error={err} /></div>}
    </Modal>
  );
}
