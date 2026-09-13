import { z } from "zod";
export const itoConfigSchema = z.object({
  mode: z.enum(["TABLE", "ONLINE"]).default("ONLINE"),
  stages: z.number().int().min(1).max(3).default(3),
  roundSeconds: z.number().int().min(120).max(1200).default(600),
});
export type ItoConfig = z.infer<typeof itoConfigSchema>;
