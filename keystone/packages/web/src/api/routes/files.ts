import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { withProfile } from "../middleware/auth";
import { presignGet, presignPut } from "../lib/s3";

export const files = {
  presign: withProfile.input(z.object({ filename: z.string(), contentType: z.string() })).handler(async ({ input, context }) => {
    const safe = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const key = `ws/${context.lid}/${Date.now()}-${safe}`;
    const url = await presignPut(key, input.contentType || "application/octet-stream");
    return { url, key };
  }),
  url: withProfile.input(z.object({ key: z.string(), filename: z.string().optional() })).handler(async ({ input, context }) => {
    if (!input.key.startsWith(`ws/${context.lid}/`)) throw new ORPCError("FORBIDDEN");
    return { url: await presignGet(input.key, input.filename) };
  }),
};
