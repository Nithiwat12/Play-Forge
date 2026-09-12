export interface RoleDefinition { id: string; name: string; min?: number; max?: number; autoFill?: boolean; defaultMax?: number; thresholds?: { players: number; count: number }[] }
export type RoleConfig = Record<string, { mode: "default" | "exact" | "per_players" | "percentage"; count?: number; perPlayers?: number; percentage?: number; maxCount?: number }>;
