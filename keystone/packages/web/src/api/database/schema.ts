import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date());

/** Role + workspace for every user. Landlords own a workspace (landlordId = own userId). */
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  role: text("role").notNull().default("landlord"), // landlord | tenant | vendor | cpa
  landlordId: text("landlord_id").notNull(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  plan: text("plan").notNull().default("essentials"), // essentials | manage | pro (landlord only)
  billingCycle: text("billing_cycle").notNull().default("annual"),
  approvalThreshold: integer("approval_threshold").notNull().default(100000), // cents
  defaultLateFee: integer("default_late_fee").notNull().default(5000),
  defaultGraceDays: integer("default_grace_days").notNull().default(5),
  remindersEnabled: integer("reminders_enabled", { mode: "boolean" }).notNull().default(true),
  reminderDays: integer("reminder_days").notNull().default(3),
  notifyEmails: integer("notify_emails", { mode: "boolean" }).notNull().default(true), // landlord alerts
  createdAt: createdAt(),
});

export const invites = sqliteTable("invites", {
  id: id(),
  code: text("code").notNull().unique(),
  landlordId: text("landlord_id").notNull(),
  role: text("role").notNull(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  vendorId: integer("vendor_id"),
  leaseId: integer("lease_id"),
  acceptedBy: text("accepted_by"),
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export const portfolios = sqliteTable("portfolios", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const properties = sqliteTable("properties", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  portfolioId: integer("portfolio_id"),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  zip: text("zip").notNull().default(""),
  type: text("type").notNull().default("single_family"),
  purchasePrice: integer("purchase_price").notNull().default(0),
  currentValue: integer("current_value").notNull().default(0),
  createdAt: createdAt(),
});

export const units = sqliteTable("units", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  propertyId: integer("property_id").notNull(),
  name: text("name").notNull(),
  beds: integer("beds").notNull().default(1),
  baths: integer("baths").notNull().default(1),
  sqft: integer("sqft").notNull().default(0),
  rent: integer("rent").notNull().default(0),
  deposit: integer("deposit").notNull().default(0),
  status: text("status").notNull().default("vacant"), // vacant | listed | occupied
  listingTitle: text("listing_title").notNull().default(""),
  listingDescription: text("listing_description").notNull().default(""),
  availableDate: text("available_date").notNull().default(""),
  createdAt: createdAt(),
});

export const applications = sqliteTable("applications", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  unitId: integer("unit_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  dob: text("dob").notNull().default(""),
  currentAddress: text("current_address").notNull().default(""),
  monthsAtAddress: integer("months_at_address").notNull().default(0),
  employer: text("employer").notNull().default(""),
  jobTitle: text("job_title").notNull().default(""),
  monthlyIncome: integer("monthly_income").notNull().default(0),
  employmentMonths: integer("employment_months").notNull().default(0),
  prevLandlord: text("prev_landlord").notNull().default(""),
  prevLandlordPhone: text("prev_landlord_phone").notNull().default(""),
  priorEviction: integer("prior_eviction", { mode: "boolean" }).notNull().default(false),
  occupants: integer("occupants").notNull().default(1),
  pets: text("pets").notNull().default(""),
  referencesJson: text("references_json").notNull().default("[]"),
  moveInDate: text("move_in_date").notNull().default(""),
  consent: integer("consent", { mode: "boolean" }).notNull().default(false),
  consentSignature: text("consent_signature").notNull().default(""),
  status: text("status").notNull().default("submitted"), // submitted | screening | review | info_requested | approved | rejected
  score: integer("score"),
  recommendation: text("recommendation"),
  notes: text("notes").notNull().default(""),
  decidedAt: integer("decided_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export const screeningReports = sqliteTable("screening_reports", {
  id: id(),
  applicationId: integer("application_id").notNull(),
  provider: text("provider").notNull().default("TransUnion SmartMove (sandbox)"),
  creditScore: integer("credit_score").notNull(),
  creditBand: text("credit_band").notNull(),
  evictionRecords: integer("eviction_records").notNull().default(0),
  criminalRecords: integer("criminal_records").notNull().default(0),
  collections: integer("collections").notNull().default(0),
  incomeVerified: integer("income_verified", { mode: "boolean" }).notNull().default(false),
  verifiedIncome: integer("verified_income").notNull().default(0),
  riskLevel: text("risk_level").notNull(),
  breakdownJson: text("breakdown_json").notNull().default("{}"),
  createdAt: createdAt(),
});

export const leases = sqliteTable("leases", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  unitId: integer("unit_id").notNull(),
  applicationId: integer("application_id"),
  tenantUserId: text("tenant_user_id"),
  tenantName: text("tenant_name").notNull(),
  tenantEmail: text("tenant_email").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  rent: integer("rent").notNull(),
  deposit: integer("deposit").notNull().default(0),
  dueDay: integer("due_day").notNull().default(1),
  lateFee: integer("late_fee").notNull().default(5000),
  graceDays: integer("grace_days").notNull().default(5),
  clauses: text("clauses").notNull().default(""),
  status: text("status").notNull().default("draft"), // draft | sent | tenant_signed | active | ended
  signMethod: text("sign_method").notNull().default("esign"), // esign | upload
  tenantSignature: text("tenant_signature"),
  tenantSignatureType: text("tenant_signature_type"),
  tenantSignedAt: integer("tenant_signed_at", { mode: "timestamp" }),
  tenantSignIp: text("tenant_sign_ip"),
  landlordSignature: text("landlord_signature"),
  landlordSignatureType: text("landlord_signature_type"),
  landlordSignedAt: integer("landlord_signed_at", { mode: "timestamp" }),
  inviteCode: text("invite_code"),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export const rentCharges = sqliteTable("rent_charges", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  leaseId: integer("lease_id").notNull(),
  period: text("period").notNull(), // YYYY-MM
  dueDate: text("due_date").notNull(),
  type: text("type").notNull().default("rent"), // rent | late_fee | deposit
  amount: integer("amount").notNull(),
  createdAt: createdAt(),
});

export const payments = sqliteTable("payments", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  leaseId: integer("lease_id").notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull(), // zelle | check | cash | ach | other
  reference: text("reference").notNull().default(""),
  paidAt: text("paid_at").notNull(),
  status: text("status").notNull().default("reported"), // reported | confirmed | rejected
  reportedBy: text("reported_by").notNull().default("landlord"),
  note: text("note").notNull().default(""),
  createdAt: createdAt(),
});

export const vendors = sqliteTable("vendors", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  userId: text("user_id"),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  trade: text("trade").notNull().default("general"),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  taxIdLast4: text("tax_id_last4").notNull().default(""),
  w9OnFile: integer("w9_on_file", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const maintenanceRequests = sqliteTable("maintenance_requests", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  unitId: integer("unit_id").notNull(),
  leaseId: integer("lease_id"),
  submittedBy: text("submitted_by").notNull().default(""),
  submittedByRole: text("submitted_by_role").notNull().default("landlord"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("general"),
  priority: text("priority").notNull().default("normal"), // low | normal | high | emergency
  status: text("status").notNull().default("new"), // new | assigned | scheduled | in_progress | completed | closed
  vendorId: integer("vendor_id"),
  scheduledFor: text("scheduled_for"),
  entryPermission: integer("entry_permission", { mode: "boolean" }).notNull().default(true),
  photosJson: text("photos_json").notNull().default("[]"),
  vendorNotes: text("vendor_notes").notNull().default(""),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export const invoices = sqliteTable("invoices", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  requestId: integer("request_id"),
  propertyId: integer("property_id").notNull(),
  number: text("number").notNull(),
  amount: integer("amount").notNull(),
  category: text("category").notNull().default("repairs"),
  description: text("description").notNull().default(""),
  lineItemsJson: text("line_items_json").notNull().default("[]"),
  attachmentKey: text("attachment_key"),
  attachmentName: text("attachment_name"),
  status: text("status").notNull().default("submitted"), // submitted | pending_second | approved | rejected | paid
  approvalsJson: text("approvals_json").notNull().default("[]"),
  dueDate: text("due_date").notNull().default(""),
  paidAt: text("paid_at"),
  paidMethod: text("paid_method"),
  createdAt: createdAt(),
});

/** Cash management ledger — every income/expense, tagged to Schedule E category. */
export const transactions = sqliteTable("transactions", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  propertyId: integer("property_id"),
  date: text("date").notNull(),
  amount: integer("amount").notNull(), // positive cents
  type: text("type").notNull(), // income | expense
  category: text("category").notNull(),
  payee: text("payee").notNull().default(""),
  description: text("description").notNull().default(""),
  source: text("source").notNull().default("manual"), // manual | rent | invoice
  sourceId: integer("source_id"),
  account: text("account").notNull().default("Operating"),
  createdAt: createdAt(),
});

export const documents = sqliteTable("documents", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  propertyId: integer("property_id"),
  leaseId: integer("lease_id"),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"), // lease | tax_1098 | property_tax | insurance | receipt | w9 | closing | other
  taxYear: integer("tax_year"),
  fileKey: text("file_key"),
  contentType: text("content_type").notNull().default(""),
  size: integer("size").notNull().default(0),
  uploadedBy: text("uploaded_by").notNull().default(""),
  sharedWithCpa: integer("shared_with_cpa", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const activity = sqliteTable("activity", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  message: text("message").notNull(),
  actor: text("actor").notNull().default(""),
  createdAt: createdAt(),
});

/** Every outbound email — sent, failed or skipped (demo/test addresses). dedupeKey stops repeat reminders. */
export const emailLog = sqliteTable("email_log", {
  id: id(),
  landlordId: text("landlord_id").notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  kind: text("kind").notNull(), // invite | lease_sent | lease_signed | lease_executed | rent_reminder | rent_overdue | receipt | payment_reported | new_application | application_received | new_invoice | new_request | work_order | test
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  dedupeKey: text("dedupe_key"),
  status: text("status").notNull(), // sent | failed | skipped
  providerId: text("provider_id"),
  error: text("error"),
  createdAt: createdAt(),
});
