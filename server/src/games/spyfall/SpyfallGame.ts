import { randomUUID } from "crypto";
import { BaseGame } from "../core/BaseGame";
import { GAME_ENGINE_EVENTS, GameActionError, type GameResult } from "../core/types";
import { SPYFALL_LOCATIONS, type SpyfallLocation } from "./locations";
import { assignRoles, shuffle } from "./roles";
import {
  SPYFALL_ACTIONS,
  type SpyfallLogEntry,
  type SpyfallPhase,
  type SpyfallPublicState,
  type SpyfallPrivateState,
  type SpyfallResult,
  type SpyfallRevealedVote,
} from "./SpyfallState";
import {
  SPYFALL_MIN_PLAYERS,
  SPYFALL_MAX_PLAYERS,
  SPYFALL_TIMER_SECONDS,
  SPYFALL_MAX_TEXT_LENGTH,
  SPYFALL_TIE_EXTENSION_SECONDS,
  SPYFALL_MAX_TIE_EXTENSIONS,
  validateQuestionPayload,
  validateAnswerPayload,
  validateVotePayload,
  validateGuessPayload,
  tallyVotes,
  resolveMajority,
  requiredVoteCallers,
} from "./SpyfallRules";

const MAX_LOG_ENTRIES = 200;
const MIN_DISCUSSION_SECONDS = 3 * 60;
const MAX_DISCUSSION_SECONDS = 20 * 60;

// Per-room, host-chosen config (set at room creation, see RoomService /
// CreateRoom page). Everything here is optional - a room with no settings
// gets the classic defaults.
export interface SpyfallConfig {
  discussionSeconds?: number;
}

/**
 * Spyfall engine. Owns all Spyfall-specific state and rules; the platform
 * (Room System, Socket System, GameManager) only ever sees this through
 * the BaseGame contract.
 */
export class SpyfallGame extends BaseGame<SpyfallPublicState, SpyfallPrivateState> {
  readonly slug = "spyfall";

  private config: SpyfallConfig;
  private location: SpyfallLocation | null = null;
  private spyUserId: string | null = null;
  private roleAssignment: Map<string, string> = new Map();
  private log: SpyfallLogEntry[] = [];
  private votes: Map<string, string> = new Map(); // voterUserId -> targetUserId
  private voteCallers: Set<string> = new Set();
  private tieExtensionsUsed = 0;
  private disconnected: Set<string> = new Set();
  private phase: SpyfallPhase = "IN_PROGRESS";
  private result: SpyfallResult | null = null;
  private discussionSeconds: number = SPYFALL_TIMER_SECONDS;
  private timerEndsAt: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(roomId: string, config?: SpyfallConfig) {
    super(roomId);
    this.config = config ?? {};
  }

