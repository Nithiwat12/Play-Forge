export type Resource = "wood" | "metal" | "rope" | "food" | "water" | "medicine" | "parts" | "valuable" | "fruit" | "canned" | "energy_drink" | "torch";
export type Location = string;
export const resources: Record<Resource, string> = { wood: "🪵 ไม้", metal: "🔩 โลหะ", rope: "🪢 เชือก", food: "🍖 อาหาร", water: "💧 น้ำ", medicine: "💊 ยา", parts: "⚙️ ชิ้นส่วน", valuable: "💎 ของมีค่า", fruit: "🍎 ผลไม้", canned: "🥫 อาหารกระป๋อง", energy_drink: "☕ เครื่องดื่มชูกำลัง", torch: "🔥 คบไฟ" };
export interface IslandResult { summary: string; winnerUserIds: string[]; details: { survivorWin?: boolean; spyWin?: boolean; players: { userId: string; username: string; role?: string; alive: boolean; escaped: boolean; objective: string; completed: boolean }[]; timeline: { id: string; day: number; text: string }[] } }
export interface Drop { id: string; location: string; items: Record<Resource, number>; expiresDay: number }
export interface Monster { name?: string; id: string; type: number; location: string; hp: number; maxHp: number; damage: number }
export interface IslandPublic {
  phase: "DAY_START" | "DAY" | "NIGHT" | "MORNING" | "DISCUSSION" | "VOTE" | "VOTE_RESULT" | "ESCAPE" | "FINISHED";
  day: number; phaseEndsAt: number | null; weather: string;
  world: Record<string, { name: string; x: number; y: number; danger: number; loot: Partial<Record<Resource, number>> }>;
  routes: { from: string; to: string; cost: number }[];
  players: { userId: string; username: string; alive: boolean; connected: boolean; location: string; escape: "BOARD" | "STAY" | null; revealedRole?: string }[];
  boat: Record<string, number>; boatCost: Record<string, number>; seats: number; occupiedSeats: number;
  ground: Record<Location, Record<Resource, number>>; drops: Drop[]; monsters: Monster[]; nests: { id: string; location: string; hp: number }[];
  missions: { id: string; location: string; resource: Resource; quantity: number; progress: number }[];
  votedUserIds: string[]; voteResult: { counts: Record<string, number>; eliminated: string | null; role?: string; tied: boolean } | null;
  rules: { maxDays: number; cycleSeconds: number; tieRule: string; spyVictory: string; survivorEscape: string; minimumEscape: number };
  logs: { id: string; day: number; text: string }[]; chat: { id: string; userId: string; username: string; text: string; day: number }[];
  requests: { id: string; from: string; kind: "help" | "resource"; resource: Resource; quantity: number; location: Location; status: string; health?: number; hunger?: number; thirst?: number }[];
  result?: IslandResult;
}
export interface IslandPrivate {
  role: string; alive: boolean; myLocation: string; nightUsed: boolean; nearbyPlayers: {userId: string; username: string}[];
  capacity: number; usedCapacity: number; bagLevel: number; nextCapacity: number | null; restAt: number; votedFor: string | null;
  localDrops: Drop[]; encounter: Monster | null; allies: { userId: string; username: string }[];
  health: number; energy: number; hunger: number; thirst: number; inventory: Record<Resource, number>; objective: string;
  evidence: string[];
  offers: { id: string; from: string; to: string; give: { resource: Resource; quantity: number }; want: { resource: Resource; quantity: number }; status: string }[];
}
