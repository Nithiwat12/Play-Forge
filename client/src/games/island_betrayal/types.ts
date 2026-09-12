export type Resource = "wood" | "metal" | "rope" | "food" | "water" | "medicine" | "parts" | "valuable";
export type Location = "camp" | "jungle" | "mountain" | "shipwreck" | "village" | "beach" | "volcano";
export interface IslandResult { summary: string; winnerUserIds: string[]; details: { players: { userId: string; username: string; alive: boolean; escaped: boolean; objective: string; completed: boolean }[]; timeline: { id: string; day: number; text: string }[] } }
export interface IslandPublic {
  phase: "DAY_START" | "ACTION" | "SECRET" | "EVENT" | "SURVIVAL" | "ESCAPE" | "FINISHED";
  day: number; phaseEndsAt: number | null; weather: string;
  players: { userId: string; username: string; alive: boolean; connected: boolean; location: Location; escape: "BOARD" | "STAY" | null }[];
  boat: Record<string, number>; boatCost: Record<string, number>; seats: number; occupiedSeats: number;
  ground: Record<Location, Record<Resource, number>>;
  logs: { id: string; day: number; text: string }[];
  chat: { id: string; userId: string; username: string; text: string; day: number }[];
  requests: { id: string; from: string; kind: "help" | "resource"; resource: Resource; quantity: number; location: Location; status: string; health?: number; hunger?: number; thirst?: number }[];
  result?: IslandResult;
}
export interface IslandPrivate {
  health: number; energy: number; hunger: number; thirst: number; inventory: Record<Resource, number>; objective: string;
  secret: { kind: string; target?: string; resource?: Resource; component?: string } | null; evidence: string[];
  offers: { id: string; from: string; to: string; give: { resource: Resource; quantity: number }; want: { resource: Resource; quantity: number }; status: string }[];
}
export const resources: Record<Resource, string> = { wood: "🪵 ไม้", metal: "🔩 โลหะ", rope: "🪢 เชือก", food: "🍖 อาหาร", water: "💧 น้ำ", medicine: "💊 ยา", parts: "⚙️ ชิ้นส่วน", valuable: "💎 ของมีค่า" };
export const locations: Record<Location, { label: string; loot: string; x: number; y: number }> = {
  camp: { label: "🏕️ แคมป์", loot: "น้ำ · อาหาร", x: 48, y: 52 },
  jungle: { label: "🌴 ป่า", loot: "ไม้ · อาหาร · เชือก", x: 23, y: 39 },
  mountain: { label: "⛰️ ภูเขา", loot: "โลหะ · ชิ้นส่วน · ของมีค่า", x: 45, y: 19 },
  shipwreck: { label: "⚓ ซากเรือ", loot: "โลหะ · ชิ้นส่วน · ยา · เชือก", x: 19, y: 77 },
  village: { label: "🛖 หมู่บ้าน", loot: "อาหาร · น้ำ · ยา", x: 77, y: 47 },
  beach: { label: "🏖️ ชายหาด", loot: "ไม้ · เชือก · น้ำ · สร้างเรือ", x: 57, y: 80 },
  volcano: { label: "🌋 ภูเขาไฟ", loot: "ของมีค่า · โลหะ · ชิ้นส่วน / อันตรายสูง", x: 77, y: 16 },
};
