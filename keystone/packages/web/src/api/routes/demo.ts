import { z } from "zod";
import { eq } from "drizzle-orm";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { base } from "../__core/app";
import { auth } from "../auth";
import { db } from "../database";
import * as s from "../database/schema";
import { syncCharges } from "../lib/util";
import { defaultClauses } from "../lib/lease-template";
import { simplePdf } from "../lib/pdf";
import { s3 } from "../lib/s3";

const PASSWORD = "keystone-demo-2026";
const ACCOUNTS = {
  landlord: { email: "landlord@demo.keystone.app", name: "Jordan Rivera" },
  tenant: { email: "tenant@demo.keystone.app", name: "Maya Chen" },
  vendor: { email: "vendor@demo.keystone.app", name: "Marco Diaz" },
  cpa: { email: "cpa@demo.keystone.app", name: "Dana Brooks, CPA" },
} as const;

let seeding: Promise<void> | null = null;

function monthStart(offset: number) {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + offset, 1)).toISOString().slice(0, 10);
}
function dayOf(offset: number, day: number) {
  return monthStart(offset).slice(0, 8) + String(day).padStart(2, "0");
}
const $ = (d: number) => Math.round(d * 100);

async function makeUser(email: string, name: string) {
  const res = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name } });
  return res.user.id;
}

async function putPdf(lid: string, name: string, title: string, lines: string[]) {
  const key = `ws/${lid}/demo-${name}`;
  try {
    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: simplePdf(title, lines), ContentType: "application/pdf" }));
    return key;
  } catch {
    return null;
  }
}

