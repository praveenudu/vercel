import { eq } from "drizzle-orm";
import { db } from "../database";
import * as s from "../database/schema";
import { landlordContact, notify, type Mail } from "./email";

type Lease = typeof s.leases.$inferSelect;

export const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const longDate = (d: string) => new Date(d.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export async function leasePlace(l: Pick<Lease, "unitId">) {
  const [u] = await db.select().from(s.units).where(eq(s.units.id, l.unitId));
  const [p] = u ? await db.select().from(s.properties).where(eq(s.properties.id, u.propertyId)) : [];
  return { unit: u ?? null, property: p ?? null, label: p ? `${p.address}${u ? `, ${u.name}` : ""}` : (u?.name ?? "your rental") };
}

async function ownerName(landlordId: string) {
  const [o] = await db.select({ name: s.profiles.name }).from(s.profiles).where(eq(s.profiles.userId, landlordId));
  return o?.name || "Your landlord";
}

/** Where a tenant should land: their portal, or the invite that creates their account. */
export const tenantLink = (base: string, l: Pick<Lease, "tenantUserId" | "inviteCode">, path = "/tenant") =>
  !l.tenantUserId && l.inviteCode ? `${base}/invite/${l.inviteCode}` : `${base}${path}`;

const firstName = (n: string) => n.trim().split(/\s+/)[0] || "there";

export async function emailInvite(base: string, inv: typeof s.invites.$inferSelect) {
  const who = await ownerName(inv.landlordId);
  const role = inv.role === "cpa" ? "accountant (CPA)" : inv.role;
  const what =
    inv.role === "tenant"
      ? "View your lease, pay rent, and submit maintenance requests in one place."
      : inv.role === "vendor"
        ? "See the work orders assigned to you, update job status, and submit invoices for approval."
        : "Get read-only access to income, expenses, Schedule E reports and tax documents.";
  notify({
    landlordId: inv.landlordId,
    to: inv.email,
    subject: `${who} invited you to Keystone`,
    kind: "invite",
    heading: `${who} invited you to join as their ${role}`,
    paragraphs: [`Hi ${firstName(inv.name)},`, `${who} manages their rentals on Keystone and added you as their ${role}. ${what}`],
    cta: { label: "Accept invite", url: `${base}/invite/${inv.code}` },
    note: "If you weren't expecting this invite, you can ignore this email.",
    entityType: inv.leaseId ? "lease" : undefined,
    entityId: inv.leaseId,
  });
}

export async function emailLeaseSent(base: string, l: Lease) {
  const who = await ownerName(l.landlordId);
  const { label } = await leasePlace(l);
  notify({
    landlordId: l.landlordId,
    to: l.tenantEmail,
    subject: `Your lease for ${label} is ready to sign`,
    kind: "lease_sent",
    heading: "Your lease is ready for your signature",
    paragraphs: [`Hi ${firstName(l.tenantName)},`, `${who} sent you a lease to review and e-sign. It only takes a couple of minutes — you can type or draw your signature.`],
    details: [
      ["Property", label],
      ["Term", `${longDate(l.startDate)} – ${longDate(l.endDate)}`],
      ["Monthly rent", usd(l.rent)],
      ["Security deposit", usd(l.deposit)],
    ],
    cta: { label: "Review & sign lease", url: tenantLink(base, l) },
    entityType: "lease",
    entityId: l.id,
  });
}

export async function emailTenantSigned(base: string, l: Lease) {
  const o = await landlordContact(l.landlordId);
  if (!o) return;
  const { label } = await leasePlace(l);
  notify({
    landlordId: l.landlordId,
    to: o.email,
    subject: `${l.tenantName} signed the lease — your countersignature is needed`,
    kind: "lease_signed",
    heading: `${l.tenantName} signed the lease`,
    paragraphs: [`The lease for ${label} has been e-signed by ${l.tenantName}. Countersign it to make it active and start the rent schedule.`],
    cta: { label: "Countersign lease", url: `${base}/leases/${l.id}` },
    note: "You're receiving this landlord alert from Keystone. Turn alerts off in Plans & Billing → Notifications.",
    entityType: "lease",
    entityId: l.id,
  });
}

export async function emailLeaseExecuted(base: string, l: Lease) {
  const { label } = await leasePlace(l);
  const mails: Mail[] = [
    {
      landlordId: l.landlordId,
      to: l.tenantEmail,
      subject: `Your lease for ${label} is fully executed`,
      kind: "lease_executed",
      heading: "Your lease is signed and active",
      paragraphs: [
        `Hi ${firstName(l.tenantName)},`,
        l.signMethod === "upload"
          ? `Your lease for ${label} is now active in Keystone. Use your tenant portal to track rent, report payments and request maintenance.`
          : `Both parties have signed your lease for ${label}. A copy is saved in your tenant portal.`,
      ],
      details: [
        ["Lease start", longDate(l.startDate)],
        ["Monthly rent", usd(l.rent)],
        ["Rent due", `Day ${l.dueDay} of each month`],
      ],
      cta: { label: l.tenantUserId ? "Open tenant portal" : "Set up your tenant account", url: tenantLink(base, l) },
      entityType: "lease",
      entityId: l.id,
    },
  ];
  const o = await landlordContact(l.landlordId);
  if (o)
    mails.push({
      landlordId: l.landlordId,
      to: o.email,
      subject: `Lease executed — ${l.tenantName}, ${label}`,
      kind: "lease_executed",
      heading: "Lease fully executed",
      paragraphs: [`The lease with ${l.tenantName} for ${label} is now active. The rent schedule has been created.`],
      cta: { label: "View lease", url: `${base}/leases/${l.id}` },
      note: "You're receiving this landlord alert from Keystone. Turn alerts off in Plans & Billing → Notifications.",
      entityType: "lease",
      entityId: l.id,
    });
  notify(...mails);
}

export async function emailReceipt(base: string, p: typeof s.payments.$inferSelect, balanceAfter: number) {
  const [l] = await db.select().from(s.leases).where(eq(s.leases.id, p.leaseId));
  if (!l) return;
  const { label } = await leasePlace(l);
  notify({
    landlordId: l.landlordId,
    to: l.tenantEmail,
    subject: `Payment received — ${usd(p.amount)}`,
    kind: "receipt",
    heading: "Payment received — thank you",
    paragraphs: [`Hi ${firstName(l.tenantName)}, your payment for ${label} has been received and applied to your ledger.`],
    details: [
      ["Amount", usd(p.amount)],
      ["Method", p.method.toUpperCase() + (p.reference ? ` · ${p.reference}` : "")],
      ["Date", longDate(p.paidAt)],
      ["Remaining balance", usd(Math.max(0, balanceAfter))],
    ],
    cta: { label: "View your ledger", url: tenantLink(base, l, "/tenant/payments") },
    dedupeKey: `receipt:${p.id}`,
    entityType: "lease",
    entityId: l.id,
  });
}

export async function emailPaymentReported(base: string, p: typeof s.payments.$inferSelect, l: Lease) {
  const o = await landlordContact(l.landlordId);
  if (!o) return;
  notify({
    landlordId: l.landlordId,
    to: o.email,
    subject: `${l.tenantName} reported a ${usd(p.amount)} payment`,
    kind: "payment_reported",
    heading: "A tenant reported a payment",
    paragraphs: [`${l.tenantName} says they paid ${usd(p.amount)} by ${p.method.toUpperCase()}. Confirm it once the money arrives so it posts to their ledger.`],
    details: [
      ["Amount", usd(p.amount)],
      ["Method", p.method.toUpperCase() + (p.reference ? ` · ${p.reference}` : "")],
      ["Paid on", longDate(p.paidAt)],
    ],
    cta: { label: "Review payment", url: `${base}/rent` },
    note: "You're receiving this landlord alert from Keystone. Turn alerts off in Plans & Billing → Notifications.",
    entityType: "lease",
    entityId: l.id,
  });
}

export async function emailNewApplication(base: string, a: typeof s.applications.$inferSelect, unit: typeof s.units.$inferSelect) {
  const [p] = await db.select().from(s.properties).where(eq(s.properties.id, unit.propertyId));
  const label = p ? `${p.address}, ${unit.name}` : unit.name;
  const who = await ownerName(unit.landlordId);
  const mails: Mail[] = [
    {
      landlordId: unit.landlordId,
      to: a.email,
      subject: `We received your application for ${label}`,
      kind: "application_received",
      heading: "Application received",
      paragraphs: [`Hi ${a.firstName},`, `Thanks for applying for ${label}. ${who} will review your application and may run a background and credit screening. You'll hear back by email.`],
      entityType: "application",
      entityId: a.id,
    },
  ];
  const o = await landlordContact(unit.landlordId);
  if (o)
    mails.push({
      landlordId: unit.landlordId,
      to: o.email,
      subject: `New application — ${a.firstName} ${a.lastName} for ${label}`,
      kind: "new_application",
      heading: "New rental application",
      paragraphs: [`${a.firstName} ${a.lastName} applied for ${label}.`],
      details: [
        ["Monthly income", a.monthlyIncome ? usd(a.monthlyIncome) : "Not provided"],
        ["Employer", a.employer || "Not provided"],
        ["Desired move-in", a.moveInDate ? longDate(a.moveInDate) : "Flexible"],
      ],
      cta: { label: "Review application", url: `${base}/screening/${a.id}` },
      note: "You're receiving this landlord alert from Keystone. Turn alerts off in Plans & Billing → Notifications.",
      entityType: "application",
      entityId: a.id,
    });
  notify(...mails);
}

export async function emailNewInvoice(base: string, inv: typeof s.invoices.$inferSelect) {
  const o = await landlordContact(inv.landlordId);
  if (!o) return;
  const [v] = await db.select().from(s.vendors).where(eq(s.vendors.id, inv.vendorId));
  const [p] = await db.select().from(s.properties).where(eq(s.properties.id, inv.propertyId));
  notify({
    landlordId: inv.landlordId,
    to: o.email,
    subject: `Invoice ${inv.number} from ${v?.company || v?.name || "a vendor"} — ${usd(inv.amount)}`,
    kind: "new_invoice",
    heading: "New vendor invoice awaiting approval",
    paragraphs: [`${v?.company || v?.name || "A vendor"} submitted invoice ${inv.number}${p ? ` for ${p.address}` : ""}.`],
    details: [
      ["Amount", usd(inv.amount)],
      ["Description", inv.description || "—"],
      ...(inv.dueDate ? ([["Due", longDate(inv.dueDate)]] as [string, string][]) : []),
    ],
    cta: { label: "Review invoice", url: `${base}/invoices` },
    note: "You're receiving this landlord alert from Keystone. Turn alerts off in Plans & Billing → Notifications.",
    entityType: inv.requestId ? "maintenance" : "invoice",
    entityId: inv.requestId ?? inv.id,
  });
}

export async function emailNewRequest(base: string, r: typeof s.maintenanceRequests.$inferSelect) {
  const o = await landlordContact(r.landlordId);
  if (!o) return;
  const { label } = await leasePlace(r);
  notify({
    landlordId: r.landlordId,
    to: o.email,
    subject: `${r.priority === "emergency" ? "EMERGENCY — " : ""}Maintenance request: ${r.title}`,
    kind: "new_request",
    heading: r.priority === "emergency" ? "Emergency maintenance request" : "New maintenance request",
    paragraphs: [`${r.submittedBy} submitted a request for ${label}.`, ...(r.description ? [`“${r.description}”`] : [])],
    details: [
      ["Category", r.category],
      ["Priority", r.priority],
      ["Entry permission", r.entryPermission ? "Yes" : "No — schedule with tenant"],
    ],
    cta: { label: "Assign a vendor", url: `${base}/maintenance/${r.id}` },
    note: "You're receiving this landlord alert from Keystone. Turn alerts off in Plans & Billing → Notifications.",
    entityType: "maintenance",
    entityId: r.id,
  });
}

export async function emailWorkOrder(base: string, v: typeof s.vendors.$inferSelect, requestId: number) {
  if (!v.email) return;
  const [r] = await db.select().from(s.maintenanceRequests).where(eq(s.maintenanceRequests.id, requestId));
  if (!r) return;
  const { label } = await leasePlace(r);
  const who = await ownerName(r.landlordId);
  notify({
    landlordId: r.landlordId,
    to: v.email,
    subject: `New work order: ${r.title} — ${label}`,
    kind: "work_order",
    heading: "You've been assigned a work order",
    paragraphs: [`Hi ${firstName(v.name)}, ${who} assigned you a job at ${label}.`, ...(r.description ? [`“${r.description}”`] : [])],
    details: [
      ["Priority", r.priority],
      ["Scheduled", r.scheduledFor ? r.scheduledFor.replace("T", " ") : "Not yet scheduled"],
      ["Entry permission", r.entryPermission ? "Yes" : "No — coordinate with tenant"],
    ],
    cta: v.userId ? { label: "Open work orders", url: `${base}/vendor` } : undefined,
    entityType: "maintenance",
    entityId: r.id,
  });
}
