import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useLeases = () => useQuery(orpc.leases.list.queryOptions());
export const useLease = (id: number) => useQuery(orpc.leases.get.queryOptions({ input: { id } }));
export const useMyLeases = () => useQuery(orpc.leases.mine.queryOptions());
export const useLeaseDefaults = (input: { applicationId?: number; unitId?: number }, enabled = true) =>
  useQuery({ ...orpc.leases.draftDefaults.queryOptions({ input }), enabled, staleTime: Infinity });
export const useCreateLease = () => useAction(orpc.leases.create.mutationOptions());
export const useUpdateLease = () => useAction(orpc.leases.update.mutationOptions());
export const useSendLease = () => useAction(orpc.leases.send.mutationOptions());
export const useTenantSign = () => useAction(orpc.leases.tenantSign.mutationOptions());
export const useCountersign = () => useAction(orpc.leases.countersign.mutationOptions());
export const useMarkSignedOffline = () => useAction(orpc.leases.markSignedOffline.mutationOptions());
export const useEndLease = () => useAction(orpc.leases.end.mutationOptions());
export const useRemoveLease = () => useAction(orpc.leases.remove.mutationOptions());
