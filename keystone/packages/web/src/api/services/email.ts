import { Resend } from "resend";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../database";
import * as s from "../database/schema";
import { log } from "../lib/util";

let client: Resend | null = null;
const resend = () => (client ??= new Resend(process.env.RESEND_API_KEY));

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

function fromAddress() {
  const raw = (process.env.EMAIL_FROM || "onboarding@resend.dev").trim();
  return raw.includes("<") ? raw : `Keystone <${raw}>`;
}

/** Seeded demo and placeholder addresses are never mailed — they're logged as skipped instead. */
export function undeliverable(to: string) {
  const domain = to.split("@")[1]?.toLowerCase() ?? "";
  return !domain || domain === "demo.keystone.app" || /(^|\.)example\.(com|org|net)$/.test(domain) || /\.(test|invalid|local|localhost)$/.test(domain);
}

/** Absolute base URL for links: the domain the request came from, else WEBSITE_URL. */
export function appBase(headers?: Headers | null) {
  const origin = headers?.get("origin");
  const base = origin && /^https?:\/\/[^/]+$/.test(origin) ? origin : process.env.WEBSITE_URL || "";
  return base.replace(/\/$/, "");
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface Mail {
  landlordId: string;
  to: string;
  subject: string;
  kind: string;
  heading: string;
  paragraphs: string[];
  details?: [string, string][];
  cta?: { label: string; url: string };
  note?: string;
  entityType?: string;
  entityId?: number | null;
  /** Once a mail with this key is sent (or skipped), it is never sent again. */
  dedupeKey?: string;
  replyTo?: string;
}

export function renderHtml(m: Mail) {
  const details = m.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e1e6ed;border-radius:10px;border-collapse:separate">${m.details
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:11px 16px;font-size:13px;color:#6b7789;${i ? "border-top:1px solid #e1e6ed;" : ""}">${esc(k)}</td><td align="right" style="padding:11px 16px;font-size:14px;color:#1a2433;font-weight:600;${i ? "border-top:1px solid #e1e6ed;" : ""}">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const cta = m.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td style="background:#2f6eb5;border-radius:8px"><a href="${esc(m.cta.url)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${esc(m.cta.label)}</a></td></tr></table>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 16px;font-size:15px;font-weight:800;letter-spacing:4px;color:#1a2433">KEYSTONE</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e1e6ed;border-radius:14px;padding:32px 32px 28px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#1a2433">${esc(m.heading)}</h1>
${m.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4a5c">${esc(p)}</p>`).join("")}
${details}${cta}
${m.cta ? `<p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#6b7789">Button not working? Paste this link into your browser:<br><a href="${esc(m.cta.url)}" style="color:#2f6eb5;word-break:break-all">${esc(m.cta.url)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.5;color:#6b7789">${esc(m.note ?? "Sent by Keystone property management on behalf of your landlord.")}</td></tr>
</table></td></tr></table></body></html>`;
}

function renderText(m: Mail) {
  return [
    m.heading,
    "",
    ...m.paragraphs.flatMap((p) => [p, ""]),
    ...(m.details?.map(([k, v]) => `${k}: ${v}`) ?? []),
    ...(m.details?.length ? [""] : []),
    ...(m.cta ? [`${m.cta.label}: ${m.cta.url}`, ""] : []),
    "—",
    m.note ?? "Sent by Keystone property management on behalf of your landlord.",
  ].join("\n");
}

export type MailStatus = "sent" | "failed" | "skipped" | "duplicate";

/** Send one email, record it in email_log and the entity's activity trail. Never throws. */
export async function sendMail(m: Mail): Promise<{ status: MailStatus; error?: string }> {
  const to = m.to.trim().toLowerCase();
  try {
    if (m.dedupeKey) {
      const [dup] = await db
        .select({ id: s.emailLog.id })
        .from(s.emailLog)
        .where(and(eq(s.emailLog.dedupeKey, m.dedupeKey), inArray(s.emailLog.status, ["sent", "skipped"])));
      if (dup) return { status: "duplicate" };
    }
    let status: "sent" | "failed" | "skipped" = "sent";
    let providerId: string | null = null;
    let error: string | null = null;
    if (!to || undeliverable(to)) {
      status = "skipped";
      error = "Demo or placeholder address — not delivered";
    } else if (!emailEnabled()) {
      status = "skipped";
      error = "Email is not configured (RESEND_API_KEY missing)";
    } else {
      const r = await resend().emails.send({ from: fromAddress(), to: [to], subject: m.subject, html: renderHtml(m), text: renderText(m), replyTo: m.replyTo });
      if (r.error) {
        status = "failed";
        error = r.error.message;
      } else providerId = r.data?.id ?? null;
    }
    await db.insert(s.emailLog).values({ landlordId: m.landlordId, to, subject: m.subject, kind: m.kind, entityType: m.entityType ?? null, entityId: m.entityId ?? null, dedupeKey: m.dedupeKey ?? null, status, providerId, error });
    if (m.entityType) {
      const msg = status === "sent" ? `Emailed ${to}: “${m.subject}”` : status === "skipped" ? `Email to ${to} not sent (${to && undeliverable(to) ? "demo address" : "email not configured"}): “${m.subject}”` : `Email to ${to} failed: ${error}`;
      await log(m.landlordId, m.entityType, m.entityId ?? null, msg, "Keystone");
    }
    if (status === "failed") console.warn(`[email] ${m.kind} to ${to} failed: ${error}`);
    return { status, error: error ?? undefined };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn(`[email] ${m.kind} to ${to} threw: ${error}`);
    await db
      .insert(s.emailLog)
      .values({ landlordId: m.landlordId, to, subject: m.subject, kind: m.kind, entityType: m.entityType ?? null, entityId: m.entityId ?? null, dedupeKey: m.dedupeKey ?? null, status: "failed", error })
      .catch(() => {});
    return { status: "failed", error };
  }
}

/** Fire-and-forget: don't make the request wait on the email provider. */
export function notify(...mails: Mail[]) {
  for (const m of mails) void sendMail(m);
}

/** The workspace owner's contact details, if they want landlord alerts. */
export async function landlordContact(landlordId: string, requireAlerts = true) {
  const [o] = await db.select().from(s.profiles).where(eq(s.profiles.userId, landlordId));
  if (!o || !o.email || (requireAlerts && !o.notifyEmails)) return null;
  return o;
}
