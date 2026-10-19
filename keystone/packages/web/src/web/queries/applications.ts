import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useApplications = () => useQuery(orpc.applications.list.queryOptions());
export const useApplication = (id: number) => useQuery(orpc.applications.get.queryOptions({ input: { id } }));
export const useSubmitApplication = () => useMutation(orpc.applications.submit.mutationOptions());
export const useRunScreening = () => useAction(orpc.applications.runScreening.mutationOptions());
export const useDecideApplication = () => useAction(orpc.applications.decide.mutationOptions());
