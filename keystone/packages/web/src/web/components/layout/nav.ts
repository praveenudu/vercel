import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, Building2, Megaphone, Wrench, HandCoins, Landmark, ReceiptText, HardHat, Search, FileSignature,
  FolderOpen, BarChart3, CreditCard, Home, FileText, ClipboardList,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label?: string; items: NavItem[] };

export const NAV: Record<string, NavGroup[]> = {
  landlord: [
    { items: [ { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/users", label: "Manage Users", icon: Users } ] },
    { label: "Properties", items: [ { href: "/properties", label: "Properties", icon: Building2 }, { href: "/listings", label: "Listings", icon: Megaphone }, { href: "/maintenance", label: "Maintenance", icon: Wrench }, { href: "/vendors", label: "Vendors", icon: HardHat } ] },
    { label: "Transactions", items: [ { href: "/rent", label: "Rent Collection", icon: HandCoins }, { href: "/cash", label: "Cash Management", icon: Landmark }, { href: "/invoices", label: "Invoices", icon: ReceiptText } ] },
    { label: "Tenants", items: [ { href: "/screening", label: "Screening", icon: Search }, { href: "/leases", label: "Leases", icon: FileSignature } ] },
    { label: "Resources", items: [ { href: "/documents", label: "Documents", icon: FolderOpen }, { href: "/reports", label: "Reports", icon: BarChart3 } ] },
    { items: [ { href: "/billing", label: "Plans & Billing", icon: CreditCard } ] },
  ],
  tenant: [
    { items: [ { href: "/tenant", label: "Home", icon: Home }, { href: "/tenant/payments", label: "Rent & Payments", icon: HandCoins }, { href: "/tenant/maintenance", label: "Maintenance", icon: Wrench }, { href: "/tenant/documents", label: "Documents", icon: FolderOpen } ] },
  ],
  vendor: [
    { items: [ { href: "/vendor", label: "Work Orders", icon: ClipboardList }, { href: "/vendor/invoices", label: "Invoices", icon: ReceiptText } ] },
  ],
  cpa: [
    { items: [ { href: "/cpa", label: "Overview", icon: LayoutDashboard } ] },
    { label: "Books", items: [ { href: "/cpa/reports", label: "Reports", icon: BarChart3 }, { href: "/cpa/transactions", label: "Transactions", icon: Landmark }, { href: "/cpa/documents", label: "Tax Documents", icon: FileText } ] },
  ],
};
