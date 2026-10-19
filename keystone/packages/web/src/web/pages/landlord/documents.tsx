import { useState } from "react";
import { FolderOpen, Upload, FileText, Trash2, ExternalLink, FileSignature, Receipt, Landmark, ShieldCheck, Calculator } from "lucide-react";
import { PageHeader, Card, Button, Loading, Empty, Table, Modal, Field, Input, Select, ErrorNote } from "../../components/ui/kit";
import { useDocuments, useCreateDocument, useShareDocument, useRemoveDocument } from "../../queries/documents";
import { uploadFile, openDocument } from "../../lib/upload";
import { fmtDate, errMsg } from "../../lib/format";
import { cn } from "../../lib/utils";

const DOC_CATEGORIES: [string, string][] = [["tax_1098", "Form 1098 (mortgage interest)"], ["property_tax", "Property tax bill"], ["insurance", "Insurance policy"], ["receipt", "Receipt / invoice"], ["w9", "W-9"], ["closing", "Closing statement"], ["lease", "Lease"], ["tax_return", "Tax return / CPA workpaper"], ["other", "Other"]];
const docLabel = (c: string) => DOC_CATEGORIES.find((d) => d[0] === c)?.[1] ?? c;
const docIcon = (c: string) => (c === "lease" ? FileSignature : c === "receipt" ? Receipt : c === "property_tax" || c === "tax_1098" ? Landmark : c === "insurance" ? ShieldCheck : c === "tax_return" ? Calculator : FileText);

const YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

export default function DocumentsPage() {
  return (
    <div>
      <PageHeader icon={<FolderOpen />} title="Documents" subtitle="Leases, receipts and tax forms — share the ones your CPA needs with one click." />
      <DocumentsView viewer="landlord" />
    </div>
  );
}

export function DocumentsView({ viewer: role }: { viewer: "landlord" | "cpa" }) {
  const [year, setYear] = useState<number | 0>(0);
  const [cat, setCat] = useState("");
  const q = useDocuments(year || undefined);
  const share = useShareDocument();
  const remove = useRemoveDocument();
  const [open, setOpen] = useState(false);
  const rows = (q.data ?? []).filter((d) => !cat || d.category === cat);
  const shared = (q.data ?? []).filter((d) => d.sharedWithCpa).length;
  return (
    <>
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-line">
          <Select className="w-36" value={year} onChange={(e) => setYear(Number(e.target.value))}><option value={0}>All years</option>{YEARS.map((y) => <option key={y} value={y}>Tax year {y}</option>)}</Select>
          <Select className="w-60" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{DOC_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          {role === "landlord" && <span className="text-xs text-muted">{shared} shared with CPA</span>}
          <Button className="ml-auto" icon={<Upload className="size-4" />} onClick={() => setOpen(true)}>Upload</Button>
        </div>
        {q.isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty icon={<FolderOpen />} title="No documents">{role === "cpa" ? "The owner hasn’t shared any documents for this period yet." : "Upload 1098s, property tax bills and receipts. E-signed leases are filed here automatically."}</Empty>
        ) : (
          <Table>
            <thead><tr><th>Name</th><th>Category</th><th>Property</th><th>Tax year</th><th>Uploaded</th>{role === "landlord" && <th>CPA access</th>}<th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((d) => {
                const Icon = docIcon(d.category);
                return (
                  <tr key={d.id}>
                    <td aria-label={d.name}>
                      <button onClick={() => openDocument(d.id)} className="flex items-center gap-2 text-left cursor-pointer group">
                        <span className="size-8 rounded-md bg-tint text-brand grid place-items-center shrink-0"><Icon className="size-4" /></span>
                        <span className="font-semibold text-ink group-hover:text-brand">{d.name}</span>
                      </button>
                    </td>
                    <td>{docLabel(d.category)}</td>
                    <td>{d.propertyName}</td>
                    <td>{d.taxYear ?? "—"}</td>
                    <td className="text-xs text-muted">{fmtDate(d.createdAt)}<br />{d.uploadedBy}</td>
                    {role === "landlord" && (
                      <td aria-label="CPA access">
                        <button aria-label={d.sharedWithCpa ? "Stop sharing with CPA" : "Share with CPA"} onClick={() => share.mutate({ id: d.id, sharedWithCpa: !d.sharedWithCpa })} className={cn("relative inline-flex h-6 w-11 rounded-full transition-colors cursor-pointer", d.sharedWithCpa ? "bg-brand" : "bg-line")} title={d.sharedWithCpa ? "Shared with CPA" : "Private"}>
                          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", d.sharedWithCpa ? "left-[22px]" : "left-0.5")} />
                        </button>
                      </td>
                    )}
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => openDocument(d.id)} className="text-muted hover:text-brand cursor-pointer mr-3" title="Open"><ExternalLink className="size-4" /></button>
                      {role === "landlord" && <button onClick={() => confirm(`Delete ${d.name}?`) && remove.mutate({ id: d.id })} className="text-muted hover:text-bad cursor-pointer" title="Delete"><Trash2 className="size-4" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {open && <UploadModal role={role} onClose={() => setOpen(false)} />}
    </>
  );
}

function UploadModal({ role, onClose }: { role: "landlord" | "cpa"; onClose: () => void }) {
  const create = useCreateDocument();
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState({ name: "", category: role === "cpa" ? "tax_return" : "receipt", taxYear: String(new Date().getFullYear() - 1), shared: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!file) return setErr("Choose a file");
    setBusy(true);
    setErr(null);
    try {
      const up = await uploadFile(file);
      await create.mutateAsync({ name: f.name || file.name, category: f.category, taxYear: f.taxYear ? Number(f.taxYear) : null, fileKey: up.key, contentType: up.contentType, size: up.size, sharedWithCpa: f.shared });
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Upload document" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Upload</Button></>}>
      <div className="space-y-4">
        <label className="flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed border-line hover:border-brand cursor-pointer text-sm text-muted">
          <Upload className="size-6 text-brand" />
          {file ? <span className="font-semibold text-ink">{file.name}</span> : "Click to choose a PDF or image"}
          <input type="file" aria-label="Choose file" className="hidden" onChange={(e) => { const fl = e.target.files?.[0] ?? null; setFile(fl); if (fl && !f.name) setF((x) => ({ ...x, name: fl.name })); }} />
        </label>
        <Field label="Name"><Input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category"><Select value={f.category} onChange={(e) => setF((x) => ({ ...x, category: e.target.value }))}>{DOC_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Tax year"><Select value={f.taxYear} onChange={(e) => setF((x) => ({ ...x, taxYear: e.target.value }))}><option value="">None</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</Select></Field>
        </div>
        {role === "landlord" && <label className="flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer"><input type="checkbox" aria-label="Share with my CPA" className="size-4 accent-brand" checked={f.shared} onChange={(e) => setF((x) => ({ ...x, shared: e.target.checked }))} />Share with my CPA</label>}
        <ErrorNote error={err} />
      </div>
    </Modal>
  );
}

