import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useRequests = () => useQuery(orpc.maintenance.list.queryOptions());
export const useRequest = (id: number) => useQuery(orpc.maintenance.get.queryOptions({ input: { id } }));
export const useCreateRequest = () => useAction(orpc.maintenance.create.mutationOptions());
export const useAssignRequest = () => useAction(orpc.maintenance.assign.mutationOptions());
export const useUpdateRequestStatus = () => useAction(orpc.maintenance.updateStatus.mutationOptions());

export const useVendors = (enabled = true) => useQuery({ ...orpc.vendors.list.queryOptions(), enabled });
export const useVendorMe = () => useQuery(orpc.vendors.me.queryOptions());
export const useCreateVendor = () => useAction(orpc.vendors.create.mutationOptions());
export const useUpdateVendor = () => useAction(orpc.vendors.update.mutationOptions());
