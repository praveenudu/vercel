import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useProperties = (portfolioId?: number | null) => useQuery(orpc.properties.list.queryOptions({ input: { portfolioId: portfolioId ?? null } }));
export const useProperty = (id: number) => useQuery(orpc.properties.get.queryOptions({ input: { id } }));
export const useCreateProperty = () => useAction(orpc.properties.create.mutationOptions());
export const useUpdateProperty = () => useAction(orpc.properties.update.mutationOptions());
export const useRemoveProperty = () => useAction(orpc.properties.remove.mutationOptions());
export const useCreateUnit = () => useAction(orpc.units.create.mutationOptions());
export const useUpdateUnit = () => useAction(orpc.units.update.mutationOptions());
export const useRemoveUnit = () => useAction(orpc.units.remove.mutationOptions());
