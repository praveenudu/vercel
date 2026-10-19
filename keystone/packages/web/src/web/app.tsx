import type { ComponentType, ReactNode } from "react";
import { Redirect, Route, Switch } from "wouter";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";
import { RequireAuth, homeFor, useMeData, type Role } from "./components/session";
import { AppShell } from "./components/layout/app-shell";

import Landing from "./pages/public/landing";
import Pricing from "./pages/public/pricing";
import SignIn from "./pages/public/sign-in";
import Invite from "./pages/public/invite";
import Apply from "./pages/public/apply";

import Dashboard from "./pages/landlord/dashboard";
import UsersPage from "./pages/landlord/users";
import { PropertiesPage, PropertyDetailPage } from "./pages/landlord/properties";
import ListingsPage from "./pages/landlord/listings";
import { MaintenancePage, MaintenanceDetailPage } from "./pages/landlord/maintenance";
import VendorsPage from "./pages/landlord/vendors";
import RentPage from "./pages/landlord/rent";
import CashPage from "./pages/landlord/cash";
import InvoicesPage from "./pages/landlord/invoices";
import { ScreeningPage, ApplicationDetailPage } from "./pages/landlord/screening";
import { LeasesPage, NewLeasePage, LeaseDetailPage, LeasePrintPage } from "./pages/landlord/leases";
import DocumentsPage from "./pages/landlord/documents";
import ReportsPage from "./pages/landlord/reports";
import BillingPage from "./pages/landlord/billing";

import TenantHome from "./pages/tenant/home";
import { TenantPayments, TenantMaintenance, TenantDocuments } from "./pages/tenant/pages";
import { VendorWorkOrders, VendorInvoices } from "./pages/vendor/pages";
import { CpaOverview, CpaReports, CpaTransactions, CpaDocuments } from "./pages/cpa/pages";

/** Renders children only for the given role; everyone else is sent to their own home. */
function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const me = useMeData();
  if (me.profile.role !== role) return <Redirect to={homeFor(me.profile.role)} />;
  return <>{children}</>;
}

const routes: [Role, string, ComponentType][] = [
  ["landlord", "/dashboard", Dashboard],
  ["landlord", "/users", UsersPage],
  ["landlord", "/properties", PropertiesPage],
  ["landlord", "/properties/:id", PropertyDetailPage],
  ["landlord", "/listings", ListingsPage],
  ["landlord", "/maintenance", MaintenancePage],
  ["landlord", "/maintenance/:id", MaintenanceDetailPage],
  ["landlord", "/vendors", VendorsPage],
  ["landlord", "/rent", RentPage],
  ["landlord", "/cash", CashPage],
  ["landlord", "/invoices", InvoicesPage],
  ["landlord", "/screening", ScreeningPage],
  ["landlord", "/screening/:id", ApplicationDetailPage],
  ["landlord", "/leases", LeasesPage],
  ["landlord", "/leases/new", NewLeasePage],
  ["landlord", "/leases/:id", LeaseDetailPage],
  ["landlord", "/documents", DocumentsPage],
  ["landlord", "/reports", ReportsPage],
  ["landlord", "/billing", BillingPage],
  ["tenant", "/tenant", TenantHome],
  ["tenant", "/tenant/payments", TenantPayments],
  ["tenant", "/tenant/maintenance", TenantMaintenance],
  ["tenant", "/tenant/documents", TenantDocuments],
  ["vendor", "/vendor", VendorWorkOrders],
  ["vendor", "/vendor/invoices", VendorInvoices],
  ["cpa", "/cpa", CpaOverview],
  ["cpa", "/cpa/reports", CpaReports],
  ["cpa", "/cpa/transactions", CpaTransactions],
  ["cpa", "/cpa/documents", CpaDocuments],
];

function HomeRedirect() {
  const me = useMeData();
  return <Redirect to={homeFor(me.profile.role)} />;
}

function Workspace() {
  return (
    <RequireAuth>
      <AppShell>
        <Switch>
          {routes.map(([role, path, C]) => (
            <Route key={path} path={path}>
              <RoleGate role={role}>
                <C />
              </RoleGate>
            </Route>
          ))}
          <Route>
            <HomeRedirect />
          </Route>
        </Switch>
      </AppShell>
    </RequireAuth>
  );
}

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/sign-in" component={SignIn} />
        <Route path="/invite/:code" component={Invite} />
        <Route path="/apply/:unitId" component={Apply} />
        <Route path="/leases/:id/print">
          <RequireAuth roles={["landlord", "tenant"]}>
            <LeasePrintPage />
          </RequireAuth>
        </Route>
        <Route>
          <Workspace />
        </Route>
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
