import { randomInt, randomUUID } from "crypto";
import { BaseGame } from "../core/BaseGame";
import { GameActionError, GAME_ENGINE_EVENTS, type GameResult } from "../core/types";

import { RESOURCES, LOCATIONS, WORLD, ROUTES, neighbours, MONSTER_TYPES, type Resource, type Location } from "./world";
import { ISLAND_ROLES, islandConfigSchema, type IslandConfig } from "./config";
import { assignRoles, resolveRoleCounts } from "../core/roles";
export { RESOURCES } from "./world";
type Phase = "DAY_START" | "DAY" | "NIGHT" | "MORNING" | "DISCUSSION" | "VOTE" | "VOTE_RESULT" | "ESCAPE" | "FINISHED";
type Inventory = Record<Resource, number>;
export const BOAT_COST = { wood: 6, metal: 4, rope: 3, parts: 2 };
type Component = keyof typeof BOAT_COST;
interface Drop { id: string; location: Location; items: Inventory; expiresDay: number; hiddenUntilMorning?: boolean }
interface Monster { id: string; type: number; location: Location; hp: number; maxHp: number; damage: number; detectionRange: number; detection: number; aggression: number; nextMoveAt: number }
interface Mission { id: string; resource: Resource; quantity: number; location: Location; progress: number }
const OBJECTIVES = ["หนีออกจากเกาะพร้อมของมีค่าอย่างน้อย 2 ชิ้น", "ช่วยผู้เล่นที่แตกต่างกันอย่างน้อย 3 คน", "ไม่บริจาคทรัพยากรให้เรือเลย", "ก่อวินาศกรรมเรือสำเร็จอย่างน้อย 2 ครั้ง"];
const NAMES: Record<string, string> = { ...Object.fromEntries(LOCATIONS.map(l => [l, WORLD[l].name])), fruit: "ผลไม้", canned: "อาหารกระป๋อง", energy_drink: "เครื่องดื่มชูกำลัง", torch: "คบไฟ", camp: "แคมป์", jungle: "ป่า", mountain: "ภูเขา", shipwreck: "ซากเรือ", village: "หมู่บ้าน", beach: "ชายหาด", volcano: "ภูเขาไฟ", wood: "ไม้", metal: "โลหะ", rope: "เชือก", food: "อาหาร", water: "น้ำ", medicine: "ยา", parts: "ชิ้นส่วน", valuable: "ของมีค่า" };

interface Survivor {
  userId: string; username: string; connected: boolean; alive: boolean; location: Location;
  health: number; energy: number; hunger: number; thirst: number; inventory: Inventory;
  role: string; bagLevel: number; restAt: number; nightUsed: boolean; votedFor?: string; eliminatedRole?: string; nightLocation: Location;
  objective: number; helped: string[]; contributed: number; sabotages: number;
  evidence: string[]; escape: "BOARD" | "STAY" | null; escaped: boolean;
}
interface Log { id: string; day: number; text: string }
interface Offer { id: string; from: string; to: string; give: { resource: Resource; quantity: number }; want: { resource: Resource; quantity: number }; status: "pending" | "accepted" | "rejected" | "expired" }
interface Request { id: string; from: string; kind: "resource" | "help"; resource: Resource; quantity: number; location: Location; health?: number; hunger?: number; thirst?: number; status: "open" | "fulfilled" | "expired" }
const fail = (message: string): never => { throw new GameActionError(message); };
const member = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === "string" && list.includes(value as T);
const emptyInventory = (): Inventory => Object.fromEntries(RESOURCES.map(r => [r, 0])) as Inventory;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** One room owns one engine. Mutations are synchronous, so validation and transfers are atomic. */
export class IslandBetrayalGame extends BaseGame {
  readonly slug = "island_betrayal";
  private readonly config: IslandConfig;
  private readonly roomConfig: { roleConfig?: unknown };
  private worldTimer: NodeJS.Timeout | null = null;
  private drops: Drop[] = [];
  private monsters: Monster[] = [];
  private nests: { id: string; location: Location; hp: number }[] = [];
  private missions: Mission[] = [];
  private votes = new Map<string, string>();
  private voteResult: { counts: Record<string, number>; eliminated: string | null; role?: string; tied: boolean } | null = null;
  private revoted = false;
  private hiddenDeaths = new Set<string>();
  private encounter = new Map<string, string>();
  private avoided = new Map<string, number>();
  constructor(roomId: string, settings?: { roleConfig?: unknown; island?: unknown }) {
    super(roomId); this.roomConfig = settings ?? {}; this.config = islandConfigSchema.parse(settings?.island ?? {});
  }
  private survivors = new Map<string, Survivor>();
  private phase: Phase = "DAY_START";
  private day = 1;
  private phaseEndsAt: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private boat: Record<Component, number> = { wood: 0, metal: 0, rope: 0, parts: 0 };
  private seats = 0;
  private seatOrder: string[] = [];
  private ground: Record<Location, Inventory> = Object.fromEntries(LOCATIONS.map(l => [l, emptyInventory()])) as Record<Location, Inventory>;
  private logs: Log[] = [];
  private truth: Log[] = [];
  private chat: { id: string; userId: string; username: string; text: string; day: number }[] = [];
  private chatAt = new Map<string, number>();
  private offers: Offer[] = [];
  private requests: Request[] = [];
  private weather = "อากาศแจ่มใส";
  private result: GameResult | null = null;

