import { Modal, Table, Pill, Loading } from "./ui/kit";
import { useLedger } from "../queries/rent";
import { money, fmtDate } from "../lib/format";
import { cn } from "../lib/utils";

export function LedgerTable({ leaseId }: { leaseId: number }) {
  const q = useLedger(leaseId);
  if (q.isLoading) return <Loading />;
  if (!q.data) return null;
  return (
    <div>
      <Table>
        <thead><tr><th>Date</th><th>Description</th><th className="!text-right">Charge</th><th className="!text-right">Payment</th><th className="!text-right">Balance</th></tr></thead>
        <tbody>
          {q.data.entries.map((e) => (
            <tr key={`${e.kind}-${e.id}`} className={cn(e.status === "rejected" && "opacity-50 line-through")}>
              <td className="whitespace-nowrap text-muted">{fmtDate(e.date)}</td>
              <td>{e.label} {e.kind === "payment" && e.status !== "confirmed" && <Pill className="ml-1">{e.status}</Pill>}</td>
              <td className="text-right">{e.kind === "charge" ? money(e.amount) : ""}</td>
              <td className="text-right text-ok">{e.kind === "payment" ? `−${money(e.amount)}` : ""}</td>
              <td className="text-right font-semibold text-ink">{money(e.balance)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="flex justify-end items-center gap-3 px-4 py-3 border-t border-line">
        <span className="text-sm text-muted">Balance due</span>
        <span className={cn("text-xl font-bold", q.data.balance > 0 ? "text-bad" : "text-ok")}>{money(q.data.balance)}</span>
      </div>
    </div>
  );
}

export function LedgerModal({ leaseId, title, onClose }: { leaseId: number | null; title: string; onClose: () => void }) {
  return (
    <Modal open={leaseId != null} onClose={onClose} title={title} wide>
      <div className="-m-6">{leaseId != null && <LedgerTable leaseId={leaseId} />}</div>
    </Modal>
  );
}
