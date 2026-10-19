import { feature, plan, item } from "atmn";

// Boolean entitlements. Keystone's own gate table lives in packages/web/src/shared/plans.ts;
// these mirror it so the Autumn dashboard shows what each plan unlocks.
export const esign = feature({ id: "esign", name: "Lease e-signatures", type: "boolean" });
export const invoices = feature({ id: "invoices", name: "Vendor invoices & approvals", type: "boolean" });
export const cpaAccess = feature({ id: "cpa_access", name: "CPA access", type: "boolean" });
export const lateFees = feature({ id: "late_fees", name: "Late fee automation", type: "boolean" });
export const onlineRent = feature({ id: "online_rent", name: "Online rent payments", type: "boolean" });
export const twoStep = feature({ id: "two_step", name: "Two-step approvals", type: "boolean" });
export const csvExport = feature({ id: "csv_export", name: "CSV export", type: "boolean" });
export const unlimitedPortfolios = feature({ id: "unlimited_portfolios", name: "Unlimited portfolios", type: "boolean" });

const manageItems = [esign, invoices, cpaAccess, lateFees, onlineRent].map((f) => item({ featureId: f.id }));
const proItems = [...manageItems, ...[twoStep, csvExport, unlimitedPortfolios].map((f) => item({ featureId: f.id }))];

export const essentials = plan({ id: "essentials", name: "Essentials", group: "keystone", autoEnable: true, items: [] });

export const manageMonthly = plan({ id: "manage_monthly", name: "Manage (monthly)", group: "keystone", price: { amount: 15, interval: "month" }, items: manageItems });
export const manageAnnual = plan({ id: "manage_annual", name: "Manage (annual)", group: "keystone", price: { amount: 144, interval: "year" }, items: manageItems });
export const proMonthly = plan({ id: "pro_monthly", name: "Pro (monthly)", group: "keystone", price: { amount: 35, interval: "month" }, items: proItems });
export const proAnnual = plan({ id: "pro_annual", name: "Pro (annual)", group: "keystone", price: { amount: 336, interval: "year" }, items: proItems });

export default {
  features: [esign, invoices, cpaAccess, lateFees, onlineRent, twoStep, csvExport, unlimitedPortfolios],
  plans: [essentials, manageMonthly, manageAnnual, proMonthly, proAnnual],
};