  start(): void {
    if (this.started) fail("เกมเริ่มแล้ว");
    if (this.players.size < 4 || this.players.size > 15) fail("Island Betrayal ต้องมีผู้เล่น 4–15 คน");
    const roles = assignRoles([...this.players.keys()], resolveRoleCounts(ISLAND_ROLES, this.roomConfig.roleConfig, this.players.size));
    if (this.config.survivorEscape === "minimum" && this.config.minimumEscape > [...roles.values()].filter(r => r === "survivor").length) fail("จำนวนผู้รอดชีวิตขั้นต่ำที่ต้องหนีมากกว่าผู้รอดชีวิตจริง");
    this.started = true;
    this.seats = this.players.size;
    this.missions = this.config.missions.map((m, i) => ({ ...m, id: `mission-${i}`, progress: 0 }));
    this.nests = ["forest", "cave", "ruins"].map((location, i) => ({ id: `nest-${i}`, location: location as Location, hp: 60 }));
    for (const p of this.players.values()) this.survivors.set(p.userId, {
      ...p, connected: true, alive: true, location: "camp", health: 100, energy: 100, hunger: 100, thirst: 100,
      inventory: { ...emptyInventory(), food: 2, water: 2 }, objective: randomInt(OBJECTIVES.length),
      role: roles.get(p.userId)!, bagLevel: 0, restAt: 0, nightUsed: false, nightLocation: "camp",
      helped: [], contributed: 0, sabotages: 0, evidence: [], escape: null, escaped: false,
    });
    this.log("ทุกคนติดอยู่บนเกาะ มี Spy แฝงตัวอยู่ ทำภารกิจ สร้างเรือ และเดินทางไปชายหาดเพื่อหนี");
    this.beginDay();
    this.worldTimer = setInterval(() => { this.worldTick(); this.changed(); }, 10_000);
  }
  private log(text: string, secret = false) {
    const entry = { id: randomUUID(), day: this.day, text };
    this.truth.push(entry);
    if (!secret) this.logs.push(entry);
  }
  private changed() { this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED); }
  private living(connected = false) { return [...this.survivors.values()].filter(p => p.alive && (!connected || p.connected)); }
  private schedule(phase: Phase, milliseconds: number) {
    if (this.timer) clearTimeout(this.timer);
    this.phase = phase;
    this.phaseEndsAt = Date.now() + milliseconds;
    this.timer = setTimeout(() => { this.advancePhase(); this.changed(); }, milliseconds);
  }
  private beginDay() {
    if (!this.living().length || this.day > this.config.maxDays) { this.day = Math.min(this.day, this.config.maxDays); this.log("ถึงกำหนดวันสุดท้ายบนเกาะ"); this.end(); return; }
    this.drops = this.drops.filter(d => d.expiresDay > this.day);
    for (const p of this.living()) { p.energy = Math.min(100, p.energy + (p.hunger > 20 && p.thirst > 20 ? 30 : 10)); p.nightUsed = false; }
    for (const l of LOCATIONS) { this.ground[l] = emptyInventory(); for (let i = 0; i < Math.ceil(this.players.size / 2 * this.config.spawnMultiplier); i++) this.ground[l][this.rollLoot(l)]++; }
    this.spawnMonsters(); this.log(`เริ่มวันที่ ${this.day} / ${this.config.maxDays} ทรัพยากรใหม่ปรากฏบนเกาะ`);
    this.schedule("DAY_START", 2000);
  }
  private expireRequests() {
    this.offers.forEach(o => { if (o.status === "pending") o.status = "expired"; });
    this.requests.forEach(r => { if (r.status === "open") r.status = "expired"; });
  }
  private advancePhase() {
    if (this.finished) return;
    switch (this.phase) {
      case "DAY_START": this.schedule("DAY", this.config.cycleSeconds * 1000); this.maybeEscape(); break;
      case "DAY":
        this.expireRequests(); for (const p of this.survivors.values()) { p.nightUsed = false; p.nightLocation = p.location; }
        this.log("ค่ำคืนมาเยือน กลับแคมป์หรือเสี่ยงอยู่ข้างนอกได้ ตำแหน่งสาธารณะระหว่างคืนคือข้อมูลล่าสุดก่อนค่ำ");
        this.schedule("NIGHT", this.config.cycleSeconds * 1000); break;
      case "NIGHT":
        this.hiddenDeaths.clear(); this.drops.forEach(d => { d.hiddenUntilMorning = false; });
        this.runEvent(); this.survive(); if (!this.finished) this.schedule("MORNING", 5000); break;
      case "MORNING": this.schedule("DISCUSSION", this.config.discussionSeconds * 1000); break;
      case "DISCUSSION": this.votes.clear(); this.voteResult = null; this.revoted = false; this.schedule("VOTE", this.config.voteSeconds * 1000); break;
      case "VOTE": this.resolveVote(); break;
      case "VOTE_RESULT": this.day++; this.beginDay(); break;
      case "ESCAPE": this.finishEscape(); break;
    }
  }
  private actor(id: string) {
    const p = this.survivors.get(id);
    if (!p || !p.connected || !p.alive || this.finished) return fail("คุณไม่สามารถทำรายการได้ ผู้ชมดูได้อย่างเดียว");
    return p;
  }
  private target(id: unknown, actor: string) {
    const p = typeof id === "string" ? this.survivors.get(id) : undefined;
    if (!p || p.userId === actor || !p.alive || !p.connected) return fail("เลือกผู้เล่นอื่นที่ยังอยู่ในเกม");
    return p;
  }
  private quantity(value: unknown) { if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 50) return fail("จำนวนต้องเป็นจำนวนเต็ม 1–50"); return value; }
  private resource(value: unknown): Resource { if (!member(RESOURCES, value)) return fail("ทรัพยากรไม่ถูกต้อง"); return value; }
  private spend(p: Survivor, resource: Resource, quantity: number) { if (p.inventory[resource] < quantity) fail("ทรัพยากรไม่พอ"); p.inventory[resource] -= quantity; }
  private energy(p: Survivor, amount: number) { if (p.energy < amount) fail("พลังงานไม่พอ รอวันถัดไป"); p.energy -= amount; }
  private heal(p: Survivor, resource: Resource) {
    if (resource === "medicine") p.health = Math.min(100, p.health + 25);
    if (resource === "food") p.hunger = Math.min(100, p.hunger + 35);
    if (["food", "fruit", "canned", "energy_drink"].includes(resource)) { p.energy = Math.min(100, p.energy + ({ food: 25, fruit: 10, canned: 20, energy_drink: 35 } as Record<string, number>)[resource]); p.hunger = Math.min(100, p.hunger + (resource === "food" ? 0 : 15)); }
    if (resource === "water") p.thirst = Math.min(100, p.thirst + 35);
  }
  private help(p: Survivor, t: Survivor, r: Resource, secret: boolean) {
    this.spend(p, r, 1); this.heal(t, r);
    if (!p.helped.includes(t.userId)) p.helped.push(t.userId);
    this.log(`${p.username} ช่วย ${t.username} ด้วย${NAMES[r]}`, secret);
    if (secret) t.evidence.push(`คืนวันที่ ${this.day}: มีคนช่วยคุณด้วย${NAMES[r]}`);
  }
  private checkDeaths() {
    for (const p of this.living()) if (p.health <= 0) this.kill(p, false);
    if (!this.living().length) this.end();
  }
  private kill(p: Survivor, hidden: boolean) {
    p.health = 0; p.alive = false; this.encounter.delete(p.userId);
    if (hidden) this.hiddenDeaths.add(p.userId);
    this.drop(p.location, { ...p.inventory }, hidden); p.inventory = emptyInventory();
    this.log(hidden ? "มีผู้เล่นเสียชีวิตอย่างลึกลับในคืนนี้" : `${p.username} เสียชีวิตและกลายเป็นผู้ชม`, false);
    this.log(`${p.username} เสียชีวิตที่ ${NAMES[p.location]}`, hidden);
    this.offers.filter(o => o.from === p.userId || o.to === p.userId).forEach(o => { if (o.status === "pending") o.status = "expired"; });
    this.requests.filter(r => r.from === p.userId && r.status === "open").forEach(r => r.status = "expired");
  }
  handleAction(userId: string, actionType: string, payload: unknown): void {
    // A delayed timer callback cannot give clients extra action time.
    if (this.phaseEndsAt && Date.now() >= this.phaseEndsAt) { this.advancePhase(); this.changed(); }
    const p = this.actor(userId);
    const a = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
    if (actionType === "island:chat") {
      if (typeof a.text !== "string" || !a.text.trim() || a.text.length > 300) fail("ข้อความต้องยาว 1–300 ตัวอักษร");
      if (Date.now() - (this.chatAt.get(userId) ?? 0) < 1000) fail("กรุณารอสักครู่ก่อนส่งข้อความใหม่");
      this.chatAt.set(userId, Date.now());
      this.chat.push({ id: randomUUID(), userId, username: p.username, text: (a.text as string).trim(), day: this.day });
      if (this.chat.length > 100) this.chat.shift();
      this.changed(); return;
    }
    if (p.escape === "BOARD" && actionType !== "island:escape") fail("คุณอยู่บนเรือแล้ว รอออกเดินทาง");
    if (actionType === "island:vote") { this.castVote(p, a); this.changed(); return; }
    if (actionType === "island:kill" || actionType === "island:sabotage") { this.spyAction(p, actionType, a); this.changed(); return; }
    if (actionType === "island:escape") { this.chooseEscape(p, a); this.changed(); return; }
    const travelling = ["island:move", "island:use", "island:rest", "island:encounter", "island:drop", "island:pickup", "island:collect"].includes(actionType);
    if (this.phase !== "DAY" && !(travelling && ["NIGHT", "ESCAPE"].includes(this.phase))) fail("ทำรายการนี้ไม่ได้ในช่วงปัจจุบัน");
    if (this.encounter.has(userId) && !["island:encounter", "island:use", "island:drop"].includes(actionType)) fail("ต้องรับมือมอนสเตอร์ก่อน");
    switch (actionType) {
      case "island:warning": {
        if (typeof a.text !== "string" || !a.text.trim() || a.text.length > 300) fail("คำเตือนต้องยาว 1–300 ตัวอักษร");
        if (Date.now() - (this.chatAt.get(userId) ?? 0) < 1000) fail("กรุณารอสักครู่ก่อนส่งคำเตือนใหม่");
        this.chatAt.set(userId, Date.now());
        this.log(`⚠ ${p.username} เตือนจาก${NAMES[p.location]}: ${(a.text as string).trim()}`); break;
      }
      case "island:move": {
        if (!member(LOCATIONS, a.location) || a.location === p.location) fail("เลือกสถานที่อื่นบนเกาะ");
        const route = neighbours(p.location).find(r => r.location === a.location);
        if (!route) fail("จุดหมายไม่เชื่อมต่อกับตำแหน่งปัจจุบัน");
        this.energy(p, Math.ceil(route!.cost * this.config.movementMultiplier)); p.location = a.location as Location;
        this.log(`${p.username} เดินทางไป${NAMES[p.location]}`, this.phase === "NIGHT");
        this.detect(p); break;
      }
      case "island:explore": {
        this.energy(p, 10);
        const r = this.rollLoot(p.location);
        const count = 1 + randomInt(3); this.ground[p.location][r] += count;
        this.log(`${p.username} พบ${NAMES[r]} ${count} ที่${NAMES[p.location]} (กดเก็บเพื่อใส่กระเป๋า)`);
        if (randomInt(100) < WORLD[p.location].danger * 5) { p.health -= 15; this.log(`${p.username} บาดเจ็บจากการสำรวจ −15 สุขภาพ`); }
        this.checkDeaths(); if (p.alive) this.detect(p); break;
      }
      case "island:collect": {
        const r = this.resource(a.resource), q = this.quantity(a.quantity);
        if (this.ground[p.location][r] < q) fail("ของที่จุดนี้ไม่พอ หรือมีคนเก็บไปแล้ว");
        this.checkCapacity(p, q); this.ground[p.location][r] -= q; p.inventory[r] += q;
        this.log(`${p.username} เก็บ${NAMES[r]} ${q}`, this.phase === "NIGHT"); break;
      }
      case "island:use": {
        const r = this.resource(a.resource); if (!["food", "water", "medicine", "fruit", "canned", "energy_drink"].includes(r)) fail("ไอเทมนี้ใช้ฟื้นฟูไม่ได้");
        this.spend(p, r, 1); this.heal(p, r); this.log(`${p.username} ใช้${NAMES[r]}`, true); break;
      }
      case "island:contribute": {
        const r = this.resource(a.resource), q = this.quantity(a.quantity);
        if (p.location !== "beach") fail("ต้องอยู่ที่ชายหาดเพื่อสร้างเรือ");
        if (!Object.hasOwn(BOAT_COST, r)) fail("เรือไม่ใช้ทรัพยากรนี้");
        const c = r as Component;
        if (q > BOAT_COST[c] - this.boat[c]) fail("จำนวนเกินที่เรือต้องการ");
        this.spend(p, r, q); this.boat[c] += q; p.contributed += q;
        this.log(`${p.username} บริจาค${NAMES[r]} ${q} ให้เรือ`);
        this.maybeEscape();
        break;
      }
      case "island:help": {
        const t = this.target(a.target, userId), r = this.resource(a.resource);
        if (!["food", "water", "medicine"].includes(r)) fail("ช่วยด้วยอาหาร น้ำ หรือยาเท่านั้น");
        if (t.location !== p.location) fail("ต้องอยู่ที่เดียวกันจึงจะช่วยได้");
        this.help(p, t, r, false); break;
      }
      case "island:request": {
        const r = this.resource(a.resource), q = this.quantity(a.quantity);
        if (a.kind !== "help" && a.kind !== "resource") fail("ประเภทคำขอไม่ถูกต้อง");
        if (this.requests.some(x => x.from === userId && x.status === "open")) fail("มีคำขอเปิดอยู่แล้ว");
        if (a.kind === "help" && (!["food", "water", "medicine"].includes(r) || q !== 1)) fail("ขอความช่วยเหลือครั้งละ 1 อาหาร น้ำ หรือยา");
        this.requests.push({ id: randomUUID(), from: userId, kind: a.kind as "help" | "resource", resource: r, quantity: q, location: p.location, status: "open", ...(a.kind === "help" ? { health: p.health, hunger: p.hunger, thirst: p.thirst } : {}) });
        this.log(`${p.username} ขอ${a.kind === "help" ? "ความช่วยเหลือด้วย" : ""}${NAMES[r]} ${q} ที่${NAMES[p.location]}`); break;
      }
      case "island:fulfill": {
        const request = this.requests.find(r => r.id === a.id && r.status === "open");
        if (!request) fail("คำขอปิดแล้ว");
        const req = request!; const t = this.target(req.from, userId);
        if (p.location !== t.location) fail("ต้องอยู่สถานที่เดียวกัน");
        if (req.kind === "help") this.help(p, t, req.resource, false);
        else { this.checkCapacity(t, req.quantity); this.spend(p, req.resource, req.quantity); t.inventory[req.resource] += req.quantity; this.log(`${p.username} ส่ง${NAMES[req.resource]} ${req.quantity} ให้ ${t.username}`); }
        req.status = "fulfilled"; break;
      }
      case "island:offer": {
        const t = this.target(a.target, userId), give = this.resource(a.give), want = this.resource(a.want);
        const giveQuantity = this.quantity(a.giveQuantity), wantQuantity = this.quantity(a.wantQuantity);
        if (give === want) fail("เลือกทรัพยากรคนละประเภท");
        if (p.inventory[give] < giveQuantity) fail("ทรัพยากรที่จะเสนอไม่พอ");
        if (this.offers.filter(o => o.from === userId && o.status === "pending").length >= 3) fail("มีข้อเสนอค้างได้ไม่เกิน 3 รายการ");
        this.offers.push({ id: randomUUID(), from: userId, to: t.userId, give: { resource: give, quantity: giveQuantity }, want: { resource: want, quantity: wantQuantity }, status: "pending" }); break;
      }
      case "island:trade": {
        const o = this.offers.find(o => o.id === a.id && o.status === "pending" && o.to === userId);
        if (!o || typeof a.accept !== "boolean") fail("ข้อเสนอไม่ถูกต้อง หรือคุณไม่ใช่ผู้รับ");
        const offer = o!;
        if (!a.accept) { offer.status = "rejected"; break; }
        const t = this.target(offer.from, userId);
        if (p.location !== t.location) fail("ต้องอยู่สถานที่เดียวกันเพื่อแลกของ");
        if (t.inventory[offer.give.resource] < offer.give.quantity || p.inventory[offer.want.resource] < offer.want.quantity) fail("ทรัพยากรของฝ่ายใดฝ่ายหนึ่งไม่พอ");
        this.checkCapacity(p, offer.give.quantity - offer.want.quantity); this.checkCapacity(t, offer.want.quantity - offer.give.quantity);
        t.inventory[offer.give.resource] -= offer.give.quantity; p.inventory[offer.give.resource] += offer.give.quantity;
        p.inventory[offer.want.resource] -= offer.want.quantity; t.inventory[offer.want.resource] += offer.want.quantity;
        offer.status = "accepted"; this.log(`${p.username} แลกของกับ ${t.username}`); break;
      }
      case "island:rest": {
        if (Date.now() < p.restAt) fail("กำลังพัก รอให้ครบ 20 วินาที");
        if (this.encounter.has(userId)) fail("พักระหว่างเผชิญมอนสเตอร์ไม่ได้");
        p.restAt = Date.now() + 20_000;
        p.energy = Math.min(100, p.energy + (p.hunger < 20 || p.thirst < 20 ? 5 : p.location === "camp" ? 20 : 10));
        if (p.location === "camp") p.health = Math.min(100, p.health + 5); break;
      }
      case "island:upgrade": {
        if (!["camp", "workshop"].includes(p.location)) fail("อัปเกรดได้ที่แคมป์หรือโรงงานเท่านั้น");
        if (p.bagLevel + 1 >= this.config.bagCapacities.length) fail("กระเป๋าระดับสูงสุดแล้ว");
        if (p.inventory.rope < 2 || p.inventory.metal < 2 || p.inventory.parts < 1) fail("ต้องใช้เชือก 2 โลหะ 2 ชิ้นส่วน 1");
        p.inventory.rope -= 2; p.inventory.metal -= 2; p.inventory.parts--; p.bagLevel++; break;
      }
      case "island:drop": {
        const r = this.resource(a.resource), q = this.quantity(a.quantity); this.spend(p, r, q);
        this.drop(p.location, { ...emptyInventory(), [r]: q }); this.log(`${p.username} วางของที่${NAMES[p.location]}`, this.phase === "NIGHT"); break;
      }
      case "island:pickup": {
        const d = this.drops.find(d => d.id === a.id && d.location === p.location && d.expiresDay > this.day);
        const r = this.resource(a.resource), q = this.quantity(a.quantity);
        if (!d || d.items[r] < q) fail("ของไม่อยู่ที่นี่ หมดอายุ หรือถูกเก็บแล้ว");
        this.checkCapacity(p, q); d!.items[r] -= q; p.inventory[r] += q; break;
      }
      case "island:mission": {
        const m = this.missions.find(m => m.id === a.id); const q = this.quantity(a.quantity);
        if (!m || m.location !== p.location || q > m.quantity - m.progress) fail("ต้องอยู่ที่ภารกิจและส่งจำนวนที่ยังขาด");
        this.spend(p, m!.resource, q); m!.progress += q;
        this.log(`${p.username} ส่ง${NAMES[m!.resource]} ${q} ให้ภารกิจ`); this.maybeEscape(); break;
      }
      case "island:nest": {
        const nest = this.nests.find(n => n.id === a.id && n.location === p.location && n.hp > 0);
        if (!nest) fail("ไม่พบรังที่ตำแหน่งนี้"); this.energy(p, 15); nest!.hp = Math.max(0, nest!.hp - 20);
        if (nest!.hp === 0) this.log(`${p.username} ทำลายรังมอนสเตอร์ที่${NAMES[p.location]} ลดภัยในพื้นที่แล้ว`); break;
      }
      case "island:encounter": this.handleEncounter(p, a); break;
      default: fail("ไม่รองรับคำสั่งนี้");
    }
    this.changed();
  }
  private capacity(p: Survivor) { return this.config.bagCapacities[p.bagLevel]; }
  private used(p: Survivor) { return Object.values(p.inventory).reduce((a, b) => a + b, 0); }
  private checkCapacity(p: Survivor, change: number) { if (this.used(p) + change > this.capacity(p)) fail("กระเป๋าเต็ม วางของหรืออัปเกรดก่อน"); }
  private drop(location: Location, items: Inventory, hiddenUntilMorning = false) {
    if (Object.values(items).some(n => n > 0)) this.drops.push({ id: randomUUID(), location, items, expiresDay: this.day + this.config.dropLifetimeDays, hiddenUntilMorning });
  }
  private rollLoot(location: Location): Resource {
    const entries = Object.entries(WORLD[location].loot); let roll = randomInt(entries.reduce((sum, [, weight]) => sum + weight, 0));
    for (const [r, weight] of entries) { roll -= weight; if (roll < 0) return r as Resource; }
    return "water";
  }
  private threat() { return Math.min(this.config.maxThreat, 1 + (this.day - 1) * this.config.threatPerDay); }
  private spawnMonsters() {
    const threat = this.threat(); this.monsters = []; this.encounter.clear();
    for (let type = 0; type < MONSTER_TYPES.length; type++) {
      const def = MONSTER_TYPES[type];
      const nestActive = this.nests.some(n => n.hp > 0 && def.homes.includes(n.location));
      const count = Math.min(4, Math.ceil(threat * this.config.spawnMultiplier) + (nestActive ? 1 : 0));
      for (let i = 0; i < count; i++) {
        const hp = Math.round(def.hp * threat);
        this.monsters.push({ id: randomUUID(), type, location: def.homes[randomInt(def.homes.length)] as Location, hp, maxHp: hp, damage: Math.round(def.damage * threat), detectionRange: threat >= 1.6 ? 1 : 0, detection: Math.min(.85, def.detection * threat), aggression: def.aggression, nextMoveAt: Date.now() + 30_000 / threat });
      }
    }
  }
  private detect(p: Survivor) {
    if (!p.alive || this.encounter.has(p.userId) || (this.avoided.get(p.userId) ?? 0) > Date.now()) return;
    const monster = this.monsters.find(m => m.hp > 0 && m.location === p.location);
    if (!monster) return;
    const group = this.living().filter(t => t.location === p.location).length;
    if (randomInt(100) < monster.detection * (this.phase === "NIGHT" ? 140 : 100) / Math.sqrt(group)) this.encounter.set(p.userId, monster.id);
  }
  private worldTick() {
    if (this.finished || !["DAY", "NIGHT", "ESCAPE"].includes(this.phase)) return;
    for (const m of this.monsters) if (m.hp > 0 && Date.now() >= m.nextMoveAt) {
      const choices = neighbours(m.location).filter(n => MONSTER_TYPES[m.type].homes.includes(n.location));
      const occupied = m.detectionRange > 0 ? choices.find(n => this.living().some(p => p.location === n.location)) : undefined;
      if (choices.length) m.location = occupied?.location ?? choices[randomInt(choices.length)].location;
      m.nextMoveAt = Date.now() + Math.max(10_000, 40_000 / this.threat());
    }
    for (const p of this.living()) {
      if (p.escape === "BOARD") continue;
      p.hunger = Math.max(0, p.hunger - 1); p.thirst = Math.max(0, p.thirst - 2);
      if (p.hunger <= 10 || p.thirst <= 10) p.health -= 2;
      const encounter = this.monsters.find(m => m.id === this.encounter.get(p.userId) && m.hp > 0 && m.location === p.location);
      if (!encounter) this.encounter.delete(p.userId);
      else if (randomInt(100) < encounter.aggression * 100) p.health -= encounter.damage;
      this.detect(p);
    }
    this.checkDeaths();
  }
  private handleEncounter(p: Survivor, a: Record<string, unknown>) {
    const m = this.monsters.find(m => m.id === this.encounter.get(p.userId) && m.hp > 0 && m.location === p.location);
    if (!m) fail("ไม่มีมอนสเตอร์เผชิญหน้าคุณ");
    const monster = m!; const group = this.living().filter(t => t.location === p.location).length;
    let passed = false;
    if (a.choice === "SNEAK") { this.energy(p, 15); passed = randomInt(100) < Math.min(90, 55 + group * 10); if (!passed) p.health -= monster.damage; }
    else if (a.choice === "DISTRACT") { this.spend(p, "food", 1); passed = true; }
    else if (a.choice === "TORCH") { this.spend(p, "torch", 1); passed = monster.type !== 3; if (!passed) p.evidence.push("อสูรแมกมาไม่กลัวไฟ"); }
    else if (a.choice === "FIGHT") { this.energy(p, 15); monster.hp = Math.max(0, monster.hp - 20 - group * 5); if (monster.hp > 0) p.health -= monster.damage; else { passed = true; this.log(`กลุ่มผู้เล่นปราบ${MONSTER_TYPES[monster.type].name}ที่${NAMES[p.location]}`); } }
    else fail("เลือกหลบ ยั่วด้วยอาหาร ใช้คบไฟ หรือต่อสู้");
    if (passed) { this.encounter.delete(p.userId); this.avoided.set(p.userId, Date.now() + 45_000); }
    this.checkDeaths();
  }
  private spyAction(p: Survivor, type: string, a: Record<string, unknown>) {
    if (this.phase !== "NIGHT" || p.role !== "spy" || p.nightUsed) fail("Spy ลงมือได้ 1 ครั้งต่อคืนเท่านั้น");
    if (this.encounter.has(p.userId)) fail("ต้องรับมือมอนสเตอร์ก่อน");
    if (type === "island:sabotage") {
      if (p.location !== "beach") fail("ต้องอยู่ที่เรือบนชายหาด");
      if (!member(Object.keys(BOAT_COST), a.component) || this.boat[a.component as Component] < 1) fail("เลือกส่วนเรือที่สร้างแล้ว");
      this.boat[a.component as Component] = Math.max(0, this.boat[a.component as Component] - 2); p.sabotages++;
      this.log("เรือถูกก่อวินาศกรรมในคืนนี้ ผู้ลงมือยังเป็นปริศนา");
      this.log(`${p.username} ทำลายส่วน${NAMES[a.component as string]}ของเรือ`, true);
    } else {
      const target = this.target(a.target, p.userId);
      if (target.location !== p.location) fail("เป้าหมายต้องอยู่ที่เดียวกัน");
      for (const observer of this.living()) if (observer.userId !== p.userId && observer.userId !== target.userId) {
        const close = observer.location === p.location, adjacent = neighbours(observer.location).some(n => n.location === p.location);
        observer.evidence.push(`คืนวันที่ ${this.day}: ${close ? "🚨 มีผู้เล่นถูกฆ่าใกล้ตัวคุณ! 👁️ คุณเห็นเงาคนลงมือ แต่ระบุตัวไม่ได้" : adjacent ? "🚨 มีผู้เล่นถูกฆ่าในบริเวณใกล้เคียง" : "⚠️ มีผู้เล่นถูกฆ่าที่ใดที่หนึ่งบนเกาะ"}`);
      }
      this.log(`${p.username} ลอบฆ่า ${target.username} ที่${NAMES[p.location]}`, true);
      this.kill(target, true);
    }
    p.nightUsed = true;
    if (!this.living().length) this.end();
  }
  private castVote(p: Survivor, a: Record<string, unknown>) {
    if (this.phase !== "VOTE" || this.votes.has(p.userId)) fail("โหวตได้ 1 ครั้งในช่วงโหวต");
    const t = this.target(a.target, p.userId); this.votes.set(p.userId, t.userId);
    if (this.living(true).every(p => this.votes.has(p.userId))) this.resolveVote();
  }
  private resolveVote() {
    const counts: Record<string, number> = {};
    for (const [id, target] of this.votes) if (this.survivors.get(id)?.alive && this.survivors.get(target)?.alive) counts[target] = (counts[target] ?? 0) + 1;
    const top = Math.max(0, ...Object.values(counts)); const leaders = Object.keys(counts).filter(id => counts[id] === top);
    const tied = leaders.length > 1;
    this.voteResult = { counts, eliminated: null, tied };
    if (tied && this.config.tieRule === "revote" && !this.revoted) {
      this.revoted = true; this.votes.clear(); this.log("คะแนนเสมอ เปิดลงคะแนนใหม่อีก 1 ครั้ง"); this.schedule("VOTE", this.config.voteSeconds * 1000); return;
    }
    const eliminated = leaders.length === 1 ? leaders[0] : tied && this.config.tieRule === "random" ? leaders[randomInt(leaders.length)] : null;
    if (eliminated) {
      const p = this.survivors.get(eliminated)!; this.kill(p, false); this.voteResult.eliminated = eliminated;
      this.log(`${p.username} ถูกโหวตออกจากเกม`);
      if (this.config.revealEliminatedRoles) { p.eliminatedRole = p.role; this.voteResult.role = p.role; this.log(`บทบาทของ ${p.username}: ${p.role === "spy" ? "Spy" : "Survivor"}`); }
    } else this.log("ไม่มีผู้เล่นถูกกำจัดในรอบโหวตนี้");
    // Eliminating the last spy is deliberately NOT a victory condition.
    if (!this.living().length) this.end(); else this.schedule("VOTE_RESULT", 5000);
  }
  private maybeEscape() {
    if (this.phase !== "DAY") return;
    if (this.missions.every(m => m.progress >= m.quantity) && Object.keys(BOAT_COST).every(k => this.boat[k as Component] >= BOAT_COST[k as Component])) {
      this.expireRequests(); this.log("ภารกิจและเรือพร้อมแล้ว เดินทางตามเส้นทางไปชายหาดเพื่อขึ้นเรือ"); this.schedule("ESCAPE", this.config.escapeSeconds * 1000);
    }
  }
  private runEvent() {
    this.weather = ["พายุ", "งูกัด", "ไฟไหม้", "น้ำขึ้นสูง", "เถ้าภูเขาไฟ"][randomInt(5)];
    this.log(`เหตุการณ์: ${this.weather}`);
    for (const p of this.living()) {
      if (this.weather === "พายุ") { p.health -= 5; p.energy = Math.max(0, p.energy - 1); }
      if (this.weather === "งูกัด" && p.location === "jungle") p.health -= 15;
      if (this.weather === "ไฟไหม้" && p.location === "camp") { p.inventory.food = Math.max(0, p.inventory.food - 1); p.health -= 5; }
      if (this.weather === "น้ำขึ้นสูง" && ["beach", "shipwreck"].includes(p.location)) p.health -= 10;
      if (this.weather === "เถ้าภูเขาไฟ") p.health -= p.location === "volcano" ? 25 : 5;
    }
  }
  private survive() {
    this.log("ทุกคนใช้อาหารและน้ำอย่างละ 1 โดยอัตโนมัติ ของไม่พอจะลดความอิ่มและน้ำในร่างกาย");
    for (const p of this.living()) {
      if (p.inventory.food > 0) { p.inventory.food--; p.hunger = Math.min(100, p.hunger + 10); } else p.hunger = Math.max(0, p.hunger - 30);
      if (p.inventory.water > 0) { p.inventory.water--; p.thirst = Math.min(100, p.thirst + 10); } else p.thirst = Math.max(0, p.thirst - 35);
      if (p.hunger === 0) p.health -= 20;
      if (p.thirst === 0) p.health -= 30;
    }
    this.checkDeaths();
  }
  private chooseEscape(p: Survivor, a: Record<string, unknown>) {
    if (this.phase !== "ESCAPE") fail("ยังไม่ถึงเวลาหนี");
    if (p.location !== "beach" || this.encounter.has(p.userId)) fail("ต้องอยู่ที่ชายหาดและไม่มีมอนสเตอร์ขวางจึงขึ้นเรือได้");
    if (!member(["BOARD", "STAY", "RESCUE"] as const, a.choice)) fail("เลือกขึ้นเรือ อยู่ต่อ หรือช่วยขึ้นเรือ");
    if (a.choice === "RESCUE") {
      if (p.escape !== "BOARD") fail("ต้องขึ้นเรือก่อนจึงจะช่วยคนอื่นได้");
      const t = this.target(a.target, p.userId);
      if (t.escape || t.location !== "beach") fail("เป้าหมายต้องอยู่ที่ชายหาดและยังไม่เลือก");
      if (this.seatOrder.length >= this.seats) fail("เรือเต็มแล้ว");
      this.spend(p, "rope", 1); t.escape = "BOARD"; this.seatOrder.push(t.userId);
      if (!p.helped.includes(t.userId)) p.helped.push(t.userId);
      this.log(`${p.username} ใช้เชือกช่วย ${t.username} ขึ้นเรือ`);
    } else {
      if (p.escape) fail("คุณเลือกแล้ว");
      if (a.choice === "BOARD" && this.seatOrder.length >= this.seats) fail("เรือเต็มแล้ว");
      p.escape = a.choice as "BOARD" | "STAY";
      if (p.escape === "BOARD") this.seatOrder.push(p.userId);
      this.log(`${p.username} ${p.escape === "BOARD" ? "ขึ้นเรือแล้ว" : "เลือกอยู่บนเกาะ"}`);
    }
    if (this.living().every(p => p.escape)) this.finishEscape();
  }
  private finishEscape() {
    for (const p of this.living()) p.escaped = p.escape === "BOARD" && p.location === "beach";
    this.log("เรือออกจากเกาะ ผู้ที่ไม่เลือกภายในเวลาถือว่าอยู่ต่อ"); this.end();
  }
  removePlayer(userId: string): void {
    const p = this.survivors.get(userId); if (!p || this.finished) return;
    p.connected = false; // Keep a locked decision immutable if this player reconnects during the same night.
    this.offers.filter(o => o.from === userId || o.to === userId).forEach(o => { if (o.status === "pending") o.status = "expired"; });
    if (this.phase === "VOTE" && this.living(true).every(p => this.votes.has(p.userId))) this.resolveVote();

    this.changed();
  }
  reconnectPlayer(userId: string): void { const p = this.survivors.get(userId); if (!p) fail("คุณไม่ได้อยู่ในเกมนี้"); p!.connected = true; this.changed(); }
  getPublicState() {
    return clone({ phase: this.phase, day: this.day, phaseEndsAt: this.phaseEndsAt, weather: this.weather,
      players: [...this.survivors.values()].map(p => ({ userId: p.userId, username: p.username, alive: this.hiddenDeaths.has(p.userId) ? true : p.alive, connected: p.connected, location: this.phase === "NIGHT" ? p.nightLocation : p.location, escape: p.escape, ...(p.eliminatedRole ? { revealedRole: p.eliminatedRole } : {}) })),
      world: WORLD, routes: ROUTES.map(r => ({ ...r, cost: Math.ceil(r.cost * this.config.movementMultiplier) })),
      drops: this.drops.filter(d => !d.hiddenUntilMorning && d.expiresDay > this.day), monsters: this.monsters.map(m => ({ ...m, name: MONSTER_TYPES[m.type].name })), nests: this.nests, missions: this.missions,
      voteResult: this.voteResult, votedUserIds: [...this.votes.keys()],
      rules: { maxDays: this.config.maxDays, cycleSeconds: this.config.cycleSeconds, tieRule: this.config.tieRule, spyVictory: this.config.spyVictory, survivorEscape: this.config.survivorEscape, minimumEscape: this.config.minimumEscape },
      boat: this.boat, boatCost: BOAT_COST, seats: this.seats, occupiedSeats: this.seatOrder.length,
      ground: this.ground, logs: this.logs.slice(-100), chat: this.chat, requests: this.requests.slice(-60),
      ...(this.finished ? { result: this.result } : {}),
    });
  }
  getPrivateState(userId: string) {
    const p = this.survivors.get(userId); if (!p) return null;
    return clone({ role: p.role, myLocation: p.location, alive: p.alive, nightUsed: p.nightUsed, capacity: this.capacity(p), bagLevel: p.bagLevel + 1, nextCapacity: this.config.bagCapacities[p.bagLevel + 1] ?? null,
      usedCapacity: this.used(p), restAt: p.restAt, votedFor: this.votes.get(userId) ?? null,
      encounter: this.monsters.find(m => m.id === this.encounter.get(userId)) ?? null,
      localDrops: this.drops.filter(d => d.location === p.location && d.expiresDay > this.day),
      nearbyPlayers: this.living(true).filter(t => t.location === p.location && t.userId !== userId).map(t => ({ userId: t.userId, username: t.username })),
      allies: p.role === "spy" && this.config.spiesKnowEachOther ? [...this.survivors.values()].filter(t => t.role === "spy" && t.userId !== userId).map(t => ({ userId: t.userId, username: t.username })) : [],
      health: p.health, energy: p.energy, hunger: p.hunger, thirst: p.thirst, inventory: p.inventory,
      objective: OBJECTIVES[p.objective], evidence: p.evidence.slice(-60),
      offers: this.offers.filter(o => o.from === userId || o.to === userId).slice(-30),
    });
  }
  end(): GameResult {
    if (this.result) return clone(this.result);
    this.finished = true; this.phase = "FINISHED"; this.phaseEndsAt = null;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    if (this.worldTimer) clearInterval(this.worldTimer); this.worldTimer = null;
    this.hiddenDeaths.clear();
    const players = [...this.survivors.values()].map(p => {
      const completed = [p.escaped && p.inventory.valuable >= 2, p.helped.length >= 3, p.contributed === 0, p.sabotages >= 2][p.objective];
      return { userId: p.userId, username: p.username, role: p.role, alive: p.alive, escaped: p.escaped, objective: OBJECTIVES[p.objective], completed };
    });
    const survivors = players.filter(p => p.role === "survivor");
    const escaped = survivors.filter(p => p.escaped).length;
    const required = this.config.survivorEscape === "all" ? Math.max(1, survivors.filter(p => p.alive).length) : this.config.survivorEscape === "minimum" ? this.config.minimumEscape : 1;
    const survivorWin = escaped >= required;
    const spyWin = this.config.spyVictory === "survive_to_end" ? players.some(p => p.role === "spy" && p.alive) : !survivorWin;
    this.result = { summary: `Island Betrayal จบวันที่ ${this.day} · หนีสำเร็จ ${players.filter(p => p.escaped).length} คน`,
      winnerUserIds: players.filter(p => p.role === "spy" ? spyWin : survivorWin && p.escaped).map(p => p.userId),
      details: { survivorWin, spyWin, missions: this.missions, players, timeline: this.truth, scores: Object.fromEntries(players.map(p => [p.userId, (p.escaped ? 1 : 0) + (p.completed ? 1 : 0)])) },
    };
    this.changed(); this.emit(GAME_ENGINE_EVENTS.ENDED); return clone(this.result);
  }
}
