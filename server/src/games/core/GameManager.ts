import { GameRegistry } from "./GameRegistry";
import type { BaseGame } from "./BaseGame";
import type { GamePlayer, GameResult } from "./types";

/**
 * Owns the in-memory lifecycle of active game instances, one per room.
 * This is the only piece of the platform that bridges the generic Room
 * System to a concrete game engine - it never contains game-specific
 * rules itself, it just looks the right engine up in GameRegistry.
 *
 * A single Node process instance holds these games in memory. Scaling
 * horizontally later means moving this map's contents into Redis (or
 * pinning a room to one process via sticky sessions) - the interface
 * below is written so that swap wouldn't ripple into callers.
 */
class GameManagerClass {
  private activeGames = new Map<string, BaseGame>();

  startGame(roomId: string, gameSlug: string, players: GamePlayer[], config?: unknown): BaseGame {
    if (this.activeGames.has(roomId)) {
      throw new Error(`มีเกมที่กำลังเล่นอยู่ในห้องนี้แล้ว`);
    }

    const game = GameRegistry.create(gameSlug, roomId, config);
    for (const player of players) {
      game.addPlayer(player);
    }
    game.start();

    this.activeGames.set(roomId, game);
    return game;
  }

  getGame(roomId: string): BaseGame | undefined {
    return this.activeGames.get(roomId);
  }

  handleAction(roomId: string, userId: string, actionType: string, payload: unknown): void {
    const game = this.activeGames.get(roomId);
    if (!game) {
      throw new Error("ไม่มีเกมที่กำลังเล่นอยู่ในห้องนี้");
    }
    game.handleAction(userId, actionType, payload);
  }

  removePlayer(roomId: string, userId: string): void {
    this.activeGames.get(roomId)?.removePlayer(userId);
  }

  /** Ends the game (if any) and removes it from memory. Idempotent. */
  endGame(roomId: string): GameResult | null {
    const game = this.activeGames.get(roomId);
    if (!game) return null;
    const result = game.end();
    this.activeGames.delete(roomId);
    return result;
  }

  isGameActive(roomId: string): boolean {
    return this.activeGames.has(roomId);
  }
}

export const GameManager = new GameManagerClass();
