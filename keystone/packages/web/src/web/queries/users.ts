import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useUsers = () => useQuery(orpc.users.list.queryOptions());
export const useInviteUser = () => useAction(orpc.users.invite.mutationOptions());
export const useRevokeInvite = () => useAction(orpc.users.revokeInvite.mutationOptions());
export const useRemoveUser = () => useAction(orpc.users.remove.mutationOptions());
