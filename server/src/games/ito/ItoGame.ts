import { randomInt, randomUUID } from "crypto";
import { BaseGame } from "../core/BaseGame";
import { GAME_ENGINE_EVENTS, GameActionError, type GameResult } from "../core/types";
import { itoConfigSchema, type ItoConfig } from "./config";
import { TOPICS } from "./topics";
import type { ItoCard, ItoPublic, ItoPrivate } from "./types";
const fail = (text: string): never => { throw new GameActionError(text); };
export class ItoGame extends BaseGame<ItoPublic, ItoPrivate | null> {
  readonly slug = "ito";
  private config: ItoConfig;
  private hands = new Map<string, ItoCard[]>();
  private disconnected = new Set<string>();
  private state: ItoPublic;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private won = false;
  private usedTopics = new Set<number>();
  constructor(roomId: string, settings?: { ito?: unknown }) {
    super(roomId);
    this.config = itoConfigSchema.parse(settings?.ito ?? {});
    this.state = { mode: this.config.mode, phase: "PLAY", round: 1, stages: this.config.stages, lives: 3, deadline: 0,
      topic: TOPICS[0], players: [], proposal: null, revealed: [], ready: [], log: [], summary: null };
  }
  start() {
    if (this.started || this.players.size < 2 || this.players.size > 8) fail("รองรับผู้เล่น 2–8 คน และเริ่มเกมได้ครั้งเดียว");
    this.started = true; this.deal();
  }
  private changed() { this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED); }
  private arm(seconds: number) {
    if (this.timer) clearTimeout(this.timer);
    this.state.deadline = Date.now() + seconds * 1000;
    this.timer = setTimeout(() => this.finish("หมดเวลารอหรือเวลาเล่น ทีมยังไม่ผ่านด่าน", false), seconds * 1000);
    this.timer.unref?.();
  }
  private deal() {
    const deck = Array.from({ length: 100 }, (_, i) => i + 1);
    for (let i = deck.length - 1; i > 0; i--) { const j = randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    for (const id of this.players.keys()) this.hands.set(id, Array.from({ length: this.state.round }, () => ({ id: randomUUID(), value: deck.pop()!, clue: "" })));
    const available = TOPICS.map((_, i) => i).filter(i => !this.usedTopics.has(i));
    const topicIndex = available[randomInt(available.length)]; this.usedTopics.add(topicIndex);
    this.state.topic = TOPICS[topicIndex]; this.state.revealed = []; this.state.proposal = null; this.state.ready = [];
    this.state.phase = "PLAY"; this.state.log = [`ด่าน ${this.state.round}: ไพ่คนละ ${this.state.round} ใบ`];
    this.arm(this.config.roundSeconds); this.changed();
  }
  handleAction(userId: string, type: string, raw: unknown) {
    if (!this.started || this.finished || !this.players.has(userId) || this.disconnected.has(userId)) fail("ไม่สามารถเล่นได้ในขณะนี้");
    if (Date.now() >= this.state.deadline) { this.finish("หมดเวลา", false); fail("หมดเวลาแล้ว"); }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("ข้อมูลไม่ถูกต้อง");
    const p = raw as Record<string, unknown>;
    if (type === "ito:ready") {
      if (this.state.phase !== "ROUND_END") fail("ยังไม่จบด่าน");
      if (!this.state.ready.includes(userId)) this.state.ready.push(userId);
      if (this.disconnected.size === 0 && this.state.ready.length === this.players.size) { this.state.round++; this.deal(); }
      else this.changed();
      return;
    }
    if (this.state.phase !== "PLAY") fail("รอเริ่มด่านถัดไป");
    if (type === "ito:clue") {
      if (this.state.proposal) fail("รอผลเสนอเปิดไพ่ก่อนแก้คำใบ้");
      const card = this.hands.get(userId)!.find(c => c.id === p.cardId);
      if (!card) fail("ไม่พบไพ่ของคุณ");
      if (typeof p.text !== "string" || !p.text.trim() || p.text.length > 160 || /[0-9๐-๙]/u.test(p.text)) fail("คำใบ้ต้องยาว 1–160 ตัวอักษร และไม่ใส่ตัวเลข");
      card!.clue = (p.text as string).trim();
    } else if (type === "ito:propose") {
      if (this.disconnected.size) fail("รอผู้เล่นกลับเข้าห้องก่อนเปิดไพ่");
      if (this.state.proposal) fail("มีไพ่รอยืนยันอยู่แล้ว");
      const card = this.hands.get(userId)!.find(c => c.id === p.cardId);
      if (!card) fail("เสนอได้เฉพาะไพ่ของตัวเอง");
      if (this.config.mode === "ONLINE" && [...this.hands.values()].some(h => h.some(c => !c.clue))) fail("ให้ทุกคนใส่คำใบ้ทุกใบก่อน");
      this.state.proposal = { id: randomUUID(), cardId: card!.id, userId, votes: [userId] };
    } else if (type === "ito:vote") {
      const proposal = this.state.proposal;
      if (!proposal || p.proposalId !== proposal.id || typeof p.accept !== "boolean") fail("ข้อเสนอนี้เปลี่ยนไปแล้ว");
      if (this.disconnected.size) fail("รอผู้เล่นกลับเข้าห้อง");
      if (proposal!.votes.includes(userId)) fail("คุณยืนยันแล้ว");
      if (!p.accept) { this.state.proposal = null; this.state.log.push("ยังไม่เปิดไพ่ ลองเทียบคำใบ้กันใหม่"); }
      else { proposal!.votes.push(userId); if (proposal!.votes.length === this.players.size) this.reveal(); }
    } else fail("ไม่รู้จักการกระทำนี้");
    this.state.log = this.state.log.slice(-60); this.changed();
  }
  private reveal() {
    const proposal = this.state.proposal!;
    const card = this.hands.get(proposal.userId)!.find(c => c.id === proposal.cardId)!;
    const missed = [...this.hands.entries()].flatMap(([id, hand]) => hand.filter(c => c.value < card.value).map(c => ({ ...c, userId: id })));
    this.state.proposal = null;
    for (const c of missed) { this.hands.set(c.userId, this.hands.get(c.userId)!.filter(x => x.id !== c.id)); this.state.revealed.push({ ...c, missed: true }); }
    this.hands.set(proposal.userId, this.hands.get(proposal.userId)!.filter(c => c.id !== card.id));
    this.state.revealed.push({ ...card, userId: proposal.userId, missed: false });
    if (missed.length) { this.state.lives--; this.state.log.push(`เปิด ${card.value} ข้ามไพ่ต่ำกว่า ${missed.length} ใบ: เสียหัวใจ 1 ดวง และนำไพ่ที่ข้ามออก`); }
    else this.state.log.push(`เปิด ${card.value} ถูกลำดับ`);
    if (this.state.lives === 0) { this.finish("หัวใจหมด ทีมแพ้แล้ว ลองใหม่ด้วยคำใบ้ที่เข้าใจกันมากขึ้น", false); return; }
    if ([...this.hands.values()].every(h => !h.length)) {
      if (this.state.round === this.config.stages) this.finish("ทีมผ่านครบทุกด่าน!", true);
      else { this.state.phase = "ROUND_END"; this.state.ready = []; this.arm(180); }
    }
  }
  removePlayer(id: string) {
    if (!this.started) { super.removePlayer(id); return; }
    if (!this.players.has(id) || this.finished) return;
    this.disconnected.add(id); this.state.proposal = null; this.state.ready = [];
    this.changed(); // Retain hidden cards; the existing deadline bounds a missing player.
  }
  reconnectPlayer(id: string) { super.reconnectPlayer(id); this.disconnected.delete(id); this.changed(); }
  private finish(summary: string, won: boolean) {
    if (this.finished) return;
    this.finished = true; this.won = won; this.state.phase = "FINISHED"; this.state.summary = summary; this.state.proposal = null;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    this.changed(); this.emit(GAME_ENGINE_EVENTS.ENDED);
  }
  getPublicState(): ItoPublic {
    return structuredClone({ ...this.state, players: this.getPlayers().map(p => ({ ...p, connected: !this.disconnected.has(p.userId), cards: (this.hands.get(p.userId) ?? []).map(c => ({ id: c.id, clue: c.clue })) })) });
  }
  getPrivateState(id: string): ItoPrivate | null { return this.players.has(id) ? { cards: structuredClone(this.hands.get(id) ?? []) } : null; }
  end(): GameResult {
    if (!this.finished) this.finish("เกมถูกยุติก่อนจบ", false);
    return { summary: this.state.summary!, winnerUserIds: this.won ? [...this.players.keys()] : [], details: { won: this.won, mode: this.config.mode, level: this.state.round, lives: this.state.lives, scores: Object.fromEntries([...this.players.keys()].map(id => [id, this.won ? this.state.round : 0])), reason: this.state.summary } };
  }
}
