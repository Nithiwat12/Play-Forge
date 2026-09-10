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
  validateQuestionPayload,
  validateAnswerPayload,
  validateVotePayload,
  validateGuessPayload,
  tallyVotes,
  resolveMajority,
} from "./SpyfallRules";

const MAX_LOG_ENTRIES = 200;

/**
 * Spyfall engine. Owns all Spyfall-specific state and rules; the platform
 * (Room System, Socket System, GameManager) only ever sees this through
 * the BaseGame contract.
 */
export class SpyfallGame extends BaseGame<SpyfallPublicState, SpyfallPrivateState> {
  readonly slug = "spyfall";

  private location: SpyfallLocation | null = null;
  private spyUserId: string | null = null;
  private roleAssignment: Map<string, string> = new Map();
  private log: SpyfallLogEntry[] = [];
  private votes: Map<string, string> = new Map(); // voterUserId -> targetUserId
  private disconnected: Set<string> = new Set();
  private phase: SpyfallPhase = "IN_PROGRESS";
  private result: SpyfallResult | null = null;
  private timerEndsAt: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.players.size < SPYFALL_MIN_PLAYERS) {
      throw new Error(`Spyfall requires at least ${SPYFALL_MIN_PLAYERS} players`);
    }
    if (this.players.size > SPYFALL_MAX_PLAYERS) {
      throw new Error(`Spyfall supports at most ${SPYFALL_MAX_PLAYERS} players`);
    }

    this.location = shuffle(SPYFALL_LOCATIONS)[0];

    const playerIds = this.getPlayers().map((p) => p.userId);
    this.spyUserId = playerIds[Math.floor(Math.random() * playerIds.length)];
    const nonSpyIds = playerIds.filter((id) => id !== this.spyUserId);
    this.roleAssignment = assignRoles(this.location, nonSpyIds);

    this.phase = "IN_PROGRESS";
    this.started = true;
    this.timerEndsAt = Date.now() + SPYFALL_TIMER_SECONDS * 1000;
    this.timer = setTimeout(() => this.forceEndByTimer(), SPYFALL_TIMER_SECONDS * 1000);

    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
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

  handleAction(userId: string, actionType: string, payload: unknown): void {
    if (!this.players.has(userId)) {
      throw new GameActionError("You are not part of this game");
    }
    if (this.finished) {
      throw new GameActionError("This game has already ended");
    }

    switch (actionType) {
      case SPYFALL_ACTIONS.QUESTION:
        this.handleQuestion(userId, validateQuestionPayload(payload));
        break;
      case SPYFALL_ACTIONS.ANSWER:
        this.handleAnswer(userId, validateAnswerPayload(payload));
        break;
      case SPYFALL_ACTIONS.VOTE:
        this.handleVote(userId, validateVotePayload(payload).targetUserId);
        break;
      case SPYFALL_ACTIONS.GUESS:
        this.handleGuess(userId, validateGuessPayload(payload).location);
        break;
      default:
        throw new GameActionError(`Unknown Spyfall action: ${actionType}`);
    }
  }

  private handleQuestion(fromUserId: string, payload: { toUserId: string; text: string }): void {
    if (payload.toUserId === fromUserId) {
      throw new GameActionError("You cannot question yourself");
    }
    const target = this.players.get(payload.toUserId);
    if (!target) {
      throw new GameActionError("Target player is not in this game");
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

  private handleVote(voterId: string, targetUserId: string): void {
    if (targetUserId === voterId) {
      throw new GameActionError("You cannot vote for yourself");
    }
    if (!this.players.has(targetUserId)) {
      throw new GameActionError("Vote target is not in this game");
    }

    this.votes.set(voterId, targetUserId);
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);

    if (this.votes.size >= this.players.size) {
      this.resolveByVotes("The group cast all their votes.");
    }
  }

  private handleGuess(userId: string, location: string): void {
    if (userId !== this.spyUserId) {
      throw new GameActionError("Only the Spy can guess the location");
    }
    const correct = location.trim().toLowerCase() === this.location!.name.toLowerCase();
    this.conclude({
      winner: correct ? "SPY" : "NON_SPY",
      reason: correct
        ? `The Spy correctly guessed the location: ${this.location!.name}.`
        : `The Spy guessed "${location.trim()}", which was wrong, and is revealed.`,
      spyUserId: this.spyUserId!,
      spyUsername: this.players.get(this.spyUserId!)?.username ?? "Unknown",
      location: this.location!.name,
      spyGuess: location.trim(),
    });
  }

  private forceEndByTimer(): void {
    if (this.finished) return;
    this.resolveByVotes("Time ran out.");
  }

  private resolveByVotes(reasonPrefix: string): void {
    const usernameByUserId = new Map(this.getPlayers().map((p) => [p.userId, p.username]));
    const tally = tallyVotes(this.votes, usernameByUserId);
    const majority = resolveMajority(tally);
    const spyCaught = majority !== null && majority === this.spyUserId;

    const votes: SpyfallRevealedVote[] = Array.from(this.votes.entries()).map(
      ([voterUserId, targetUserId]) => ({
        voterUserId,
        voterUsername: usernameByUserId.get(voterUserId) ?? "Unknown",
        targetUserId,
        targetUsername: usernameByUserId.get(targetUserId) ?? "Unknown",
      })
    );

    let reason: string;
    if (this.votes.size === 0) {
      reason = `${reasonPrefix} No one voted, so the Spy escapes.`;
    } else if (majority === null) {
      reason = `${reasonPrefix} The vote ended in a tie, so the Spy escapes.`;
    } else if (spyCaught) {
      reason = `${reasonPrefix} The group correctly voted out ${usernameByUserId.get(majority)}, the Spy.`;
    } else {
      reason = `${reasonPrefix} The group voted out ${usernameByUserId.get(majority)}, who was not the Spy.`;
    }

    this.conclude({
      winner: spyCaught ? "NON_SPY" : "SPY",
      reason,
      spyUserId: this.spyUserId!,
      spyUsername: usernameByUserId.get(this.spyUserId!) ?? "Unknown",
      location: this.location!.name,
      voteTally: tally,
      votes,
    });
  }

  private conclude(result: SpyfallResult): void {
    this.result = result;
    this.phase = "FINISHED";
    this.finished = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
    this.emit(GAME_ENGINE_EVENTS.ENDED);
  }

  private appendLog(entry: SpyfallLogEntry): void {
    this.log.push(entry);
    if (this.log.length > MAX_LOG_ENTRIES) {
      this.log.splice(0, this.log.length - MAX_LOG_ENTRIES);
    }
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  getPublicState(): SpyfallPublicState {
    return {
      phase: this.phase,
      timerDurationSeconds: SPYFALL_TIMER_SECONDS,
      timerEndsAt: this.timerEndsAt,
      players: this.getPlayers().map((p) => ({
        userId: p.userId,
        username: p.username,
        hasVoted: this.votes.has(p.userId),
        connected: !this.disconnected.has(p.userId),
      })),
      log: this.log,
      result: this.finished ? this.result : null,
    };
  }

  getPrivateState(userId: string): SpyfallPrivateState {
    if (!this.location || !this.spyUserId) {
      return { isSpy: false, location: null, role: null };
    }
    if (userId === this.spyUserId) {
      return { isSpy: true, location: null, role: null };
    }
    return {
      isSpy: false,
      location: this.location.name,
      role: this.roleAssignment.get(userId) ?? null,
    };
  }

  end(): GameResult {
    if (!this.result) {
      // Ended abnormally (e.g. host/room force-stop) before a natural
      // conclusion was reached - record it without declaring a winner.
      this.conclude({
        winner: "SPY",
        reason: "The game was ended before a result was reached.",
        spyUserId: this.spyUserId ?? "unknown",
        spyUsername: this.spyUserId
          ? this.players.get(this.spyUserId)?.username ?? "Unknown"
          : "Unknown",
        location: this.location?.name ?? "Unknown",
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
