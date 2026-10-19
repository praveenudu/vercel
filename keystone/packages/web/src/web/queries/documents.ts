import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useDocuments = (taxYear?: number) => useQuery(orpc.documents.list.queryOptions({ input: taxYear ? { taxYear } : {} }));
export const useMyDocuments = () => useQuery(orpc.documents.mine.queryOptions());
export const useCreateDocument = () => useAction(orpc.documents.create.mutationOptions());
export const useShareDocument = () => useAction(orpc.documents.share.mutationOptions());
export const useRemoveDocument = () => useAction(orpc.documents.remove.mutationOptions());