  start(): void {
    if (this.players.size < SPYFALL_MIN_PLAYERS) {
      throw new Error(`Spy Hunt ต้องมีผู้เล่นอย่างน้อย ${SPYFALL_MIN_PLAYERS} คน`);
    }
    if (this.players.size > SPYFALL_MAX_PLAYERS) {
      throw new Error(`Spy Hunt รองรับผู้เล่นได้สูงสุด ${SPYFALL_MAX_PLAYERS} คน`);
    }

    this.discussionSeconds = this.resolveDiscussionSeconds();
    this.location = shuffle(SPYFALL_LOCATIONS)[0];

    const playerIds = this.getPlayers().map((p) => p.userId);
    this.spyUserId = playerIds[Math.floor(Math.random() * playerIds.length)];
    const nonSpyIds = playerIds.filter((id) => id !== this.spyUserId);
    this.roleAssignment = assignRoles(this.location, nonSpyIds);

    this.phase = "IN_PROGRESS";
    this.started = true;
    this.beginTimer(this.discussionSeconds);

    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  private resolveDiscussionSeconds(): number {
    const configured = this.config.discussionSeconds;
    if (typeof configured !== "number" || !Number.isFinite(configured)) {
      return SPYFALL_TIMER_SECONDS;
    }
    return Math.min(MAX_DISCUSSION_SECONDS, Math.max(MIN_DISCUSSION_SECONDS, Math.round(configured)));
  }

  private beginTimer(seconds: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timerEndsAt = Date.now() + seconds * 1000;
    this.timer = setTimeout(() => this.forceEndByTimer(), seconds * 1000);
  }

  // Players who leave mid-round keep their role/spy assignment intact
  // (win conditions still need to reference them) - we just mark them
  // disconnected instead of deleting them from the roster.
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
      case SPYFALL_ACTIONS.QUESTION:
        this.handleQuestion(userId, validateQuestionPayload(payload));
        break;
      case SPYFALL_ACTIONS.ANSWER:
        this.handleAnswer(userId, validateAnswerPayload(payload));
        break;
      case SPYFALL_ACTIONS.CALL_VOTE:
        this.handleCallVote(userId);
        break;
      case SPYFALL_ACTIONS.VOTE:
        this.handleVote(userId, validateVotePayload(payload).targetUserId);
        break;
      case SPYFALL_ACTIONS.GUESS:
        this.handleGuess(userId, validateGuessPayload(payload).location);
        break;
      default:
        throw new GameActionError(`ไม่รู้จักการกระทำนี้: ${actionType}`);
    }
  }

  private handleQuestion(fromUserId: string, payload: { toUserId: string; text: string }): void {
    if (payload.toUserId === fromUserId) {
      throw new GameActionError("คุณถามตัวเองไม่ได้");
    }
    const target = this.players.get(payload.toUserId);
    if (!target) {
      throw new GameActionError("ผู้เล่นที่เลือกไม่ได้อยู่ในเกมนี้");
    }
    const from = this.players.get(fromUserId)!;

    this.appendLog({
      id: randomUUID(),
      type: "question",
      fromUserId,
      fromUsername: from.username,
      toUserId: target.userId,
      toUsername: target.username,
      text: payload.text.slice(0, SPYFALL_MAX_TEXT_LENGTH),
      timestamp: Date.now(),
    });
  }

  private handleAnswer(fromUserId: string, payload: { text: string }): void {
    const from = this.players.get(fromUserId)!;
    this.appendLog({
      id: randomUUID(),
      type: "answer",
      fromUserId,
      fromUsername: from.username,
      text: payload.text.slice(0, SPYFALL_MAX_TEXT_LENGTH),
      timestamp: Date.now(),
    });
  }

  // Any player can call for a vote - once EVERY current player has called
  // for it (unanimous, see requiredVoteCallers), the room moves into the
  // dedicated voting screen (see getPublicState().voteCallers/
  // requiredVoteCallers). The Spy calling this same action is different:
  // it's their own unilateral "stop the game, I want to answer now" - no
  // group agreement needed, it opens voting immediately just for them to
  // guess, regardless of how many others have (or haven't) also called.
  private handleCallVote(userId: string): void {
    if (this.phase !== "IN_PROGRESS") {
      throw new GameActionError("ตอนนี้ไม่ได้อยู่ในช่วงพูดคุย เปิดโหวตไม่ได้");
    }
    if (this.voteCallers.has(userId)) return;

    this.voteCallers.add(userId);

    if (userId === this.spyUserId) {
      this.openVoting("สปายขอหยุดเกมเพื่อตอบ!");
      return;
    }

    const required = requiredVoteCallers(this.players.size);
    if (this.voteCallers.size >= required) {
      this.openVoting("เปิดโหมดโหวตแล้ว! เลือกผู้เล่นที่คุณคิดว่าเป็นสปาย");
    } else {
      this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
    }
  }

  // Freezes the discussion clock the moment voting opens, whichever way it
  // opened (everyone calling for a vote, or the Spy's own unilateral stop) -
  // nobody should get timed out mid-vote or mid-answer, since the round now
  // resolves from a vote or a guess, not the clock.
  private openVoting(systemMessage: string): void {
    this.phase = "VOTING";
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timerEndsAt = null;
    this.appendSystemLog(systemMessage); // also emits STATE_CHANGED
  }

  private handleVote(voterId: string, targetUserId: string): void {
    if (this.phase !== "VOTING") {
      throw new GameActionError("ต้องเปิดโหมดโหวตก่อนถึงจะโหวตได้ - กด \"ขอเปิดโหวต\" ก่อน");
    }
    if (targetUserId === voterId) {
      throw new GameActionError("คุณโหวตตัวเองไม่ได้");
    }
    if (!this.players.has(targetUserId)) {
      throw new GameActionError("ผู้เล่นที่จะโหวตไม่ได้อยู่ในเกมนี้");
    }

    this.votes.set(voterId, targetUserId);
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);

    if (this.votes.size >= this.players.size) {
      this.resolveByVotes("ทุกคนโหวตครบแล้ว");
    }
  }

  // The Spy picks their final answer from the real location list - the
  // server itself checks it against the actual location, so there's no
  // more honor-system self-report of "correct/wrong".
  private handleGuess(userId: string, guessedLocation: string): void {
    if (userId !== this.spyUserId) {
      throw new GameActionError("เฉพาะสปายเท่านั้นที่ตอบได้");
    }
    if (this.phase !== "VOTING") {
      throw new GameActionError("ต้องเปิดโหมดโหวตก่อนถึงจะตอบได้ - กด \"หยุดเกมเพื่อตอบ\" ก่อน");
    }

    const correct = guessedLocation === this.location!.name;
    this.conclude({
      winner: correct ? "SPY" : "NON_SPY",
      reason: correct
        ? `สปายทายสถานที่ถูกต้อง! คำตอบคือ "${guessedLocation}"`
        : `สปายทายผิด! ทายว่า "${guessedLocation}" แต่สถานที่จริงคือ "${this.location!.name}"`,
      spyUserId: this.spyUserId!,
      spyUsername: this.players.get(this.spyUserId!)?.username ?? "ไม่ทราบชื่อ",
      location: this.location!.name,
      spyGuessedLocation: guessedLocation,
      spyGuessCorrect: correct,
    });
  }

  private forceEndByTimer(): void {
    if (this.finished) return;
    this.resolveByVotes("หมดเวลาแล้ว");
  }

  private resolveByVotes(reasonPrefix: string): void {
    const usernameByUserId = new Map(this.getPlayers().map((p) => [p.userId, p.username]));
    const tally = tallyVotes(this.votes, usernameByUserId);
    const majority = resolveMajority(tally);

    // A genuine tie among 2+ people (not simply "nobody voted") gives the
    // group a second chance instead of letting the Spy escape by default.
    if (majority === null && this.votes.size > 0 && this.tieExtensionsUsed < SPYFALL_MAX_TIE_EXTENSIONS) {
      this.tieExtensionsUsed += 1;
      this.votes.clear();
      this.voteCallers.clear();
      this.phase = "IN_PROGRESS";
      this.beginTimer(SPYFALL_TIE_EXTENSION_SECONDS);
      this.appendSystemLog(
        `โหวตเสมอกัน! ต่อเวลาพิเศษให้อีก ${SPYFALL_TIE_EXTENSION_SECONDS / 60} นาที`
      );
      return;
    }

    const spyCaught = majority !== null && majority === this.spyUserId;

    const votes: SpyfallRevealedVote[] = Array.from(this.votes.entries()).map(
      ([voterUserId, targetUserId]) => ({
        voterUserId,
        voterUsername: usernameByUserId.get(voterUserId) ?? "ไม่ทราบชื่อ",
        targetUserId,
        targetUsername: usernameByUserId.get(targetUserId) ?? "ไม่ทราบชื่อ",
      })
    );

    let reason: string;
    if (this.votes.size === 0) {
      reason = `${reasonPrefix} ไม่มีใครโหวตเลย สปายจึงรอดตัวไป`;
    } else if (majority === null) {
      reason = `${reasonPrefix} โหวตเสมอกัน สปายจึงรอดตัวไป`;
    } else if (spyCaught) {
      reason = `${reasonPrefix} กลุ่มโหวตถูกคน! ${usernameByUserId.get(majority)} คือสปาย`;
    } else {
      reason = `${reasonPrefix} กลุ่มโหวตผิดคน ${usernameByUserId.get(majority)} ไม่ใช่สปาย`;
    }

    this.conclude({
      winner: spyCaught ? "NON_SPY" : "SPY",
      reason,
      spyUserId: this.spyUserId!,
      spyUsername: usernameByUserId.get(this.spyUserId!) ?? "ไม่ทราบชื่อ",
      location: this.location!.name,
      voteTally: tally,
      votes,
    });
  }

  private conclude(result: Omit<SpyfallResult, "scores">): void {
    this.result = { ...result, scores: this.computeScores(result) };
    this.phase = "FINISHED";
    this.finished = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
    this.emit(GAME_ENGINE_EVENTS.ENDED);
  }

  // Scoring: the Spy escaping unnoticed (time runs out, a tie, or the group
  // votes the wrong person) is worth less than the Spy pulling off a
  // correct location guess, which takes real nerve. On the other side,
  // only the specific players whose own vote actually named the real Spy
  // get credit for the catch - not the whole non-Spy team by default.
  private computeScores(result: Omit<SpyfallResult, "scores">): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p.userId] = 0;
    }

    if (result.winner === "SPY") {
      const points = result.spyGuessCorrect ? 3 : 1;
      scores[result.spyUserId] = (scores[result.spyUserId] ?? 0) + points;
    } else {
      for (const vote of result.votes ?? []) {
        if (vote.targetUserId === result.spyUserId) {
          scores[vote.voterUserId] = (scores[vote.voterUserId] ?? 0) + 1;
        }
      }
    }

    return scores;
  }

  private appendLog(entry: SpyfallLogEntry): void {
    this.log.push(entry);
    if (this.log.length > MAX_LOG_ENTRIES) {
      this.log.splice(0, this.log.length - MAX_LOG_ENTRIES);
    }
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  private appendSystemLog(text: string): void {
    this.appendLog({ id: randomUUID(), type: "system", text, timestamp: Date.now() });
  }

  getPublicState(): SpyfallPublicState {
    return {
      phase: this.phase,
      timerDurationSeconds: this.discussionSeconds,
      timerEndsAt: this.timerEndsAt,
      players: this.getPlayers().map((p) => ({
        userId: p.userId,
        username: p.username,
        hasVoted: this.votes.has(p.userId),
        connected: !this.disconnected.has(p.userId),
      })),
      log: this.log,
      result: this.finished ? this.result : null,
      voteCallers: Array.from(this.voteCallers),
      requiredVoteCallers: requiredVoteCallers(this.players.size),
    };
  }

  getPrivateState(userId: string): SpyfallPrivateState {
    if (!this.location || !this.spyUserId) {
      return { isSpy: false, location: null, role: null, locationOptions: null };
    }
    if (userId === this.spyUserId) {
      // The Spy gets the full location list - same reference sheet the
      // physical game hands the spy - to cross options off as they listen,
      // and to pick their final answer from at guess time.
      return {
        isSpy: true,
        location: null,
        role: null,
        locationOptions: SPYFALL_LOCATIONS.map((l) => l.name),
      };
    }
    return {
      isSpy: false,
      location: this.location.name,
      role: this.roleAssignment.get(userId) ?? null,
      locationOptions: null,
    };
  }

  end(): GameResult {
    if (!this.result) {
      // Ended abnormally (e.g. host/room force-stop) before a natural
      // conclusion was reached - record it without declaring a winner.
      this.conclude({
        winner: "SPY",
        reason: "เกมถูกจบก่อนที่จะได้ผลลัพธ์",
        spyUserId: this.spyUserId ?? "unknown",
        spyUsername: this.spyUserId
          ? this.players.get(this.spyUserId)?.username ?? "ไม่ทราบชื่อ"
          : "ไม่ทราบชื่อ",
        location: this.location?.name ?? "ไม่ทราบชื่อ",
      });
    }

    const result = this.result!;
    const winnerUserIds =
      result.winner === "SPY"
        ? [result.spyUserId]
        : this.getPlayers().filter((p) => p.userId !== result.spyUserId).map((p) => p.userId);

    return {
      summary: result.reason,
      winnerUserIds,
      details: result as unknown as Record<string, unknown>,
    };
  }
}
