export type PlanId = "essentials" | "manage" | "pro";

export const PLAN_ORDER: PlanId[] = ["essentials", "manage", "pro"];

export const PLANS: Record<
  PlanId,
  {
    name: string;
    annual: number; // $/mo billed annually
    monthly: number; // $/mo billed monthly
    tagline: string;
    maxPortfolios: number; // Infinity = unlimited
    features: string[];
  }
> = {
  essentials: {
    name: "Essentials",
    annual: 0,
    monthly: 0,
    tagline: "Everything you need to get organized.",
    maxPortfolios: 1,
    features: [
      "Unlimited properties & units",
      "Rental listings & online applications",
      "Tenant screening (applicant-paid)",
      "Rent tracking & tenant ledgers",
      "Maintenance requests & work orders",
      "Document storage",
      "2 core reports (Net Cash Flow, Rent Roll)",
    ],
  },
  manage: {
    name: "Manage",
    annual: 12,
    monthly: 15,
    tagline: "Automate leasing and bookkeeping.",
    maxPortfolios: 1,
    features: [
      "Everything in Essentials",
      "Lease builder + unlimited e-signatures",
      "Vendor invoices & approval workflow",
      "Income Statement, Schedule E & Tenant Ledger reports",
      "CPA access with tax document sharing",
      "Late fee automation",
      "Online rent payments (ACH & card)",
    ],
  },
  pro: {
    name: "Pro",
    annual: 28,
    monthly: 35,
    tagline: "Scale with unlimited portfolios & reports.",
    maxPortfolios: Number.POSITIVE_INFINITY,
    features: [
      "Everything in Manage",
      "Unlimited portfolios",
      "Unlimited reports + CSV export",
      "1099 vendor summary & portfolio comparison",
      "Two-step invoice approvals over threshold",
      "Priority support",
    ],
  },
};

export type Feature = "esign" | "invoices" | "cpa" | "two_step" | "csv_export" | "late_fees" | "online_rent";

const FEATURE_MIN: Record<Feature, PlanId> = {
  esign: "manage",
  invoices: "manage",
  cpa: "manage",
  late_fees: "manage",
  online_rent: "manage",
  two_step: "pro",
  csv_export: "pro",
};

export type ReportId =
  | "net_cash_flow"
  | "rent_roll"
  | "income_statement"
  | "schedule_e"
  | "tenant_ledger"
  | "vendor_1099"
  | "portfolio_comparison"
  | "expense_by_category";

export const REPORTS: { id: ReportId; name: string; description: string; minPlan: PlanId }[] = [
  { id: "net_cash_flow", name: "Net Cash Flow", description: "Monthly income vs. expenses and net cash flow.", minPlan: "essentials" },
  { id: "rent_roll", name: "Rent Roll", description: "Every unit, tenant, lease term, rent and balance.", minPlan: "essentials" },
  { id: "income_statement", name: "Income Statement (P&L)", description: "Categorized income and expenses for a period.", minPlan: "manage" },
  { id: "schedule_e", name: "Schedule E Worksheet", description: "IRS Schedule E line items per property — ready for your CPA.", minPlan: "manage" },
  { id: "tenant_ledger", name: "Tenant Ledger", description: "Charges, payments and running balance per lease.", minPlan: "manage" },
  { id: "expense_by_category", name: "Expenses by Category", description: "Where the money goes, by category and property.", minPlan: "pro" },
  { id: "vendor_1099", name: "1099 Vendor Summary", description: "Vendor payments YTD with 1099-NEC flag at $600+.", minPlan: "pro" },
  { id: "portfolio_comparison", name: "Portfolio Comparison", description: "Side-by-side performance across portfolios.", minPlan: "pro" },
];

export function planAtLeast(plan: string, min: PlanId) {
  return PLAN_ORDER.indexOf(plan as PlanId) >= PLAN_ORDER.indexOf(min);
}

export function hasFeature(plan: string, f: Feature) {
  return planAtLeast(plan, FEATURE_MIN[f]);
}

export function featureMinPlan(f: Feature) {
  return FEATURE_MIN[f];
}

/** Schedule E expense lines (IRS Form 1040 Schedule E, Part I). */
export const SCHEDULE_E_EXPENSES = [
  { id: "advertising", line: 5, label: "Advertising" },
  { id: "auto_travel", line: 6, label: "Auto and travel" },
  { id: "cleaning_maintenance", line: 7, label: "Cleaning and maintenance" },
  { id: "commissions", line: 8, label: "Commissions" },
  { id: "insurance", line: 9, label: "Insurance" },
  { id: "legal_professional", line: 10, label: "Legal and other professional fees" },
  { id: "management_fees", line: 11, label: "Management fees" },
  { id: "mortgage_interest", line: 12, label: "Mortgage interest paid to banks" },
  { id: "other_interest", line: 13, label: "Other interest" },
  { id: "repairs", line: 14, label: "Repairs" },
  { id: "supplies", line: 15, label: "Supplies" },
  { id: "taxes", line: 16, label: "Taxes" },
  { id: "utilities", line: 17, label: "Utilities" },
  { id: "depreciation", line: 18, label: "Depreciation expense or depletion" },
  { id: "other", line: 19, label: "Other" },
] as const;

export const INCOME_CATEGORIES = [
  { id: "rents", label: "Rents received" },
  { id: "late_fees", label: "Late fees" },
  { id: "deposits", label: "Security deposits (held)" },
  { id: "other_income", label: "Other income" },
] as const;

export function categoryLabel(id: string) {
  return (
    SCHEDULE_E_EXPENSES.find((c) => c.id === id)?.label ??
    INCOME_CATEGORIES.find((c) => c.id === id)?.label ??
    id
  );
}
