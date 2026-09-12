export const RESOURCES = ["wood", "metal", "rope", "food", "water", "medicine", "parts", "valuable", "fruit", "canned", "energy_drink", "torch"] as const;
export type Resource = typeof RESOURCES[number];
export const WORLD = {
  camp: { name: "🏕️ แคมป์", x: 620, y: 540, danger: 0, loot: { water: 60, food: 40 } },
  forest: { name: "🌲 ป่าโปร่ง", x: 360, y: 440, danger: 1, loot: { wood: 40, food: 30, rope: 20, fruit: 10 } },
  jungle: { name: "🌴 ป่าดงดิบ", x: 200, y: 700, danger: 2, loot: { food: 40, medicine: 25, rope: 25, fruit: 10 } },
  village: { name: "🛖 หมู่บ้าน", x: 490, y: 840, danger: 1, loot: { food: 35, medicine: 25, canned: 20, torch: 20 } },
  plains: { name: "🌾 ทุ่งราบ", x: 920, y: 630, danger: 1, loot: { food: 40, water: 40, fruit: 20 } },
  mountain: { name: "🏔️ ภูเขา", x: 570, y: 240, danger: 3, loot: { metal: 40, parts: 30, valuable: 15, rope: 15 } },
  cave: { name: "🪨 ถ้ำ", x: 890, y: 190, danger: 3, loot: { metal: 35, parts: 40, valuable: 25 } },
  ruins: { name: "🏚️ ซากวิหาร", x: 820, y: 930, danger: 3, loot: { parts: 35, valuable: 35, medicine: 30 } },
  volcano: { name: "🌋 ภูเขาไฟ", x: 1200, y: 190, danger: 4, loot: { valuable: 40, parts: 40, metal: 20 } },
  shipwreck: { name: "⚓ ซากเรือ", x: 1350, y: 970, danger: 2, loot: { metal: 30, parts: 30, medicine: 20, canned: 20 } },
  beach: { name: "🏖️ ชายหาด / เรือ", x: 1110, y: 870, danger: 1, loot: { wood: 45, rope: 35, water: 20 } },
  lake: { name: "💧 ทะเลสาบ", x: 1050, y: 420, danger: 1, loot: { water: 70, food: 20, fruit: 10 } },
  workshop: { name: "🛠️ โรงงานร้าง", x: 1300, y: 540, danger: 2, loot: { metal: 35, parts: 35, rope: 15, energy_drink: 15 } },
} as const;
export type Location = keyof typeof WORLD;
export const LOCATIONS = Object.keys(WORLD) as Location[];
export const ROUTES: { from: Location; to: Location; cost: number }[] = [
  { from: "camp", to: "forest", cost: 5 }, { from: "forest", to: "jungle", cost: 10 },
  { from: "jungle", to: "village", cost: 10 }, { from: "village", to: "ruins", cost: 15 },
  { from: "camp", to: "village", cost: 10 }, { from: "camp", to: "plains", cost: 5 },
  { from: "plains", to: "beach", cost: 10 }, { from: "beach", to: "shipwreck", cost: 10 },
  { from: "camp", to: "mountain", cost: 15 }, { from: "mountain", to: "cave", cost: 15 },
  { from: "cave", to: "volcano", cost: 25 }, { from: "mountain", to: "forest", cost: 10 },
  { from: "plains", to: "lake", cost: 5 }, { from: "lake", to: "workshop", cost: 10 },
  { from: "workshop", to: "volcano", cost: 25 }, { from: "workshop", to: "shipwreck", cost: 15 },
  { from: "ruins", to: "beach", cost: 10 }, { from: "lake", to: "cave", cost: 15 },
];
export const neighbours = (location: Location) => ROUTES.filter(e => e.from === location || e.to === location).map(e => ({ location: e.from === location ? e.to : e.from, cost: e.cost }));
export const MONSTER_TYPES = [
  { name: "หมาป่าป่า", homes: ["forest", "jungle"], hp: 35, damage: 8, detection: .4, aggression: .6 },
  { name: "อสูรหิน", homes: ["mountain", "cave"], hp: 55, damage: 12, detection: .5, aggression: .65 },
  { name: "ผู้พิทักษ์วิหาร", homes: ["ruins", "village"], hp: 60, damage: 12, detection: .5, aggression: .6 },
  { name: "อสูรแมกมา", homes: ["volcano", "workshop"], hp: 75, damage: 16, detection: .65, aggression: .75 },
];
