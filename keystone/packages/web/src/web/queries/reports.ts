import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export const useDashboard = (portfolioId?: number | null) => useQuery(orpc.reports.dashboard.queryOptions({ input: { portfolioId: portfolioId ?? null } }));
export const useReportCatalog = () => useQuery(orpc.reports.catalog.queryOptions());
export const useReport = (input: { id: string; year: number; portfolioId?: number | null }, enabled = true) =>
  useQuery({ ...orpc.reports.run.queryOptions({ input }), enabled, retry: false });
