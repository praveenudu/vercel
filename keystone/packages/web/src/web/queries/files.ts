import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export const useFileUrl = (key: string) => useQuery({ ...orpc.files.url.queryOptions({ input: { key } }), staleTime: 10 * 60_000 });
