import { randomUUID } from "crypto";
import { BaseGame } from "../core/BaseGame";
import { GAME_ENGINE_EVENTS, GameActionError, type GameResult } from "../core/types";
import { getWordPool, type WordHeadWord } from "./words";
import {
  WORDHEAD_ACTIONS,
  type WordHeadConfig,
  type WordHeadLogEntry,
  type WordHeadPhase,
  type WordHeadPublicState,
  type WordHeadPrivateState,
  type WordHeadResult,
} from "./WordHeadState";
import {
  WORDHEAD_MIN_PLAYERS,
  WORDHEAD_MAX_PLAYERS,
  WORDHEAD_TURN_SECONDS,
  WORDHEAD_ANSWER_WINDOW_SECONDS,
  WORDHEAD_ROUND_SECONDS,
  WORDHEAD_MAX_TEXT_LENGTH,
  validateAskQuestionPayload,
  validateAnswerPayload,
  validateGuessPayload,
  validateUpdateNotesPayload,
  isCorrectGuess,
  scoreForQuestionsUsed,
  resolveMajorityAnswer,
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
 * WordHead ("ทายคำบนหัว") engine - a Hedbanz-style game where every player
 * is secretly assigned a word they themselves cannot see, and must guess it
 * by asking the group yes/no/unsure questions. Designed, like Spyfall,
 * to work identically whether players are sitting together in person or
 * joining online - questionText is always optional so an in-person group
 * can just ask out loud and only tap the button.
 */
export class WordHeadGame extends BaseGame<WordHeadPublicState, WordHeadPrivateState> {
  readonly slug = "wordhead";

  private config: WordHeadConfig;
  private wordsByUserId: Map<string, string> = new Map();
  private wordCategory: string | null = null;
  private turnOrder: string[] = [];
  private currentTurnIndex = -1;
  private currentTurnUserId: string | null = null;
  private guessedCorrectly: Set<string> = new Set();
  private questionsUsedByUserId: Map<string, number> = new Map();
  private scores: Map<string, number> = new Map();
  private log: WordHeadLogEntry[] = [];
  private notesByUserId: Map<string, string> = new Map();
  private disconnected: Set<string> = new Set();

  private phase: WordHeadPhase = "TURN";
  private pendingPoll: {
    id: string;
    askerUserId: string;
    questionText: string | null;
    votes: Map<string, "YES" | "NO" | "UNSURE">;
    endsAt: number;
  } | null = null;

  private roundResult: WordHeadResult | null = null;

  private roundEndsAt: number | null = null;
  private roundTimer: NodeJS.Timeout | null = null;
  private turnEndsAt: number | null = null;
  private stepTimer: NodeJS.Timeout | null = null;

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
    const pool = getWordPool(category);
    this.wordCategory = category ?? null;

    const playerIds = this.getPlayers().map((p) => p.userId);
    const words = this.pickWordsForPlayers(pool, playerIds.length);
    playerIds.forEach((userId, i) => {
      this.wordsByUserId.set(userId, words[i].text);
      this.scores.set(userId, 0);
      this.questionsUsedByUserId.set(userId, 0);
    });

    this.turnOrder = shuffle(playerIds);
    this.currentTurnIndex = -1;

    this.started = true;
    this.roundEndsAt = Date.now() + WORDHEAD_ROUND_SECONDS * 1000;
    this.roundTimer = setTimeout(() => this.forceEndRound(), WORDHEAD_ROUND_SECONDS * 1000);

    this.advanceTurn();
  }

  // Picks one word per player. Uses distinct words when the pool is large
  // enough (more interesting - nobody can piggyback off overhearing a
  // duplicate); falls back to sampling with replacement if the chosen
  // category pool is too small for the room size.
  private pickWordsForPlayers(pool: WordHeadWord[], count: number): WordHeadWord[] {
    if (pool.length >= count) {
      return shuffle(pool).slice(0, count);
    }
    const result: WordHeadWord[] = [];
    for (let i = 0; i < count; i++) {
      result.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return result;
  }

  // Players who leave mid-round keep their word/score intact and stay in the
  // turn rotation (in case they reconnect) - just marked disconnected so the
  // client can show that, mirroring SpyfallGame's approach exactly.
  removePlayer(userId: string): void {
    if (!this.started) {
      super.removePlayer(userId);
      return;
    }
    this.disconnected.add(userId);
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
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
      case WORDHEAD_ACTIONS.ASK_QUESTION:
        this.handleAskQuestion(userId, validateAskQuestionPayload(payload));
        break;
      case WORDHEAD_ACTIONS.ANSWER_QUESTION:
        this.handleAnswerQuestion(userId, validateAnswerPayload(payload).vote);
        break;
      case WORDHEAD_ACTIONS.GUESS:
        this.handleGuess(userId, validateGuessPayload(payload).guessText);
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

  private requireCurrentTurn(userId: string): void {
    if (this.currentTurnUserId !== userId) {
      throw new GameActionError("ยังไม่ถึงตาคุณ");
    }
    if (this.phase !== "TURN") {
      throw new GameActionError("ตอนนี้ไม่ใช่ช่วงที่ถามหรือทายได้");
    }
  }

  private handleAskQuestion(userId: string, payload: { questionText?: string | null }): void {
    this.requireCurrentTurn(userId);

    const asker = this.players.get(userId)!;
    const id = randomUUID();
    this.pendingPoll = {
      id,
      askerUserId: userId,
      questionText: payload.questionText ?? null,
      votes: new Map(),
      endsAt: Date.now() + WORDHEAD_ANSWER_WINDOW_SECONDS * 1000,
    };
    this.phase = "ANSWER_WINDOW";
    this.appendLog({
      id,
      type: "question",
      userId,
      username: asker.username,
      text: payload.questionText ?? null,
      timestamp: Date.now(),
    });
    this.beginStepTimer(WORDHEAD_ANSWER_WINDOW_SECONDS, () => this.resolveAnswerWindow());
  }

  // Anyone except the asker can vote - including players who already
  // guessed their own word correctly, since they already know every word
  // and their continued participation keeps the crowd-vote meaningful.
  private handleAnswerQuestion(userId: string, vote: "YES" | "NO" | "UNSURE"): void {
    if (this.phase !== "ANSWER_WINDOW" || !this.pendingPoll) {
      throw new GameActionError("ตอนนี้ไม่มีคำถามที่รอคำตอบอยู่");
    }
    if (userId === this.pendingPoll.askerUserId) {
      throw new GameActionError("คุณตอบคำถามของตัวเองไม่ได้");
    }
    this.pendingPoll.votes.set(userId, vote);

    const eligibleVoters = this.getPlayers().filter((p) => p.userId !== this.pendingPoll!.askerUserId).length;
    if (this.pendingPoll.votes.size >= eligibleVoters) {
      this.resolveAnswerWindow();
    } else {
      this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
    }
  }

  private resolveAnswerWindow(): void {
    if (!this.pendingPoll) return;
    const poll = this.pendingPoll;
    this.pendingPoll = null;

    const votesObj: Record<string, "YES" | "NO" | "UNSURE"> = {};
    poll.votes.forEach((v, k) => (votesObj[k] = v));
    const answer = resolveMajorityAnswer(votesObj);

    const entry = this.log.find((l) => l.id === poll.id);
    if (entry) entry.answer = answer;

    this.questionsUsedByUserId.set(poll.askerUserId, (this.questionsUsedByUserId.get(poll.askerUserId) ?? 0) + 1);

    this.phase = "TURN";
    this.advanceTurn();
  }

  private handleGuess(userId: string, guessText: string): void {
    this.requireCurrentTurn(userId);
    if (this.guessedCorrectly.has(userId)) {
      throw new GameActionError("คุณทายคำของตัวเองถูกไปแล้ว");
    }
    const word = this.wordsByUserId.get(userId);
    if (!word) {
      throw new GameActionError("ไม่พบคำของคุณ");
    }

    const guesser = this.players.get(userId)!;
    const correct = isCorrectGuess(guessText, word);

    this.appendLog({
      id: randomUUID(),
      type: "guess",
      userId,
      username: guesser.username,
      text: guessText.slice(0, WORDHEAD_MAX_TEXT_LENGTH),
      guessCorrect: correct,
      timestamp: Date.now(),
    });

    if (correct) {
      this.guessedCorrectly.add(userId);
      const questionsUsed = this.questionsUsedByUserId.get(userId) ?? 0;
      const points = scoreForQuestionsUsed(questionsUsed);
      this.scores.set(userId, (this.scores.get(userId) ?? 0) + points);
      this.appendSystemLog(`${guesser.username} ทายคำของตัวเองถูกต้อง! คำคือ "${word}" (+${points} คะแนน)`);
    }

    this.advanceTurn();
  }

  private handlePassTurn(userId: string): void {
    this.requireCurrentTurn(userId);
    this.advanceTurn();
  }

  // Deliberately does NOT emit STATE_CHANGED - broadcasting a full state
  // push to the whole room every time one player types in their private
  // notes would be wasteful; the note-taker's own client already updates
  // optimistically, and the server copy exists purely so notes survive a
  // reconnect or a switch to another device.
  private handleUpdateNotes(userId: string, notes: string): void {
    this.notesByUserId.set(userId, notes);
  }

  // Moves to the next player (in turnOrder, wrapping) who hasn't already
  // guessed their word correctly. Concludes the round once nobody's left.
  private advanceTurn(): void {
    if (this.finished) return;
    const anyoneLeft = this.turnOrder.some((id) => !this.guessedCorrectly.has(id));
    if (!anyoneLeft) {
      this.concludeRound("ผู้เล่นทุกคนทายคำของตัวเองถูกหมดแล้ว!");
      return;
    }

    let idx = this.currentTurnIndex;
    for (let i = 0; i < this.turnOrder.length; i++) {
      idx = (idx + 1) % this.turnOrder.length;
      const candidate = this.turnOrder[idx];
      if (!this.guessedCorrectly.has(candidate)) {
        this.currentTurnIndex = idx;
        this.beginTurn(candidate);
        return;
      }
    }
  }

  private beginTurn(userId: string): void {
    this.currentTurnUserId = userId;
    this.phase = "TURN";
    this.beginStepTimer(WORDHEAD_TURN_SECONDS, () => this.onTurnTimeout());
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  private onTurnTimeout(): void {
    if (this.finished || this.phase !== "TURN" || !this.currentTurnUserId) return;
    const username = this.players.get(this.currentTurnUserId)?.username ?? "ไม่ทราบชื่อ";
    this.appendSystemLog(`${username} หมดเวลา ข้ามไปตาถัดไป`);
    this.advanceTurn();
  }

  private beginStepTimer(seconds: number, onFire: () => void): void {
    if (this.stepTimer) clearTimeout(this.stepTimer);
    this.turnEndsAt = Date.now() + seconds * 1000;
    this.stepTimer = setTimeout(onFire, seconds * 1000);
  }

  private forceEndRound(): void {
    if (this.finished) return;
    this.concludeRound("หมดเวลาทั้งรอบ!");
  }

  private concludeRound(reason: string): void {
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    this.pendingPoll = null;
    this.phase = "FINISHED";
    this.finished = true;

    const scores: Record<string, number> = {};
    this.scores.forEach((v, k) => (scores[k] = v));

    this.roundResult = {
      summary: reason,
      scores,
      correctCount: this.guessedCorrectly.size,
      totalPlayers: this.players.size,
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
        guessedCorrectly: this.guessedCorrectly.has(p.userId),
        questionsUsed: this.questionsUsedByUserId.get(p.userId) ?? 0,
        score: this.scores.get(p.userId) ?? 0,
      })),
      turnOrder: this.turnOrder,
      currentTurnUserId: this.currentTurnUserId,
      turnEndsAt: this.turnEndsAt,
      pendingPoll: this.publicPendingPoll(),
      log: this.log,
      roundEndsAt: this.roundEndsAt,
      wordCategory: this.wordCategory,
      result: this.finished ? this.roundResult : null,
    };
  }

  private publicPendingPoll(): WordHeadPublicState["pendingPoll"] {
    if (!this.pendingPoll) return null;
    const votes: Record<string, "YES" | "NO" | "UNSURE"> = {};
    this.pendingPoll.votes.forEach((v, k) => (votes[k] = v));
    return {
      id: this.pendingPoll.id,
      askerUserId: this.pendingPoll.askerUserId,
      questionText: this.pendingPoll.questionText,
      votes,
      endsAt: this.pendingPoll.endsAt,
    };
  }

  // The one place a player's own secret word must never appear - everyone
  // else's word IS visible to them (that's how the game works), only their
  // own key is left out of the map.
  getPrivateState(userId: string): WordHeadPrivateState {
    const wordsByUserId: Record<string, string> = {};
    this.wordsByUserId.forEach((word, ownerUserId) => {
      if (ownerUserId !== userId) wordsByUserId[ownerUserId] = word;
    });
    return {
      wordsByUserId,
      notes: this.notesByUserId.get(userId) ?? "",
    };
  }

  end(): GameResult {
    if (!this.roundResult) {
      // Ended abnormally (e.g. host/room force-stop) before a natural
      // conclusion was reached - record it without crediting new scores.
      this.concludeRound("เกมถูกจบก่อนที่จะได้ผลลัพธ์");
    }

    const result = this.roundResult!;
    const winnerUserIds = Object.entries(result.scores)
      .filter(([, score]) => score > 0)
      .map(([userId]) => userId);

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
