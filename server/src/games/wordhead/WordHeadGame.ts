import { randomUUID } from "crypto";
import { BaseGame } from "../core/BaseGame";
import { GAME_ENGINE_EVENTS, GameActionError, type GameResult } from "../core/types";
import { getWordPool, type WordHeadWord } from "./words";
import {
  WORDHEAD_ACTIONS,
  type WordHeadConfig,
  type WordHeadLogEntry,
  type WordHeadPendingGuess,
  type WordHeadGuessVotes,
  type WordHeadPhase,
  type WordHeadPublicState,
  type WordHeadPrivateState,
  type WordHeadResult,
} from "./WordHeadState";
import {
  WORDHEAD_MIN_PLAYERS,
  WORDHEAD_MAX_PLAYERS,
  WORDHEAD_HINT_COOLDOWN_SECONDS,
  WORDHEAD_MAX_TEXT_LENGTH,
  validateHintPayload,
  validateGuessPayload,
  validateUpdateNotesPayload,
} from "./WordHeadRules";

export type { WordHeadConfig };

const MAX_LOG_ENTRIES = 200;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * WordHead ("ทายคำบนหัว") engine - hot-seat mode. One player at a time gets
 * a word only they can't see; everyone else can see it and help by pressing
 * a rate-limited "give a hint" button (text optional, so an in-person group
 * can just say hints out loud). The up player keeps guessing until they get
 * it right or gives up - a stopwatch measures how long they took, which
 * doubles as the whole scoring system (lower is better). Once every player
 * has had their turn, the round ends and shows everyone's times.
 */
export class WordHeadGame extends BaseGame<WordHeadPublicState, WordHeadPrivateState> {
  readonly slug = "wordhead";

  private config: WordHeadConfig;
  private wordCategory: string | null = null;
  private remainingWords: WordHeadWord[] = [];
  private fullWordPool: WordHeadWord[] = [];

  private turnOrder: string[] = [];
  private currentTurnIndex = -1;
  private currentTurnUserId: string | null = null;
  private currentWord: string | null = null;
  private turnStartedAt: number | null = null;
  // Set by GUESS or ANSWER; kept until all other players have voted.
  private pendingGuess: WordHeadPendingGuess | null = null;
  // One vote per non-guesser for the current attempt.
  private guessVotes: Map<string, "correct" | "wrong"> = new Map();

  private hasGone: Set<string> = new Set();
  private guessedCorrectly: Set<string> = new Set();
  private timeUsedByUserId: Map<string, number> = new Map();

  private hintCooldownUntilByUserId: Map<string, number> = new Map();
  private log: WordHeadLogEntry[] = [];
  private notesByUserId: Map<string, string> = new Map();
  private disconnected: Set<string> = new Set();

  private phase: WordHeadPhase = "TURN";
  private roundResult: WordHeadResult | null = null;

  constructor(roomId: string, config?: WordHeadConfig) {
    super(roomId);
    this.config = config ?? {};
  }

  start(): void {
    if (this.players.size < WORDHEAD_MIN_PLAYERS) {
      throw new Error(`ทายคำบนหัวต้องมีผู้เล่นอย่างน้อย ${WORDHEAD_MIN_PLAYERS} คน`);
    }
    if (this.players.size > WORDHEAD_MAX_PLAYERS) {
      throw new Error(`ทายคำบนหัวรองรับผู้เล่นได้สูงสุด ${WORDHEAD_MAX_PLAYERS} คน`);
    }

    const category = this.config.categoryMode === "FIXED" ? this.config.category : undefined;
    this.fullWordPool = getWordPool(category);
    this.wordCategory = category ?? null;
    this.remainingWords = shuffle(this.fullWordPool);

    this.turnOrder = shuffle(this.getPlayers().map((p) => p.userId));
    this.currentTurnIndex = -1;

    this.started = true;
    this.advanceTurn();
  }

  // Pops the next word off the shuffled pool (so a match doesn't repeat a
  // word until every word in the category has been used once); reshuffles
  // a fresh pool in the rare case a match somehow needs more words than the
  // category has (more turns than words only happens if this game grows a
  // "play again with the same players" loop that outlives one word pool).
  private nextWord(): string {
    if (this.remainingWords.length === 0) {
      this.remainingWords = shuffle(this.fullWordPool);
    }
    return this.remainingWords.pop()!.text;
  }

