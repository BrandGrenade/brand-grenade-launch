import { z } from "zod";

export const HubInput = z.object({
  client: z.string().trim().min(1).max(200),
  job: z.string().max(200).nullable(),
  ctx: z.string().max(2000).nullable(),
}).nullable().optional();