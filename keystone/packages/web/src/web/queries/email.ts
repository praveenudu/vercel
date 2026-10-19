import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useEmailStatus = () => useQuery({ ...orpc.email.status.queryOptions(), staleTime: 60_000 });
export const useEmailLog = () => useQuery(orpc.email.log.queryOptions());
export const useSendTestEmail = () => useAction(orpc.email.test.mutationOptions());