  // Players who leave mid-round keep their progress intact and stay in the
  // turn rotation (in case they reconnect) - just marked disconnected so
  // the client can show that, mirroring SpyfallGame's approach exactly.
  removePlayer(userId: string): void {
    if (!this.started) {
      super.removePlayer(userId);
      return;
    }
    this.disconnected.add(userId);
    this.guessVotes.delete(userId);
    if (this.finished) return;
    if (this.currentTurnUserId === userId) {
      this.pendingGuess = null;
      this.guessVotes.clear();
      this.finishTurn(userId, false);
      this.appendSystemLog(`${this.players.get(userId)?.username} ออกจากเกม ข้ามตาให้คนถัดไป`);
      this.advanceTurn();
    } else if (this.pendingGuess) {
      this.resolveGuessVotes();
    } else {
      this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
    }
  }

  reconnectPlayer(userId: string): void {
    super.reconnectPlayer(userId);
    if (this.disconnected.delete(userId)) this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  handleAction(userId: string, actionType: string, payload: unknown): void {
    if (!this.players.has(userId)) {
      throw new GameActionError("คุณไม่ได้อยู่ในเกมนี้");
    }
    if (this.finished) {
      throw new GameActionError("เกมนี้จบไปแล้ว");
    }

    switch (actionType) {
      case WORDHEAD_ACTIONS.HINT:
        this.handleHint(userId, validateHintPayload(payload));
        break;
      case WORDHEAD_ACTIONS.GUESS:
        this.handleGuess(userId, validateGuessPayload(payload).guessText);
        break;
      case WORDHEAD_ACTIONS.ANSWER:
        this.handleGuess(userId, "");
        break;
      case WORDHEAD_ACTIONS.MARK_CORRECT:
        this.handleGuessVote(userId, "correct", payload);
        break;
      case WORDHEAD_ACTIONS.MARK_WRONG:
        this.handleGuessVote(userId, "wrong", payload);
        break;
      case WORDHEAD_ACTIONS.PASS_TURN:
        this.handlePassTurn(userId);
        break;
      case WORDHEAD_ACTIONS.UPDATE_NOTES:
        this.handleUpdateNotes(userId, validateUpdateNotesPayload(payload).notes);
        break;
      default:
        throw new GameActionError(`ไม่รู้จักการกระทำนี้: ${actionType}`);
    }
  }

  // Anyone except the current up player can give a hint, any time, as often
  // as their own personal cooldown allows - there's no shared/global
  // cooldown, each player tracks their own.
  private handleHint(userId: string, payload: { hintText?: string | null }): void {
    if (this.phase !== "TURN" || !this.currentTurnUserId) {
      throw new GameActionError("ตอนนี้ยังไม่มีใครขึ้นเล่น");
    }
    if (userId === this.currentTurnUserId) {
      throw new GameActionError("คุณให้คำใบ้ตัวเองไม่ได้");
    }
    const cooldownUntil = this.hintCooldownUntilByUserId.get(userId);
    if (cooldownUntil && Date.now() < cooldownUntil) {
      throw new GameActionError("รอคูลดาวน์ก่อนถึงจะให้คำใบ้อีกครั้งได้");
    }

    this.hintCooldownUntilByUserId.set(userId, Date.now() + WORDHEAD_HINT_COOLDOWN_SECONDS * 1000);
    const hinter = this.players.get(userId)!;
    this.appendLog({
      id: randomUUID(),
      type: "hint",
      userId,
      username: hinter.username,
      text: payload.hintText ?? null,
      timestamp: Date.now(),
    });
  }

  // Submit a typed or spoken answer for a complete majority ballot.
  private handleGuess(userId: string, guessText: string): void {
    if (this.phase !== "TURN" || userId !== this.currentTurnUserId) {
      throw new GameActionError("ยังไม่ถึงตาคุณ");
    }
    if (!this.currentWord) {
      throw new GameActionError("ไม่พบคำของตานี้");
    }

    if (this.pendingGuess) throw new GameActionError("รอทุกคนโหวตคำตอบนี้ให้ครบก่อน");
    const guesser = this.players.get(userId)!;
    const text = guessText.slice(0, WORDHEAD_MAX_TEXT_LENGTH);

    // Each submitted answer opens a separate ballot for every other player.
    this.pendingGuess = { id: randomUUID(), text, submittedAt: Date.now() };
    this.guessVotes.clear();
    this.appendLog({
      id: randomUUID(),
      type: "guess",
      userId,
      username: guesser.username,
      text,
      timestamp: Date.now(),
    });
  }

  // All remaining connected players except the guesser must vote.
  private eligibleVoterIds(): string[] {
    return this.getPlayers().map((p) => p.userId).filter((id) => id !== this.currentTurnUserId && !this.disconnected.has(id));
  }

  private handleGuessVote(judgeUserId: string, vote: "correct" | "wrong", payload: unknown): void {
    if (this.phase !== "TURN" || !this.currentTurnUserId || !this.pendingGuess) {
      throw new GameActionError("ยังไม่มีคำตอบให้โหวต");
    }
    if (judgeUserId === this.currentTurnUserId) {
      throw new GameActionError("คุณกดยืนยันคำตอบตัวเองไม่ได้");
    }
    if (this.disconnected.has(judgeUserId)) throw new GameActionError("กรุณากลับเข้าห้องก่อนโหวต");
    if (!payload || typeof payload !== "object" ||
        (payload as { guessId?: unknown }).guessId !== this.pendingGuess.id) {
      throw new GameActionError("คำตอบนี้เปลี่ยนไปแล้ว กรุณาโหวตคำตอบล่าสุด");
    }
    if (this.guessVotes.has(judgeUserId)) throw new GameActionError("คุณโหวตคำตอบนี้แล้ว");
    this.guessVotes.set(judgeUserId, vote);
    this.resolveGuessVotes();
  }

  private resolveGuessVotes(): void {
    if (!this.pendingGuess || !this.currentTurnUserId || this.finished) return;
    const eligible = this.eligibleVoterIds();
    if (eligible.length === 0) {
      this.pendingGuess = null;
      this.guessVotes.clear();
      this.appendSystemLog("ไม่มีคนใบ้เหลืออยู่ รอผู้เล่นกลับมาหรือกดข้ามตาได้");
      return;
    }
    if (!eligible.every((id) => this.guessVotes.has(id))) {
      this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
      return;
    }

    const correct = eligible.filter((id) => this.guessVotes.get(id) === "correct").length;
    const wrong = eligible.length - correct;
    const guesser = this.players.get(this.currentTurnUserId)!;
    const word = this.currentWord;
    this.pendingGuess = null;
    this.guessVotes.clear();
    if (correct > wrong) {
      const elapsedSeconds = this.finishTurn(this.currentTurnUserId, true);
      this.appendSystemLog(`โหวตครบทุกคน: ถูก ${correct} / ไม่ถูก ${wrong} — ${guesser.username} ตอบถูก! คำคือ "${word}" (ใช้เวลา ${elapsedSeconds.toFixed(1)} วินาที)`);
      this.advanceTurn();
    } else {
      this.appendSystemLog(`โหวตครบทุกคน: ถูก ${correct} / ไม่ถูก ${wrong} — ${correct === wrong ? "คะแนนเสมอ" : "เสียงส่วนมากเห็นว่ายังไม่ถูก"} ${guesser.username} ทายใหม่ได้เลย!`);
    }
  }

  // Voluntary give-up: locks in however long they've spent so far as their
  // final time (same bucket as a correct guess, just flagged as not
  // guessed) rather than leaving the round to hang forever on one stuck
  // word. Exists purely as a safety valve - there's no forced turn timeout.
  private handlePassTurn(userId: string): void {
    if (this.phase !== "TURN" || userId !== this.currentTurnUserId) {
      throw new GameActionError("ยังไม่ถึงตาคุณ");
    }
    if (this.pendingGuess) throw new GameActionError("รอทุกคนโหวตคำตอบนี้ให้ครบก่อน");
    const passer = this.players.get(userId)!;
    const word = this.currentWord;
    this.pendingGuess = null;
    this.guessVotes.clear();
    const elapsedSeconds = this.finishTurn(userId, false);
    this.appendSystemLog(
      `${passer.username} ขอข้ามตา (คำคือ "${word}") - ใช้เวลา ${elapsedSeconds.toFixed(1)} วินาที`
    );
    this.advanceTurn();
  }

  // Shared bookkeeping for however a turn ends (correct guess or give-up) -
  // stops the stopwatch and records the result, but does NOT advance the
  // turn or emit itself, so callers can log their own message first.
  private finishTurn(userId: string, guessedCorrectly: boolean): number {
    const elapsedSeconds = this.turnStartedAt ? (Date.now() - this.turnStartedAt) / 1000 : 0;
    this.hasGone.add(userId);
    if (guessedCorrectly) this.guessedCorrectly.add(userId);
    this.timeUsedByUserId.set(userId, elapsedSeconds);
    return elapsedSeconds;
  }

  // Deliberately does NOT emit STATE_CHANGED - broadcasting a full state
  // push to the whole room every time one player types in their private
  // notes would be wasteful; the note-taker's own client already updates
  // optimistically, and the server copy exists purely so notes survive a
  // reconnect or a switch to another device.
  private handleUpdateNotes(userId: string, notes: string): void {
    this.notesByUserId.set(userId, notes);
  }

  // Moves to the next player in turnOrder (strictly forward, one pass
  // through the whole roster - nobody goes twice) who hasn't gone yet.
  // Concludes the round once everyone has had their turn.
  private advanceTurn(): void {
    if (this.finished) return;

    let idx = this.currentTurnIndex;
    while (idx + 1 < this.turnOrder.length) {
      idx += 1;
      const candidate = this.turnOrder[idx];
      if (this.disconnected.has(candidate)) {
        this.hasGone.add(candidate);
        continue;
      }
      if (!this.hasGone.has(candidate)) {
        this.currentTurnIndex = idx;
        this.beginTurn(candidate);
        return;
      }
    }

    this.concludeRound("จบรอบแล้ว ผู้เล่นที่ยังอยู่เล่นครบทุกคนแล้ว!");
  }

  private beginTurn(userId: string): void {
    this.currentTurnUserId = userId;
    this.currentWord = this.nextWord();
    this.turnStartedAt = Date.now();
    this.pendingGuess = null;
    this.guessVotes.clear();
    this.phase = "TURN";
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  private concludeRound(reason: string): void {
    this.currentTurnUserId = null;
    this.currentWord = null;
    this.turnStartedAt = null;
    this.pendingGuess = null;
    this.guessVotes.clear();
    this.phase = "FINISHED";
    this.finished = true;

    const scores: Record<string, number> = {};
    this.timeUsedByUserId.forEach((seconds, userId) => (scores[userId] = seconds));

    let fastestUserId: string | null = null;
    let slowestUserId: string | null = null;
    for (const [userId, seconds] of this.timeUsedByUserId.entries()) {
      if (fastestUserId === null || seconds < (this.timeUsedByUserId.get(fastestUserId) ?? Infinity)) {
        fastestUserId = userId;
      }
      if (slowestUserId === null || seconds > (this.timeUsedByUserId.get(slowestUserId) ?? -Infinity)) {
        slowestUserId = userId;
      }
    }

    this.roundResult = {
      summary: reason,
      scores,
      correctUserIds: Array.from(this.guessedCorrectly),
      fastestUserId,
      slowestUserId,
      wordCategory: this.wordCategory,
    };

    this.appendSystemLog(reason);
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
    this.emit(GAME_ENGINE_EVENTS.ENDED);
  }

  private appendLog(entry: WordHeadLogEntry): void {
    this.log.push(entry);
    if (this.log.length > MAX_LOG_ENTRIES) {
      this.log.splice(0, this.log.length - MAX_LOG_ENTRIES);
    }
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  private appendSystemLog(text: string): void {
    this.appendLog({ id: randomUUID(), type: "system", userId: null, username: null, text, timestamp: Date.now() });
  }

  getPublicState(): WordHeadPublicState {
    return {
      phase: this.phase,
      players: this.getPlayers().map((p) => ({
        userId: p.userId,
        username: p.username,
        connected: !this.disconnected.has(p.userId),
        hasGone: this.hasGone.has(p.userId),
        guessedCorrectly: this.guessedCorrectly.has(p.userId),
        timeUsedSeconds: this.timeUsedByUserId.get(p.userId) ?? null,
      })),
      turnOrder: this.turnOrder,
      currentTurnUserId: this.currentTurnUserId,
      turnStartedAt: this.turnStartedAt,
      log: this.log,
      wordCategory: this.wordCategory,
      result: this.finished ? this.roundResult : null,
      pendingGuess: this.pendingGuess,
      guessVotes: Object.fromEntries(this.guessVotes) as WordHeadGuessVotes,
    };
  }

  // The one place the up player's own word must never appear - everyone
  // else sees it (that's how the game works), only the current guesser's
  // view has it hidden.
  getPrivateState(userId: string): WordHeadPrivateState {
    const isUp = userId === this.currentTurnUserId;
    return {
      currentWord: isUp ? null : this.currentWord,
      hintCooldownEndsAt: this.hintCooldownUntilByUserId.get(userId) ?? null,
      notes: this.notesByUserId.get(userId) ?? "",
    };
  }

  end(): GameResult {
    if (!this.roundResult) {
      // Ended abnormally (e.g. host/room force-stop) before a natural
      // conclusion was reached - record it without crediting new times.
      this.concludeRound("เกมถูกจบก่อนที่จะได้ผลลัพธ์");
    }

    const result = this.roundResult!;
    // Lower time is better here (unlike every other game's points), so the
    // "winner" is whoever was fastest - see WordHeadState.ts's file-level
    // note; GameResult.tsx and any multi-round summary must know to invert
    // their usual highest-wins assumption for this game's `scores`.
    const winnerUserIds = result.fastestUserId ? [result.fastestUserId] : [];

    return {
      summary: result.summary,
      winnerUserIds,
      // Deliberately mirrors only the generic ScoreboardService contract
      // (see its typeof-guarded field reads) - omitting Spyfall-shaped keys
      // like winner/spyUserId/spyUsername/reason so their harmless fallback
      // defaults simply never surface for this game.
      details: result as unknown as Record<string, unknown>,
    };
  }
}
