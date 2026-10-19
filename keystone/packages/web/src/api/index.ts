import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { auth } from "./auth";
import { ping } from "./routes/ping";
import { me } from "./routes/me";
import { users } from "./routes/users";
import { portfolios, properties, units, listings } from "./routes/properties";
import { applications } from "./routes/applications";
import { leases } from "./routes/leases";
import { rent } from "./routes/rent";
import { cash } from "./routes/cash";
import { maintenance, vendors } from "./routes/maintenance";
import { invoices } from "./routes/invoices";
import { documents } from "./routes/documents";
import { reports } from "./routes/reports";
import { files } from "./routes/files";
import { demo } from "./routes/demo";
import { billing } from "./routes/billing";
import { email } from "./routes/email";
import { startReminderScheduler } from "./services/reminders";

export const router = {
  ping,
  me,
  users,
  portfolios,
  properties,
  units,
  listings,
  applications,
  leases,
  rent,
  cash,
  maintenance,
  vendors,
  invoices,
  documents,
  reports,
  files,
  demo,
  billing,
  email,
};

export type AppRouter = typeof router;
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Daily rent reminders + overdue notices (hourly tick, deduped per lease/period).
startReminderScheduler();

export default app;
