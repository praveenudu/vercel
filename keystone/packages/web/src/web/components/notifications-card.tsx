import { useState } from "react";
import { Bell, Mail, Send, AlertTriangle } from "lucide-react";
import { Card, Button, Field, Select, ErrorNote, Pill, Table } from "./ui/kit";
import { useMeData } from "./session";
import { useUpdateSettings } from "../queries/me";
import { useEmailLog, useEmailStatus, useSendTestEmail } from "../queries/email";
import { errMsg, fmtDateTime } from "../lib/format";

const kindLabel: Record<string, string> = {
  invite: "Invite",
  lease_sent: "Lease sent",
  lease_signed: "Tenant signed",
  lease_executed: "Lease executed",
  rent_reminder: "Rent reminder",
  rent_overdue: "Overdue notice",
  receipt: "Receipt",
  payment_reported: "Payment reported",
  new_application: "New application",
  application_received: "Application received",
  new_invoice: "New invoice",
  new_request: "Maintenance request",
  work_order: "Work order",
  test: "Test",
};

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${checked ? "bg-brand" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-muted mt-0.5">{hint}</span>
      </span>
    </div>
  );
}

export function NotificationsCard() {
  const me = useMeData();
  const save = useUpdateSettings();
  const status = useEmailStatus();
  const logQ = useEmailLog();
  const test = useSendTestEmail();
  const [f, setF] = useState({ reminders: me.profile.remindersEnabled, days: me.profile.reminderDays, alerts: me.profile.notifyEmails });
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const rows = logQ.data ?? [];

  return (
    <Card title={<span className="flex items-center gap-2"><Bell className="size-5 text-brand" />Notifications & email</span>} className="mt-6">
      {status.data && !status.data.configured && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-warn-tint px-3 py-2 text-sm text-warn"><AlertTriangle className="size-4 mt-0.5 shrink-0" />Email isn't configured on this server, so nothing will be delivered. Emails are still logged below.</p>
      )}
      {status.data?.testSender && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-warn-tint px-3 py-2 text-sm text-warn">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>Sending from Resend's test address ({status.data.from}). Resend only delivers these to the email on your Resend account. Verify your domain in Resend and set a from address on it to reach tenants and vendors.</span>
        </p>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <Toggle checked={f.reminders} onChange={(v) => setF((x) => ({ ...x, reminders: v }))} label="Automatic rent reminders" hint="Email tenants before rent is due, and a past-due notice once the grace period ends." />
          <Field label="Send the reminder" className={f.reminders ? "" : "opacity-50"}>
            <Select value={f.days} disabled={!f.reminders} onChange={(e) => setF((x) => ({ ...x, days: Number(e.target.value) }))}>
              {[1, 2, 3, 5, 7, 10].map((d) => <option key={d} value={d}>{d} day{d === 1 ? "" : "s"} before the due date</option>)}
            </Select>
          </Field>
          <Toggle checked={f.alerts} onChange={(v) => setF((x) => ({ ...x, alerts: v }))} label="Landlord alerts" hint="Email me about new applications, signed leases, reported payments, vendor invoices and maintenance requests." />
        </div>
        <div className="rounded-lg bg-app p-4 text-sm text-body space-y-2">
          <p className="font-semibold text-ink flex items-center gap-2"><Mail className="size-4 text-brand" />Tenants, vendors and CPAs always get</p>
          <ul className="list-disc pl-5 space-y-1 text-[13px]">
            <li>Invite links when you add them</li>
            <li>Lease ready to sign, and the executed copy</li>
            <li>Payment receipts when you record or confirm a payment</li>
            <li>Work orders when you assign a vendor</li>
          </ul>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Send className="size-3.5" />}
              loading={test.isPending}
              onClick={async () => {
                setTestMsg(null);
                try {
                  const r = await test.mutateAsync(undefined);
                  setTestMsg(r.status === "sent" ? { ok: true, text: `Sent to ${me.user.email}` } : { ok: false, text: r.error ?? `Not sent (${r.status})` });
                } catch (e) {
                  setTestMsg({ ok: false, text: errMsg(e) });
                }
              }}
            >
              Send me a test email
            </Button>
            {testMsg && <p className={`mt-2 text-xs font-semibold ${testMsg.ok ? "text-ok" : "text-warn"}`}>{testMsg.text}</p>}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 mt-5">
        {ok && <span className="text-sm text-ok font-semibold">Saved</span>}
        <ErrorNote error={err} />
        <Button
          loading={save.isPending}
          onClick={async () => {
            setErr(null);
            try {
              await save.mutateAsync({ remindersEnabled: f.reminders, reminderDays: f.days, notifyEmails: f.alerts });
              setOk(true);
              setTimeout(() => setOk(false), 2000);
            } catch (e) {
              setErr(errMsg(e));
            }
          }}
        >
          Save notifications
        </Button>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-bold text-ink mb-3">Recent emails</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No emails yet. They'll appear here as invites, reminders and receipts go out.</p>
        ) : (
          <Table>
            <thead>
              <tr><th>When</th><th>To</th><th>Type</th><th>Subject</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 15).map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(r.createdAt)}</td>
                  <td className="max-w-[180px] truncate" title={r.to}>{r.to}</td>
                  <td className="whitespace-nowrap">{kindLabel[r.kind] ?? r.kind}</td>
                  <td className="max-w-[260px] truncate" title={r.subject}>{r.subject}</td>
                  <td title={r.error ?? ""} aria-label={r.status}><Pill tone={r.status === "sent" ? "green" : r.status === "failed" ? "red" : "gray"}>{r.status === "sent" ? "Sent" : r.status === "failed" ? "Failed" : "Skipped"}</Pill></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {rows.some((r) => r.status !== "sent") && <p className="text-xs text-muted mt-2">Hover a status to see why. Demo and placeholder addresses are never emailed.</p>}
      </div>
    </Card>
  );
}