async function seed() {
  const [existing] = await db.select().from(s.user).where(eq(s.user.email, ACCOUNTS.landlord.email));
  if (existing) return;

  const lid = await makeUser(ACCOUNTS.landlord.email, ACCOUNTS.landlord.name);
  const tid = await makeUser(ACCOUNTS.tenant.email, ACCOUNTS.tenant.name);
  const vid = await makeUser(ACCOUNTS.vendor.email, ACCOUNTS.vendor.name);
  const cid = await makeUser(ACCOUNTS.cpa.email, ACCOUNTS.cpa.name);

  await db.insert(s.profiles).values([
    { userId: lid, role: "landlord", landlordId: lid, name: ACCOUNTS.landlord.name, email: ACCOUNTS.landlord.email, plan: "pro", approvalThreshold: $(1000) },
    { userId: tid, role: "tenant", landlordId: lid, name: ACCOUNTS.tenant.name, email: ACCOUNTS.tenant.email },
    { userId: vid, role: "vendor", landlordId: lid, name: ACCOUNTS.vendor.name, email: ACCOUNTS.vendor.email },
    { userId: cid, role: "cpa", landlordId: lid, name: ACCOUNTS.cpa.name, email: ACCOUNTS.cpa.email },
  ]);

  const [pfA] = await db.insert(s.portfolios).values({ landlordId: lid, name: "Austin Rentals" }).returning();
  const [pfD] = await db.insert(s.portfolios).values({ landlordId: lid, name: "Denver Multifamily" }).returning();

  const [maple] = await db.insert(s.properties).values({ landlordId: lid, portfolioId: pfA.id, name: "Maple Street Duplex", address: "1428 Maple St", city: "Austin", state: "TX", zip: "78704", type: "duplex", purchasePrice: $(512000), currentValue: $(585000) }).returning();
  const [oak] = await db.insert(s.properties).values({ landlordId: lid, portfolioId: pfA.id, name: "Oak Ridge Townhome", address: "77 Oak Ridge Ln", city: "Austin", state: "TX", zip: "78745", type: "townhome", purchasePrice: $(389000), currentValue: $(420000) }).returning();
  const [cedar] = await db.insert(s.properties).values({ landlordId: lid, portfolioId: pfD.id, name: "Cedar Flats", address: "2210 Cedar Ave", city: "Denver", state: "CO", zip: "80205", type: "multifamily", purchasePrice: $(940000), currentValue: $(1010000) }).returning();

  const [mA] = await db.insert(s.units).values({ landlordId: lid, propertyId: maple.id, name: "Unit A", beds: 2, baths: 1, sqft: 980, rent: $(1850), deposit: $(1850), status: "occupied" }).returning();
  const [mB] = await db
    .insert(s.units)
    .values({ landlordId: lid, propertyId: maple.id, name: "Unit B", beds: 2, baths: 2, sqft: 1040, rent: $(1950), deposit: $(1950), status: "listed", listingTitle: "Sunny 2BR/2BA duplex near South Congress", listingDescription: "Renovated 2 bed / 2 bath with quartz kitchen, in-unit washer/dryer, private fenced yard and covered parking. 8 minutes to downtown. Pets considered.", availableDate: dayOf(1, 1) })
    .returning();
  const [oT] = await db.insert(s.units).values({ landlordId: lid, propertyId: oak.id, name: "Main", beds: 3, baths: 3, sqft: 1620, rent: $(2400), deposit: $(2400), status: "occupied" }).returning();
  const [c101] = await db.insert(s.units).values({ landlordId: lid, propertyId: cedar.id, name: "101", beds: 1, baths: 1, sqft: 720, rent: $(1500), deposit: $(1500), status: "occupied" }).returning();
  const [c102] = await db.insert(s.units).values({ landlordId: lid, propertyId: cedar.id, name: "102", beds: 1, baths: 1, sqft: 740, rent: $(1450), deposit: $(1450), status: "occupied" }).returning();
  await db.insert(s.units).values({ landlordId: lid, propertyId: cedar.id, name: "103", beds: 2, baths: 1, sqft: 910, rent: $(1750), deposit: $(1750), status: "vacant" });

  // Applications
  const [appMaya] = await db
    .insert(s.applications)
    .values({ landlordId: lid, unitId: mA.id, firstName: "Maya", lastName: "Chen", email: ACCOUNTS.tenant.email, phone: "(512) 555-0142", currentAddress: "910 Lamar Blvd, Austin TX", monthsAtAddress: 26, employer: "Dell Technologies", jobTitle: "UX Designer", monthlyIncome: $(7800), employmentMonths: 38, prevLandlord: "Lamar Apartments", prevLandlordPhone: "(512) 555-0100", occupants: 1, pets: "None", referencesJson: JSON.stringify([{ name: "Ana Ruiz", phone: "(512) 555-0110", relation: "Manager" }, { name: "Tom Lee", phone: "(512) 555-0123", relation: "Former landlord" }]), moveInDate: monthStart(-7), consent: true, consentSignature: "Maya Chen", status: "approved", score: 92, recommendation: "approve", decidedAt: new Date() })
    .returning();
  await db.insert(s.screeningReports).values({ applicationId: appMaya.id, creditScore: 768, creditBand: "Excellent", evictionRecords: 0, criminalRecords: 0, collections: 0, incomeVerified: true, verifiedIncome: $(7800), riskLevel: "low", breakdownJson: JSON.stringify({ parts: { income: 30, credit: 25, eviction: 15, criminal: 10, employment: 10, history: 10 }, ratio: 4.22 }) });

  const apps = [
    { firstName: "Alex", lastName: "Morgan", email: "alex.morgan@example.com", phone: "(737) 555-0191", monthlyIncome: $(6900), employer: "Whole Foods Market", jobTitle: "Store Manager", employmentMonths: 30, monthsAtAddress: 18, status: "submitted" },
    { firstName: "Sam", lastName: "Patel", email: "sam.patel@example.com", phone: "(512) 555-0175", monthlyIncome: $(8400), employer: "Indeed", jobTitle: "Data Analyst", employmentMonths: 22, monthsAtAddress: 24, status: "submitted" },
    { firstName: "Taylor", lastName: "Brooks", email: "t.brooks@example.com", phone: "(512) 555-0133", monthlyIncome: $(3900), employer: "Freelance", jobTitle: "Photographer", employmentMonths: 5, monthsAtAddress: 7, status: "submitted" },
  ];
  for (const a of apps) {
    const [row] = await db
      .insert(s.applications)
      .values({ ...a, landlordId: lid, unitId: mB.id, currentAddress: "Austin, TX", prevLandlord: "Previous landlord", occupants: 2, pets: a.firstName === "Sam" ? "1 cat" : "None", referencesJson: JSON.stringify([{ name: "Reference One", phone: "(512) 555-0000", relation: "Employer" }]), moveInDate: dayOf(1, 1), consent: true, consentSignature: `${a.firstName} ${a.lastName}` })
      .returning();
    await db.insert(s.activity).values({ landlordId: lid, entityType: "application", entityId: row.id, message: `New application from ${a.firstName} ${a.lastName} for Unit B`, actor: `${a.firstName} ${a.lastName}` });
  }

  // Leases
  const mkLease = async (unit: typeof mA, prop: typeof maple, tenantName: string, tenantEmail: string, startOffset: number, extra: Partial<typeof s.leases.$inferInsert> = {}) => {
    const start = monthStart(startOffset);
    const endD = new Date(start + "T00:00:00Z");
    endD.setUTCFullYear(endD.getUTCFullYear() + 1);
    endD.setUTCDate(endD.getUTCDate() - 1);
    const signedAt = new Date(new Date(start).getTime() - 10 * 864e5);
    const [l] = await db
      .insert(s.leases)
      .values({
        landlordId: lid,
        unitId: unit.id,
        tenantName,
        tenantEmail,
        startDate: start,
        endDate: endD.toISOString().slice(0, 10),
        rent: unit.rent,
        deposit: unit.deposit,
        dueDay: 1,
        lateFee: $(75),
        graceDays: 5,
        clauses: defaultClauses({ landlord: ACCOUNTS.landlord.name, tenant: tenantName, address: `${prop.address}, ${unit.name}, ${prop.city}, ${prop.state} ${prop.zip}`, lateFee: "$75.00", graceDays: 5, deposit: `$${(unit.deposit / 100).toFixed(2)}` }),
        status: "active",
        tenantSignature: tenantName,
        tenantSignatureType: "typed",
        tenantSignedAt: signedAt,
        tenantSignIp: "73.12.44.101",
        landlordSignature: ACCOUNTS.landlord.name,
        landlordSignatureType: "typed",
        landlordSignedAt: new Date(signedAt.getTime() + 36e5 * 5),
        sentAt: new Date(signedAt.getTime() - 864e5),
        ...extra,
      })
      .returning();
    await db.insert(s.documents).values({ landlordId: lid, propertyId: prop.id, leaseId: l.id, name: `Executed lease — ${tenantName} (${unit.name})`, category: "lease", contentType: "lease/esign", uploadedBy: "Keystone e-sign", sharedWithCpa: false });
    return l;
  };
  const lMaya = await mkLease(mA, maple, "Maya Chen", ACCOUNTS.tenant.email, -7, { tenantUserId: tid, applicationId: appMaya.id });
  const lLuis = await mkLease(oT, oak, "Luis Ortega", "luis.ortega@example.com", -11);
  const lPriya = await mkLease(c101, cedar, "Priya Shah", "priya.shah@example.com", -9);
  const lBen = await mkLease(c102, cedar, "Ben Walker", "ben.walker@example.com", -10);
  await db.insert(s.activity).values({ landlordId: lid, entityType: "application", entityId: appMaya.id, message: "Lease executed — tenant moved in", actor: ACCOUNTS.landlord.name });

  // Payments (+ income transactions)
  const pay = async (l: typeof lMaya, propertyId: number, unitName: string, offset: number, day: number, method: string, status = "confirmed", amount = l.rent) => {
    const paidAt = dayOf(offset, day);
    const [p] = await db.insert(s.payments).values({ landlordId: lid, leaseId: l.id, amount, method, reference: method === "zelle" ? `ZL${Math.floor(Math.random() * 1e8)}` : method === "check" ? `#${1000 + Math.floor(Math.random() * 900)}` : "", paidAt, status, reportedBy: status === "reported" ? "tenant" : "landlord" }).returning();
    if (status === "confirmed") await db.insert(s.transactions).values({ landlordId: lid, propertyId, date: paidAt, amount, type: "income", category: "rents", payee: l.tenantName, description: `Rent payment (${method}) — ${unitName}`, source: "rent", sourceId: p.id });
  };
  // deposits
  for (const [l, pid, un, off] of [[lMaya, maple.id, "Unit A", -7], [lLuis, oak.id, "Main", -11], [lPriya, cedar.id, "101", -9], [lBen, cedar.id, "102", -10]] as const) {
    const paidAt = dayOf(off, 1);
    const [p] = await db.insert(s.payments).values({ landlordId: lid, leaseId: l.id, amount: l.deposit, method: "check", reference: "Deposit", paidAt, status: "confirmed" }).returning();
    await db.insert(s.transactions).values({ landlordId: lid, propertyId: pid, date: paidAt, amount: l.deposit, type: "income", category: "deposits", payee: l.tenantName, description: `Security deposit — ${un}`, source: "rent", sourceId: p.id });
  }
  for (let o = -7; o <= 0; o++) await pay(lMaya, maple.id, "Unit A", o, 1, "zelle", o === 0 ? "reported" : "confirmed");
  for (let o = -11; o <= 0; o++) await pay(lLuis, oak.id, "Main", o, 2, "ach");
  for (let o = -9; o <= 0; o++) await pay(lPriya, cedar.id, "101", o, 3, o % 2 ? "check" : "zelle");
  for (let o = -10; o <= -2; o++) await pay(lBen, cedar.id, "102", o, o === -3 ? 9 : 4, "cash");
  for (const l of [lMaya, lLuis, lPriya, lBen]) await syncCharges(l.id, true);

  // Vendors
  const [ace] = await db.insert(s.vendors).values({ landlordId: lid, userId: vid, name: "Marco Diaz", company: "Ace Plumbing Co.", trade: "plumbing", email: ACCOUNTS.vendor.email, phone: "(512) 555-0188", taxIdLast4: "4821", w9OnFile: true }).returning();
  const [spark] = await db.insert(s.vendors).values({ landlordId: lid, name: "Rachel Kim", company: "BrightSpark Electric", trade: "electrical", email: "rachel@brightspark.example", phone: "(303) 555-0144", taxIdLast4: "1937", w9OnFile: true }).returning();
  const [leaf] = await db.insert(s.vendors).values({ landlordId: lid, name: "Owen Hart", company: "GreenLeaf Landscaping", trade: "landscaping", email: "owen@greenleaf.example", phone: "(512) 555-0166", taxIdLast4: "", w9OnFile: false }).returning();
  const [cool] = await db.insert(s.vendors).values({ landlordId: lid, name: "Nina Patel", company: "CoolAir HVAC", trade: "hvac", email: "nina@coolair.example", phone: "(303) 555-0109", taxIdLast4: "7712", w9OnFile: true }).returning();

  // Maintenance + invoices
  const [sink] = await db.insert(s.maintenanceRequests).values({ landlordId: lid, unitId: mA.id, leaseId: lMaya.id, submittedBy: "Maya Chen", submittedByRole: "tenant", title: "Kitchen sink leaking under cabinet", description: "Water pooling under the sink after running the dishwasher. Put a bucket under it for now.", category: "plumbing", priority: "high", status: "in_progress", vendorId: ace.id, scheduledFor: dayOf(0, 10), vendorNotes: "Replaced P-trap, need to swap supply lines and disposal gasket." }).returning();
  const [hvac] = await db.insert(s.maintenanceRequests).values({ landlordId: lid, unitId: c102.id, leaseId: lBen.id, submittedBy: "Ben Walker", submittedByRole: "tenant", title: "AC not cooling", description: "Unit blows warm air since Monday.", category: "hvac", priority: "emergency", status: "completed", vendorId: cool.id, scheduledFor: dayOf(-2, 14), vendorNotes: "Replaced capacitor and recharged refrigerant.", completedAt: new Date() }).returning();
  const [fan] = await db.insert(s.maintenanceRequests).values({ landlordId: lid, unitId: c101.id, leaseId: lPriya.id, submittedBy: "Priya Shah", submittedByRole: "tenant", title: "Bathroom exhaust fan is very loud", description: "Rattling noise whenever the fan is on.", category: "electrical", priority: "low", status: "new" }).returning();
  await db.insert(s.maintenanceRequests).values({ landlordId: lid, unitId: oT.id, leaseId: lLuis.id, submittedBy: ACCOUNTS.landlord.name, submittedByRole: "landlord", title: "Quarterly yard maintenance", description: "Mow, edge, trim hedges.", category: "landscaping", priority: "normal", status: "scheduled", vendorId: leaf.id, scheduledFor: dayOf(0, 20) });
  for (const [r, msgs] of [
    [sink, ["Request submitted: Kitchen sink leaking under cabinet (high)", "Work order assigned to Ace Plumbing Co.", "Status → in progress — Replaced P-trap"]],
    [hvac, ["Request submitted: AC not cooling (emergency)", "Work order assigned to CoolAir HVAC", "Status → completed", "Invoice CA-2207 paid"]],
    [fan, ["Request submitted: Bathroom exhaust fan is very loud (low)"]],
  ] as const) {
    for (const m of msgs) await db.insert(s.activity).values({ landlordId: lid, entityType: "maintenance", entityId: r.id, message: m, actor: "" });
  }

  const li = (d: string, qty: number, price: number) => ({ description: d, qty, unitPrice: $(price) });
  const inv = async (v: typeof ace, propertyId: number, number: string, items: ReturnType<typeof li>[], category: string, status: string, offset: number, requestId: number | null = null, description = "") => {
    const amount = items.reduce((t, i) => t + i.qty * i.unitPrice, 0);
    const paidAt = status === "paid" ? dayOf(offset, 18) : null;
    const approvals = status === "paid" || status === "approved" ? [{ by: ACCOUNTS.landlord.name, at: new Date().toISOString(), decision: "approved", note: "", step: 1 }] : [];
    const [row] = await db.insert(s.invoices).values({ landlordId: lid, vendorId: v.id, propertyId, number, amount, category, description, lineItemsJson: JSON.stringify(items), status, approvalsJson: JSON.stringify(approvals), requestId, paidAt, paidMethod: paidAt ? "ach" : null, dueDate: dayOf(offset + 1, 1) }).returning();
    if (paidAt) await db.insert(s.transactions).values({ landlordId: lid, propertyId, date: paidAt, amount, type: "expense", category, payee: v.company, description: `Invoice ${number}${description ? ` — ${description}` : ""}`, source: "invoice", sourceId: row.id });
    return row;
  };
  await inv(ace, maple.id, "ACE-1043", [li("Emergency call-out", 1, 145), li("Supply lines + disposal gasket", 1, 186), li("Cabinet base water damage repair", 1, 640), li("Labor (hrs)", 3, 95)], "repairs", "submitted", 0, sink.id, "Kitchen sink leak repair");
  await inv(cool, cedar.id, "CA-2207", [li("Run capacitor", 1, 85), li("R-410A refrigerant (lb)", 3, 70), li("Labor (hrs)", 2, 120)], "repairs", "paid", -2, hvac.id, "AC repair unit 102");
  await inv(spark, cedar.id, "BSE-318", [li("Hallway LED fixture replacement", 6, 85), li("Labor", 1, 240)], "repairs", "paid", -5, null, "Common area lighting");
  await inv(spark, oak.id, "BSE-342", [li("GFCI outlets", 4, 38), li("Labor", 1, 180)], "repairs", "approved", -1, null, "Kitchen GFCI upgrade");
  for (let o = -9; o <= -1; o += 2) await inv(leaf, oak.id, `GL-${700 + o + 10}`, [li("Lawn service", 1, 165), li("Hedge trim", 1, 75)], "cleaning_maintenance", "paid", o);
  await inv(ace, cedar.id, "ACE-0981", [li("Water heater flush & anode", 3, 210)], "repairs", "paid", -6, null, "Annual water heater service");

  // Recurring expenses
  const exp = (propertyId: number, date: string, amount: number, category: string, payee: string, description: string) => db.insert(s.transactions).values({ landlordId: lid, propertyId, date, amount: $(amount), type: "expense", category, payee, description });
  for (let o = -11; o <= 0; o++) {
    await exp(maple.id, dayOf(o, 5), 890, "mortgage_interest", "Chase Home Lending", "Mortgage interest portion");
    await exp(oak.id, dayOf(o, 5), 640, "mortgage_interest", "Wells Fargo", "Mortgage interest portion");
    await exp(cedar.id, dayOf(o, 5), 1180, "mortgage_interest", "FirstBank", "Mortgage interest portion");
    await exp(cedar.id, dayOf(o, 12), 286 + (o % 3) * 22, "utilities", "Denver Water", "Water & sewer — common");
    await exp(maple.id, dayOf(o, 14), 92, "utilities", "Austin Energy", "House meter electric");
    await exp(cedar.id, dayOf(o, 1), 145, "management_fees", "Keystone", "Software & bookkeeping");
  }
  await exp(maple.id, dayOf(-8, 20), 2280, "insurance", "State Farm", "Landlord policy — annual");
  await exp(oak.id, dayOf(-8, 20), 1640, "insurance", "State Farm", "Landlord policy — annual");
  await exp(cedar.id, dayOf(-6, 10), 4890, "insurance", "Travelers", "Multifamily policy — annual");
  await exp(maple.id, dayOf(-9, 28), 4920, "taxes", "Travis County Tax Office", "Property tax");
  await exp(oak.id, dayOf(-9, 28), 3680, "taxes", "Travis County Tax Office", "Property tax");
  await exp(cedar.id, dayOf(-5, 30), 3060, "taxes", "Denver Treasury", "Property tax — 1st half");
  await exp(maple.id, dayOf(-1, 22), 89, "advertising", "Zillow Rental Manager", "Listing boost Unit B");
  await exp(cedar.id, dayOf(-3, 11), 650, "legal_professional", "Dana Brooks CPA", "Mid-year bookkeeping review");

  // Tax documents (real PDFs in storage)
  const year = new Date().getFullYear();
  const prior = year - 1;
  const docs: [string, string, number | null, number, string[]][] = [
    [`Form 1098 — Chase — Maple St ${prior}.pdf`, "tax_1098", maple.id, prior, ["Mortgage Interest Statement (Form 1098)", "Lender: JPMorgan Chase Bank, N.A.", "Property: 1428 Maple St, Austin TX 78704", `Tax year: ${prior}`, "Box 1 Mortgage interest received: $10,684.17", "Box 2 Outstanding principal: $401,226.00", "Box 10 Property tax paid from escrow: $4,920.00"]],
    [`Form 1098 — FirstBank — Cedar Flats ${prior}.pdf`, "tax_1098", cedar.id, prior, ["Mortgage Interest Statement (Form 1098)", "Lender: FirstBank", "Property: 2210 Cedar Ave, Denver CO 80205", `Tax year: ${prior}`, "Box 1 Mortgage interest received: $14,160.55", "Box 2 Outstanding principal: $702,118.00"]],
    [`Travis County Tax Statement ${year}.pdf`, "property_tax", maple.id, year, ["Travis Central Appraisal District", "Property tax statement", "Owner: Jordan Rivera", "Situs: 1428 Maple St / 77 Oak Ridge Ln", "Total levy: $8,600.00", "Paid in full"]],
    [`State Farm Landlord Policy ${year}.pdf`, "insurance", maple.id, year, ["State Farm Rental Dwelling Policy", "Named insured: Jordan Rivera", "Coverage A Dwelling: $480,000", "Loss of rents: 12 months", "Annual premium: $2,280.00"]],
    [`Closing Disclosure — Cedar Flats.pdf`, "closing", cedar.id, prior - 1, ["Closing Disclosure", "Property: 2210 Cedar Ave, Denver CO", "Purchase price: $940,000.00", "Land allocation (est.): $235,000.00", "Building basis: $705,000.00"]],
    [`W-9 — Ace Plumbing Co.pdf`, "w9", null, year, ["Form W-9 Request for Taxpayer ID", "Name: Ace Plumbing Co.", "Entity: Single-member LLC", "TIN: ***-**-4821"]],
  ];
  for (const [name, category, propertyId, taxYear, lines] of docs) {
    const key = await putPdf(lid, name.replace(/[^a-zA-Z0-9.-]/g, "_"), name.replace(".pdf", ""), lines);
    await db.insert(s.documents).values({ landlordId: lid, propertyId, name, category, taxYear, fileKey: key, contentType: "application/pdf", size: 1200, uploadedBy: ACCOUNTS.landlord.name, sharedWithCpa: true });
  }

  await db.insert(s.invites).values({ code: "demo-cpa-accepted", landlordId: lid, role: "cpa", name: ACCOUNTS.cpa.name, email: ACCOUNTS.cpa.email, acceptedBy: cid, acceptedAt: new Date() });
  await db.insert(s.activity).values([
    { landlordId: lid, entityType: "payment", entityId: null, message: "Maya Chen reported a $1,850.00 zelle payment — needs confirmation", actor: "Maya Chen" },
    { landlordId: lid, entityType: "invoice", entityId: null, message: "Invoice ACE-1043 submitted — $1,256.00", actor: "Marco Diaz" },
  ]);
}

export const demo = {
  /** Ensures the demo workspace exists and returns credentials for the requested role. */
  credentials: base.input(z.object({ role: z.enum(["landlord", "tenant", "vendor", "cpa"]) })).handler(async ({ input }) => {
    // Dedupe concurrent calls; seed() itself is a cheap no-op once the workspace exists.
    seeding ??= seed().finally(() => {
      seeding = null;
    });
    await seeding;
    return { email: ACCOUNTS[input.role].email, password: PASSWORD };
  }),
};
