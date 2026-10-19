import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useInvoices = () => useQuery(orpc.invoices.list.queryOptions());
export const useSubmitInvoice = () => useAction(orpc.invoices.submit.mutationOptions());
export const useDecideInvoice = () => useAction(orpc.invoices.decide.mutationOptions());
export const usePayInvoice = () => useAction(orpc.invoices.pay.mutationOptions());
