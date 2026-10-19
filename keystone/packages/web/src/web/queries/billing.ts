import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useBillingStatus = () => useQuery(orpc.billing.status.queryOptions());
export const useCheckout = () => useAction(orpc.billing.checkout.mutationOptions());
export const useBillingPortal = () => useAction(orpc.billing.portal.mutationOptions());
export const useBillingSync = () => useAction(orpc.billing.sync.mutationOptions());
