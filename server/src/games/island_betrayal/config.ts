import { z } from "zod";
import type { RoleDefinition } from "../core/roles";
import { RESOURCES, LOCATIONS } from "./world";
export const ISLAND_ROLES: RoleDefinition[] = [
  { id: "spy", name: "🕵️ Spy", min: 1, max: 14, defaultMax: 3, thresholds: [{ players: 4, count: 1 }, { players: 7, count: 2 }, { players: 11, count: 3 }] },
  { id: "survivor", name: "👤 Survivor", autoFill: true },
];
const location = z.enum(LOCATIONS as [typeof LOCATIONS[number], ...typeof LOCATIONS[number][]]);
export const islandConfigSchema = z.object({
  cycleSeconds: z.number().int().min(60).max(600).default(300),
  discussionSeconds: z.number().int().min(15).max(180).default(30),
  voteSeconds: z.number().int().min(15).max(180).default(60),
  escapeSeconds: z.number().int().min(30).max(300).default(120),
  bagCapacities: z.array(z.number().int().min(4).max(40)).min(1).max(5).default([8, 12, 16, 20]),
  dropLifetimeDays: z.number().int().min(1).max(3).default(2),
  maxDays: z.number().int().min(3).max(20).default(10),
  threatPerDay: z.number().min(0).max(.4).default(.15),
  maxThreat: z.number().min(1).max(4).default(2.5),
  movementMultiplier: z.number().min(.5).max(2).default(1),
  spawnMultiplier: z.number().min(.5).max(2).default(1),
  spyVictory: z.enum(["prevent_escape", "survive_to_end"]).default("prevent_escape"),
  survivorEscape: z.enum(["any", "all", "minimum"]).default("any"),
  minimumEscape: z.number().int().min(1).max(14).default(1),
  tieRule: z.enum(["none", "random", "revote"]).default("none"),
  revealEliminatedRoles: z.boolean().default(true),
  spiesKnowEachOther: z.boolean().default(false),
  missions: z.array(z.object({ resource: z.enum(RESOURCES), quantity: z.number().int().min(1).max(30), location })).min(1).max(6)
    .default([{ resource: "wood", quantity: 10, location: "camp" }, { resource: "medicine", quantity: 1, location: "village" }, { resource: "parts", quantity: 2, location: "shipwreck" }]),
}).strict().refine(c => c.bagCapacities.every((n, i) => i === 0 || n > c.bagCapacities[i - 1]), "ความจุกระเป๋าต้องเพิ่มขึ้นทุกระดับ");
export type IslandConfig = z.infer<typeof islandConfigSchema>;
