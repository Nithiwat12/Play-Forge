import { EventEmitter } from "events";
import type { GamePlayer, GameResult } from "./types";

/**
 * BaseGame is the contract every game module (Spyfall, and any future
 * game) must implement. The Room System, Socket System, and GameManager
 * only ever talk to this interface - they never know about a specific
 * game's rules, state shape, or events.
 *
 * Lifecycle, driven by GameManager:
 *   new SomeGame(roomId, game)  -> addPlayer() for each seat -> start()
 *   -> handleAction() per client message, repeatedly
 *   -> end() once, when the game concludes
 *
 * A game signals asynchronous updates (a timer tick, a vote resolving)
 * by emitting STATE_CHANGED, and signals it has concluded on its own by
 * emitting ENDED - the socket layer listens for both.
 */
export abstract class BaseGame<
  TPublicState = unknown,
  TPrivateState = unknown
> extends EventEmitter {
  abstract readonly slug: string;

  protected readonly roomId: string;
  protected readonly players: Map<string, GamePlayer> = new Map();
  protected started = false;
  protected finished = false;

  constructor(roomId: string) {
    super();
    this.roomId = roomId;
  }

  addPlayer(player: GamePlayer): void {
    if (this.started) {
      throw new Error("Cannot add players after the game has started");
    }
    this.players.set(player.userId, player);
  }

  removePlayer(userId: string): void {
    this.players.delete(userId);
  }

  getPlayers(): GamePlayer[] {
    return Array.from(this.players.values());
  }

  isStarted(): boolean {
    return this.started;
  }

  isFinished(): boolean {
    return this.finished;
  }

  /** Validates preconditions, randomizes/assigns roles, starts timers, etc. */
  abstract start(): void;

  /**
   * Handles one client-submitted action. Implementations must validate the
   * action against current state and the acting player's permissions and
   * throw GameActionError on anything invalid - never trust the payload.
   */
  abstract handleAction(userId: string, actionType: string, payload: unknown): void;

  /** State safe to broadcast to every player in the room. */
  abstract getPublicState(): TPublicState;

  /** State that must only ever be sent to this one specific player. */
  abstract getPrivateState(userId: string): TPrivateState;

  /** Finalizes the game and returns the result to persist as history. */
  abstract end(): GameResult;
}
