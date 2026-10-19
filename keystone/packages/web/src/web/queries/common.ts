import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Wraps an oRPC mutation so every success refreshes all cached data (rent, ledgers and dashboards are interlinked). */
export function useAction<TData, TError, TVars, TCtx>(options: UseMutationOptions<TData, TError, TVars, TCtx>) {
  const qc = useQueryClient();
  return useMutation({
    ...options,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: allQueriesKey() });
    },
  });
}

/** Root query key for all oRPC queries — invalidating it refreshes every cached procedure. */
export const allQueriesKey = () => orpc.key();
