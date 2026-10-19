import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useTransactions = (input: { portfolioId?: number | null; propertyId?: number | null; year?: number; type?: "income" | "expense" }) =>
  useQuery(orpc.cash.list.queryOptions({ input }));
export const useCreateTransaction = () => useAction(orpc.cash.create.mutationOptions());
export const useUpdateTransaction = () => useAction(orpc.cash.update.mutationOptions());
export const useRemoveTransaction = () => useAction(orpc.cash.remove.mutationOptions());
