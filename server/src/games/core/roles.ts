import { randomInt } from "crypto";
import { z } from "zod";

export interface RoleDefinition {
  id: string; name: string; min?: number; max?: number; autoFill?: boolean;
  defaultMax?: number; thresholds?: { players: number; count: number }[];
}
export const roleConfigSchema = z.record(z.string().regex(/^[a-z][a-z0-9_]{0,30}$/), z.object({
  mode: z.enum(["default", "exact", "per_players", "percentage"]).default("default"),
  count: z.number().int().min(0).max(19).optional(),
  perPlayers: z.number().int().min(2).max(20).optional(),
  percentage: z.number().int().min(1).max(90).optional(),
  maxCount: z.number().int().min(1).max(19).optional(),
}).strict());
export type RoleConfig = z.infer<typeof roleConfigSchema>;
export function resolveRoleCounts(defs: RoleDefinition[], input: unknown, players: number): Record<string, number> {
  const settings = roleConfigSchema.parse(input ?? {});
  const counts: Record<string, number> = {};
  for (const id of Object.keys(settings)) if (!defs.some(d => d.id === id && !d.autoFill)) throw new Error("บทบาทนี้ไม่รองรับการตั้งค่า");
  let assigned = 0;
  for (const d of defs.filter(d => !d.autoFill)) {
    const c = settings[d.id] ?? { mode: "default" };
    let count = d.min ?? 0;
    if (c.mode === "exact") { if (c.count === undefined) throw new Error("กรุณาระบุจำนวนบทบาท"); count = c.count; }
    else if (c.mode === "per_players") { if (!c.perPlayers) throw new Error("กรุณาระบุจำนวนผู้เล่นต่อบทบาท"); count = Math.max(d.min ?? 0, Math.floor(players / c.perPlayers)); }
    else if (c.mode === "percentage") { if (!c.percentage) throw new Error("กรุณาระบุเปอร์เซ็นต์บทบาท"); count = Math.max(d.min ?? 0, Math.floor(players * c.percentage / 100)); }
    else for (const tier of d.thresholds ?? []) if (players >= tier.players) count = tier.count;
    if (c.mode !== "exact") count = Math.min(count, c.maxCount ?? d.defaultMax ?? d.max ?? players);
    if (count < (d.min ?? 0) || count > (d.max ?? players)) throw new Error(`จำนวน ${d.name} ไม่ถูกต้อง`);
    counts[d.id] = count; assigned += count;
  }
  const fillers = defs.filter(d => d.autoFill);
  if (fillers.length !== 1 || assigned >= players) throw new Error("ต้องมีผู้เล่นสำหรับบทบาทหลักเหลืออย่างน้อย 1 คน");
  counts[fillers[0].id] = players - assigned;
  return counts;
}
export function assignRoles(userIds: string[], counts: Record<string, number>): Map<string, string> {
  const shuffled = [...userIds];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = randomInt(i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const roles = Object.entries(counts).flatMap(([role, count]) => Array<string>(count).fill(role));
  if (roles.length !== userIds.length) throw new Error("จำนวนบทบาทไม่ตรงกับผู้เล่น");
  return new Map(shuffled.map((id, i) => [id, roles[i]]));
}
