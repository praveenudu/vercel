import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useMe = (enabled = true) => useQuery({ ...orpc.me.get.queryOptions(), enabled, staleTime: 30_000 });
export const useInvite = (code: string) => useQuery({ ...orpc.me.invite.queryOptions({ input: { code } }), retry: false });
export const useUpdateSettings = () => useAction(orpc.me.updateSettings.mutationOptions());
export const useAcceptInvite = () => useAction(orpc.me.acceptInvite.mutationOptions());
export const useCreatePortfolio = () => useAction(orpc.portfolios.create.mutationOptions());
export const useRenamePortfolio = () => useAction(orpc.portfolios.rename.mutationOptions());
