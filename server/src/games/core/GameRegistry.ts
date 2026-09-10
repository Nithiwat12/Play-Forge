import type { BaseGame } from "./BaseGame";

type GameFactory = (roomId: string) => BaseGame;

/**
 * Maps a game's slug (matching the `games.slug` DB column) to a factory
 * that builds a fresh engine instance for one room.
 *
 * Adding a new game to the platform means:
 *   1. Implement BaseGame in src/games/<newGame>/
 *   2. `GameRegistry.register("new-game", (roomId) => new NewGame(roomId))`
 *   3. Insert a matching row into the `games` table
 * Nothing else in the platform changes.
 */
class GameRegistryClass {
  private factories = new Map<string, GameFactory>();

  register(slug: string, factory: GameFactory): void {
    if (this.factories.has(slug)) {
      throw new Error(`A game is already registered for slug "${slug}"`);
    }
    this.factories.set(slug, factory);
  }

  has(slug: string): boolean {
    return this.factories.has(slug);
  }

  create(slug: string, roomId: string): BaseGame {
    const factory = this.factories.get(slug);
    if (!factory) {
      throw new Error(`No game implementation registered for slug "${slug}"`);
    }
    return factory(roomId);
  }

  listRegisteredSlugs(): string[] {
    return Array.from(this.factories.keys());
  }
}

export const GameRegistry = new GameRegistryClass();
