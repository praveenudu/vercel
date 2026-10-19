import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useListings = () => useQuery(orpc.listings.list.queryOptions());
export const usePublicListing = (unitId: number) => useQuery({ ...orpc.listings.public.queryOptions({ input: { unitId } }), retry: false });
export const usePublishListing = () => useAction(orpc.listings.publish.mutationOptions());
export const useUnpublishListing = () => useAction(orpc.listings.unpublish.mutationOptions());
