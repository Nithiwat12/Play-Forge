import { randomInt, randomUUID } from "crypto";
import { BaseGame } from "../core/BaseGame";
import { GameActionError, GAME_ENGINE_EVENTS, type GameResult } from "../core/types";

export const RESOURCES = ["wood", "metal", "rope", "food", "water", "medicine", "parts", "valuable"] as const;
export type Resource = typeof RESOURCES[number];
export const LOCATIONS = ["camp", "jungle", "mountain", "shipwreck", "village", "beach", "volcano"] as const;
type Location = typeof LOCATIONS[number];
type Phase = "DAY_START" | "ACTION" | "SECRET" | "EVENT" | "SURVIVAL" | "ESCAPE" | "FINISHED";
type Inventory = Record<Resource, number>;
export const BOAT_COST = { wood: 6, metal: 4, rope: 3, parts: 2 };
type Component = keyof typeof BOAT_COST;
const LOOT: Record<Location, Resource[]> = {
  camp: ["water", "food"], jungle: ["wood", "food", "rope"], mountain: ["metal", "parts", "valuable"],
  shipwreck: ["metal", "parts", "medicine", "rope"], village: ["food", "water", "medicine"],
  beach: ["wood", "rope", "water"], volcano: ["valuable", "metal", "parts"],
};
const OBJECTIVES = ["หนีออกจากเกาะพร้อมของมีค่าอย่างน้อย 2 ชิ้น", "ช่วยผู้เล่นที่แตกต่างกันอย่างน้อย 3 คน", "ไม่บริจาคทรัพยากรให้เรือเลย", "ก่อวินาศกรรมเรือสำเร็จอย่างน้อย 2 ครั้ง"];
const NAMES: Record<string, string> = { camp: "แคมป์", jungle: "ป่า", mountain: "ภูเขา", shipwreck: "ซากเรือ", village: "หมู่บ้าน", beach: "ชายหาด", volcano: "ภูเขาไฟ", wood: "ไม้", metal: "โลหะ", rope: "เชือก", food: "อาหาร", water: "น้ำ", medicine: "ยา", parts: "ชิ้นส่วน", valuable: "ของมีค่า" };
interface Secret { kind: "HELP" | "INVESTIGATE" | "STEAL" | "SABOTAGE" | "SKIP"; target?: string; resource?: Resource; component?: Component }
interface Survivor {
  userId: string; username: string; connected: boolean; alive: boolean; location: Location;
  health: number; energy: number; hunger: number; thirst: number; inventory: Inventory;
  objective: number; helped: string[]; contributed: number; sabotages: number;
  secret: Secret | null; evidence: string[]; escape: "BOARD" | "STAY" | null; escaped: boolean;
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
    if (this.players.size < 4 || this.players.size > 8) fail("Island Betrayal ต้องมีผู้เล่น 4–8 คน");
    this.started = true;
    this.seats = Math.min(this.players.size, 5);
    for (const p of this.players.values()) this.survivors.set(p.userId, {
      ...p, connected: true, alive: true, location: "camp", health: 100, energy: 10, hunger: 100, thirst: 100,
      inventory: { ...emptyInventory(), food: 2, water: 2 }, objective: randomInt(OBJECTIVES.length),
      helped: [], contributed: 0, sabotages: 0, secret: null, evidence: [], escape: null, escaped: false,
    });
    this.log("ทุกคนติดอยู่บนเกาะ ไม่มีบทบาทคนทรยศตายตัว จงเลือกว่าจะไว้ใจใคร");
    this.beginDay();
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
    if (!this.living().length || this.day > 10) { this.log("เกาะถูกกลืนโดยภูเขาไฟ การเดินทางสิ้นสุดแล้ว"); this.end(); return; }
    for (const p of this.living()) { p.energy = Math.max(0, 10 - (this.weather === "พายุ" ? 1 : 0)); p.secret = null; }
    this.log(`เริ่มวันที่ ${this.day} · คืนวันที่ 10 เป็นคืนสุดท้ายก่อนภูเขาไฟระเบิด`);
    this.schedule("DAY_START", 2000);
  }
  private expireRequests() {
    this.offers.forEach(o => { if (o.status === "pending") o.status = "expired"; });
    this.requests.forEach(r => { if (r.status === "open") r.status = "expired"; });
  }
  private advancePhase() {
    if (this.finished) return;
    switch (this.phase) {
      case "DAY_START": this.schedule("ACTION", 300_000); break;
      case "ACTION": this.expireRequests(); this.schedule("SECRET", 30_000); if (!this.living(true).length) this.resolveSecrets(); break;
      case "SECRET": this.resolveSecrets(); break;
      case "EVENT": this.survive(); if (!this.finished) this.schedule("SURVIVAL", 3000); break;
      case "SURVIVAL":
        if (this.day >= 10) { this.log("ภูเขาไฟระเบิดหลังคืนวันที่ 10 การเดินทางสิ้นสุดแล้ว"); this.end(); }
        else { this.day++; this.beginDay(); }
        break;
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
    if (resource === "water") p.thirst = Math.min(100, p.thirst + 35);
  }
  private help(p: Survivor, t: Survivor, r: Resource, secret: boolean) {
    this.spend(p, r, 1); this.heal(t, r);
    if (!p.helped.includes(t.userId)) p.helped.push(t.userId);
    this.log(`${p.username} ช่วย ${t.username} ด้วย${NAMES[r]}`, secret);
    if (secret) t.evidence.push(`คืนวันที่ ${this.day}: มีคนช่วยคุณด้วย${NAMES[r]}`);
  }
  private checkDeaths() {
    for (const p of this.living()) if (p.health <= 0) {
      p.health = 0; p.alive = false; p.secret = null;
      this.log(`${p.username} เสียชีวิต และเข้าสู่โหมดผู้ชม`);
      this.offers.filter(o => o.from === p.userId || o.to === p.userId).forEach(o => { if (o.status === "pending") o.status = "expired"; });
      this.requests.filter(r => r.from === p.userId && r.status === "open").forEach(r => r.status = "expired");
    }
    if (!this.living().length) this.end();
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
    if (actionType === "island:secret") { this.lockSecret(p, a); this.changed(); return; }
    if (actionType === "island:escape") { this.chooseEscape(p, a); this.changed(); return; }
    if (this.phase !== "ACTION") fail("ทำรายการนี้ได้เฉพาะช่วงกลางวัน");
    switch (actionType) {
      case "island:warning": {
        if (typeof a.text !== "string" || !a.text.trim() || a.text.length > 300) fail("คำเตือนต้องยาว 1–300 ตัวอักษร");
        if (Date.now() - (this.chatAt.get(userId) ?? 0) < 1000) fail("กรุณารอสักครู่ก่อนส่งคำเตือนใหม่");
        this.chatAt.set(userId, Date.now());
        this.log(`⚠ ${p.username} เตือนจาก${NAMES[p.location]}: ${(a.text as string).trim()}`); break;
      }
      case "island:move": {
        if (!member(LOCATIONS, a.location) || a.location === p.location) fail("เลือกสถานที่อื่นบนเกาะ");
        this.energy(p, 1); p.location = a.location as Location;
        this.log(`${p.username} เดินทางไป${NAMES[p.location]}`); break;
      }
      case "island:explore": {
        this.energy(p, 2);
        const pool = LOOT[p.location]; const r = pool[randomInt(pool.length)];
        const count = 1 + randomInt(3); this.ground[p.location][r] += count;
        this.log(`${p.username} พบ${NAMES[r]} ${count} ที่${NAMES[p.location]} (กดเก็บเพื่อใส่กระเป๋า)`);
        if (randomInt(100) < (p.location === "volcano" ? 40 : 15)) { p.health -= 15; this.log(`${p.username} บาดเจ็บจากการสำรวจ −15 สุขภาพ`); }
        this.checkDeaths(); break;
      }
      case "island:collect": {
        const r = this.resource(a.resource), q = this.quantity(a.quantity);
        if (this.ground[p.location][r] < q) fail("ของที่จุดนี้ไม่พอ หรือมีคนเก็บไปแล้ว");
        this.ground[p.location][r] -= q; p.inventory[r] += q;
        this.log(`${p.username} เก็บ${NAMES[r]} ${q}`); break;
      }
      case "island:use": {
        const r = this.resource(a.resource); if (!["food", "water", "medicine"].includes(r)) fail("ใช้ได้เฉพาะอาหาร น้ำ หรือยา");
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
        if (Object.keys(BOAT_COST).every(k => this.boat[k as Component] >= BOAT_COST[k as Component])) {
          this.expireRequests(); this.log(`เรือพร้อมออกเดินทาง! มี ${this.seats} ที่นั่ง ใครขึ้นก่อนมีสิทธิ์ก่อน`); this.schedule("ESCAPE", 45_000);
        }
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
        else { this.spend(p, req.resource, req.quantity); t.inventory[req.resource] += req.quantity; this.log(`${p.username} ส่ง${NAMES[req.resource]} ${req.quantity} ให้ ${t.username}`); }
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
        t.inventory[offer.give.resource] -= offer.give.quantity; p.inventory[offer.give.resource] += offer.give.quantity;
        p.inventory[offer.want.resource] -= offer.want.quantity; t.inventory[offer.want.resource] += offer.want.quantity;
        offer.status = "accepted"; this.log(`${p.username} แลกของกับ ${t.username}`); break;
      }
      default: fail("ไม่รองรับคำสั่งนี้");
    }
    this.changed();
  }
  private lockSecret(p: Survivor, a: Record<string, unknown>) {
    if (this.phase !== "SECRET" || p.secret) fail("ล็อกแอ็กชันลับได้ครั้งเดียวในช่วงกลางคืน");
    if (!member(["HELP", "INVESTIGATE", "STEAL", "SABOTAGE", "SKIP"] as const, a.kind)) fail("แอ็กชันลับไม่ถูกต้อง");
    const s: Secret = { kind: a.kind as Secret["kind"] };
    if (s.kind === "STEAL" || s.kind === "HELP") s.target = this.target(a.target, p.userId).userId;
    if (s.kind === "HELP") { s.resource = this.resource(a.resource); if (!["food", "water", "medicine"].includes(s.resource) || p.inventory[s.resource] < 1) fail("ต้องมีอาหาร น้ำ หรือยาเพื่อช่วย"); }
    if (s.kind === "SABOTAGE") { if (!member(Object.keys(BOAT_COST), a.component)) fail("เลือกส่วนของเรือ"); s.component = a.component as Component; }
    if (s.kind === "INVESTIGATE") {
      if (a.target !== "boat" && a.target !== "event" && !member(LOCATIONS, a.target)) this.target(a.target, p.userId);
      s.target = a.target as string;
    }
    p.secret = s;
    if (this.living(true).every(p => p.secret)) this.resolveSecrets();
  }
  private resolveSecrets() {
    // Shuffle avoids permanent roster-order advantage. Snapshot intentions before any effects.
    const actions = this.living(true).map(p => ({ p, s: p.secret ?? { kind: "SKIP" } as Secret }));
    for (let i = actions.length - 1; i > 0; i--) { const j = randomInt(i + 1); [actions[i], actions[j]] = [actions[j], actions[i]]; }
    for (const { p, s } of actions.filter(a => a.s.kind !== "INVESTIGATE")) {
      const t = s.target ? this.survivors.get(s.target) : undefined;
      if (s.kind === "STEAL" && t?.alive) {
        const items = RESOURCES.filter(r => t.inventory[r] > 0);
        if (items.length) { const r = items[randomInt(items.length)]; t.inventory[r]--; p.inventory[r]++; t.evidence.push(`คืนวันที่ ${this.day}: ${NAMES[r]} หายไป 1`); p.evidence.push(`คืนวันที่ ${this.day}: ขโมย${NAMES[r]} 1 สำเร็จ`); this.log(`${p.username} ขโมย${NAMES[r]} 1 จาก ${t.username}`, true); this.log("มีคนขโมยของในคืนนี้"); }
        else p.evidence.push(`คืนวันที่ ${this.day}: ขโมยไม่สำเร็จ เป้าหมายไม่มีของ`);
      } else if (s.kind === "SABOTAGE" && s.component) {
        if (this.boat[s.component] > 0) { this.boat[s.component]--; p.sabotages++; this.log(`${p.username} ทำลายส่วน${NAMES[s.component]}ของเรือ`, true); this.log(`เรือเสียหาย ส่วน${NAMES[s.component]}ลดลง 1`); }
        else p.evidence.push(`คืนวันที่ ${this.day}: ส่วนเรือนี้ยังไม่มีความคืบหน้า จึงทำลายไม่สำเร็จ`);
      } else if (s.kind === "HELP" && t?.alive && s.resource) {
        if (p.inventory[s.resource] > 0) this.help(p, t, s.resource, true);
        else p.evidence.push(`คืนวันที่ ${this.day}: ช่วยไม่สำเร็จ ของที่เตรียมไว้หายไป`);
      } else this.log(`${p.username} ไม่ลงมือในคืนนี้`, true);
    }
    for (const { p, s } of actions.filter(a => a.s.kind === "INVESTIGATE")) {
      const target = actions.find(a => a.p.userId === s.target);
      const suspect = target ?? actions.find(a => a.s.kind === "SABOTAGE");
      const evidence = target
        ? `${target.p.username} ${["SABOTAGE", "STEAL"].includes(target.s.kind) ? "เคลื่อนไหวใกล้ทรัพย์สินของคนอื่น" : "ไม่พบร่องรอยผิดปกติชัดเจน"}`
        : s.target === "event" ? `สภาพเกาะก่อนเหตุการณ์: ${this.weather}`
        : s.target === "boat" ? (suspect ? "พบรอยเครื่องมือใหม่ใกล้เรือ" : "ไม่พบรอยเครื่องมือใหม่ใกล้เรือ")
        : `มีคนอยู่ที่${NAMES[s.target!]} ${this.living().filter(p => p.location === s.target).length} คน`;
      p.evidence.push(`คืนวันที่ ${this.day}: ${evidence} · ความเชื่อมั่นปานกลาง (ไม่ใช่หลักฐานยืนยันผู้กระทำ)`);
      this.log(`${p.username} สืบสวน ${this.survivors.get(s.target!)?.username ?? NAMES[s.target!] ?? s.target}`, true);
    }
    this.runEvent(); this.checkDeaths(); if (!this.finished) this.schedule("EVENT", 3000);
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
    if (!member(["BOARD", "STAY", "RESCUE"] as const, a.choice)) fail("เลือกขึ้นเรือ อยู่ต่อ หรือช่วยขึ้นเรือ");
    if (a.choice === "RESCUE") {
      if (p.escape !== "BOARD") fail("ต้องขึ้นเรือก่อนจึงจะช่วยคนอื่นได้");
      const t = this.target(a.target, p.userId);
      if (t.escape) fail("เป้าหมายเลือกแล้ว");
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
    if (this.living(true).every(p => p.escape)) this.finishEscape();
  }
  private finishEscape() {
    for (const p of this.living()) p.escaped = p.escape === "BOARD";
    this.log("เรือออกจากเกาะ ผู้ที่ไม่เลือกภายในเวลาถือว่าอยู่ต่อ"); this.end();
  }
  removePlayer(userId: string): void {
    const p = this.survivors.get(userId); if (!p || this.finished) return;
    p.connected = false; // Keep a locked decision immutable if this player reconnects during the same night.
    this.offers.filter(o => o.from === userId || o.to === userId).forEach(o => { if (o.status === "pending") o.status = "expired"; });
    if (this.phase === "SECRET" && this.living(true).every(p => p.secret)) this.resolveSecrets();
    if (this.phase === "ESCAPE" && this.living(true).every(p => p.escape)) this.finishEscape();
    this.changed();
  }
  reconnectPlayer(userId: string): void { const p = this.survivors.get(userId); if (!p) fail("คุณไม่ได้อยู่ในเกมนี้"); p!.connected = true; this.changed(); }
  getPublicState() {
    return clone({ phase: this.phase, day: this.day, phaseEndsAt: this.phaseEndsAt, weather: this.weather,
      players: [...this.survivors.values()].map(({ userId, username, alive, connected, location, escape }) => ({ userId, username, alive, connected, location, escape })),
      boat: this.boat, boatCost: BOAT_COST, seats: this.seats, occupiedSeats: this.seatOrder.length,
      ground: this.ground, logs: this.logs.slice(-100), chat: this.chat, requests: this.requests.slice(-60),
      ...(this.finished ? { result: this.result } : {}),
    });
  }
  getPrivateState(userId: string) {
    const p = this.survivors.get(userId); if (!p) return null;
    return clone({ health: p.health, energy: p.energy, hunger: p.hunger, thirst: p.thirst, inventory: p.inventory,
      objective: OBJECTIVES[p.objective], secret: p.secret, evidence: p.evidence.slice(-60),
      offers: this.offers.filter(o => o.from === userId || o.to === userId).slice(-30),
    });
  }
  end(): GameResult {
    if (this.result) return clone(this.result);
    this.finished = true; this.phase = "FINISHED"; this.phaseEndsAt = null;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    const players = [...this.survivors.values()].map(p => {
      const completed = [p.escaped && p.inventory.valuable >= 2, p.helped.length >= 3, p.contributed === 0, p.sabotages >= 2][p.objective];
      return { userId: p.userId, username: p.username, alive: p.alive, escaped: p.escaped, objective: OBJECTIVES[p.objective], completed };
    });
    this.result = { summary: `Island Betrayal จบวันที่ ${this.day} · หนีสำเร็จ ${players.filter(p => p.escaped).length} คน`,
      winnerUserIds: players.filter(p => p.escaped).map(p => p.userId),
      details: { players, timeline: this.truth, scores: Object.fromEntries(players.map(p => [p.userId, (p.escaped ? 1 : 0) + (p.completed ? 1 : 0)])) },
    };
    this.changed(); this.emit(GAME_ENGINE_EVENTS.ENDED); return clone(this.result);
  }
}
