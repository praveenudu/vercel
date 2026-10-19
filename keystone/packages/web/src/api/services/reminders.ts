import { and, eq } from "drizzle-orm";
import { db } from "../database";
import * as s from "../database/schema";
import { leaseBalances, syncCharges, today } from "../lib/util";
import { hasFeature } from "../../shared/plans";
import { appBase, landlordContact, sendMail, type MailStatus } from "./email";
import { leasePlace, longDate, tenantLink, usd } from "./notifications";

const addDays = (d: string, n: number) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

function nextDue(l: typeof s.leases.$inferSelect, t: string) {
  const day = String(Math.min(l.dueDay, 28)).padStart(2, "0");
  let due = `${t.slice(0, 7)}-${day}`;
  if (due < t) {
    const d = new Date(t.slice(0, 7) + "-01T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
    due = `${d.toISOString().slice(0, 7)}-${day}`;
  }
  return due;
}

/** Oldest charge not covered by confirmed payments (oldest-first allocation). */
async function oldestUnpaid(leaseId: number) {
  const charges = (await db.select().from(s.rentCharges).where(eq(s.rentCharges.leaseId, leaseId))).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  let paid = (await db.select().from(s.payments).where(and(eq(s.payments.leaseId, leaseId), eq(s.payments.status, "confirmed")))).reduce((t, p) => t + p.amount, 0);
  for (const c of charges) {
    if (paid >= c.amount) {
      paid -= c.amount;
      continue;
    }
    return c;
  }
  return null;
}

export interface ReminderResult {
  reminders: number;
  overdue: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Rent reminders (N days before the due date) and overdue notices (after the grace period).
 * Idempotent: every mail carries a dedupe key, so running hourly sends each notice once.
 * `manual` = landlord pressed "Send reminders now": also nudges anyone carrying a balance, once per day.
 */
export async function runReminders(opts: { landlordId?: string; manual?: boolean; base?: string } = {}): Promise<ReminderResult> {
  const out: ReminderResult = { reminders: 0, overdue: 0, skipped: 0, failed: 0, errors: [] };
  const base = opts.base ?? appBase();
  const t = today();
  const owners = opts.landlordId
    ? await db.select().from(s.profiles).where(eq(s.profiles.userId, opts.landlordId))
    : (await db.select().from(s.profiles).where(eq(s.profiles.role, "landlord"))).filter((p) => p.userId === p.landlordId && p.remindersEnabled);

  const tally = (kind: "reminders" | "overdue", st: MailStatus, err?: string) => {
    if (st === "sent") out[kind]++;
    else if (st === "skipped") out.skipped++;
    else if (st === "failed") {
      out.failed++;
      if (err && !out.errors.includes(err)) out.errors.push(err);
    }
  };

  for (const o of owners) {
    const leases = await db.select().from(s.leases).where(and(eq(s.leases.landlordId, o.userId), eq(s.leases.status, "active")));
    if (!leases.length) continue;
    const lateFees = hasFeature(o.plan, "late_fees");
    for (const l of leases) await syncCharges(l.id, lateFees);
    const bal = await leaseBalances(leases.map((l) => l.id));
    const alertLandlord = await landlordContact(o.userId);

    for (const l of leases) {
      const b = bal.get(l.id)!;
      const owed = b.balance - b.pending;
      const { label } = await leasePlace(l);
      const ledger = tenantLink(base, l, "/tenant/payments");

      // Overdue: oldest unpaid rent is past its grace period.
      const unpaid = owed > 0 ? await oldestUnpaid(l.id) : null;
      if (unpaid && unpaid.type !== "deposit" && t > addDays(unpaid.dueDate, l.graceDays)) {
        const r = await sendMail({
          landlordId: l.landlordId,
          to: l.tenantEmail,
          subject: `Rent is past due — ${usd(owed)} outstanding`,
          kind: "rent_overdue",
          heading: "Your rent is past due",
          paragraphs: [
            `Hi ${l.tenantName.split(" ")[0]}, we haven't received full payment for ${label}. Your rent was due ${longDate(unpaid.dueDate)} and the ${l.graceDays}-day grace period has ended.`,
            l.lateFee > 0 && lateFees ? `A late fee of ${usd(l.lateFee)} applies per your lease.` : "Please pay as soon as possible, or contact your landlord if something's wrong.",
          ],
          details: [
            ["Amount outstanding", usd(owed)],
            ["Originally due", longDate(unpaid.dueDate)],
          ],
          cta: { label: "View balance & pay", url: ledger },
          dedupeKey: `overdue:${l.id}:${unpaid.period}`,
          entityType: "lease",
          entityId: l.id,
        });
        tally("overdue", r.status, r.error);
        if (r.status !== "duplicate" && alertLandlord) {
          await sendMail({
            landlordId: l.landlordId,
            to: alertLandlord.email,
            subject: `Overdue rent — ${l.tenantName}, ${usd(owed)}`,
            kind: "rent_overdue",
            heading: "Rent is overdue",
            paragraphs: [`${l.tenantName} (${label}) owes ${usd(owed)}. Rent was due ${longDate(unpaid.dueDate)}; the grace period has ended. We've sent them a past-due notice.`],
            cta: { label: "Open Rent Collection", url: `${base}/rent` },
            note: "You're receiving this landlord alert from Keystone. Turn alerts off in Plans & Billing → Notifications.",
            dedupeKey: `overdue-ll:${l.id}:${unpaid.period}`,
          });
        }
        continue;
      }

      // Upcoming: next due date within the reminder window.
      const due = nextDue(l, t);
      const until = daysBetween(t, due);
      if (due > l.endDate) continue;
      const inWindow = until >= 0 && until <= o.reminderDays;
      if (!inWindow && !(opts.manual && owed > 0)) continue;
      // The current month's charge is posted on the 1st; next month's isn't yet.
      const total = Math.max(0, owed) + (inWindow && due.slice(0, 7) > t.slice(0, 7) ? l.rent : 0);
      if (total <= 0) continue;
      const previous = inWindow ? Math.max(0, total - l.rent) : total;
      const r = await sendMail({
        landlordId: l.landlordId,
        to: l.tenantEmail,
        subject: inWindow ? `Rent reminder — ${usd(total)} due ${longDate(due)}` : `Balance reminder — ${usd(total)} due`,
        kind: "rent_reminder",
        heading: inWindow ? (until === 0 ? "Rent is due today" : `Rent is due in ${until} day${until === 1 ? "" : "s"}`) : "You have a balance due",
        paragraphs: [`Hi ${l.tenantName.split(" ")[0]}, this is a friendly reminder about rent for ${label}.`],
        details: [
          ...(inWindow ? ([["Due date", longDate(due)], ["Monthly rent", usd(l.rent)]] as [string, string][]) : []),
          ...(inWindow && previous > 0 ? ([["Previous balance", usd(previous)]] as [string, string][]) : []),
          ["Total due", usd(total)],
        ],
        cta: { label: "View your ledger", url: ledger },
        note: "Already paid? Thanks — report it in your tenant portal so your landlord can confirm it. Sent by Keystone on behalf of your landlord.",
        dedupeKey: inWindow ? `reminder:${l.id}:${due.slice(0, 7)}` : `balance:${l.id}:${t}`,
        entityType: "lease",
        entityId: l.id,
      });
      tally("reminders", r.status, r.error);
    }
  }
  return out;
}

const KEY = "__keystoneReminderTimer";
type G = typeof globalThis & { [KEY]?: ReturnType<typeof setInterval> };

/** Hourly in-process scheduler. Only sends during 14:00–22:00 UTC (morning to afternoon across US time zones). */
export function startReminderScheduler() {
  const g = globalThis as G;
  if (g[KEY]) clearInterval(g[KEY]);
  if (!process.env.RESEND_API_KEY) return;
  const tick = () => {
    const h = new Date().getUTCHours();
    if (h < 14 || h > 22) return;
    runReminders()
      .then((r) => {
        if (r.reminders || r.overdue || r.failed) console.log(`[reminders] sent ${r.reminders} reminders, ${r.overdue} overdue, ${r.failed} failed`);
      })
      .catch((e) => console.warn("[reminders] run failed", e));
  };
  g[KEY] = setInterval(tick, 60 * 60 * 1000);
  setTimeout(tick, 60 * 1000);
}
