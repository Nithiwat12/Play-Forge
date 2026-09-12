import type { RoleDefinition } from "./roles";
import type { BaseGame } from "./BaseGame";

// `config` is opaque here on purpose - the platform never interprets a
// specific game's config shape, it just carries it from the room's
// settings JSON to whichever factory the slug resolves to.
type GameFactory = (roomId: string, config?: unknown) => BaseGame;

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

  private roles = new Map<string, RoleDefinition[]>();

  getRoleDefinitions(slug: string): RoleDefinition[] { return this.roles.get(slug) ?? []; }

  register(slug: string, factory: GameFactory, roles: RoleDefinition[] = []): void {
    if (this.factories.has(slug)) {
      throw new Error(`A game is already registered for slug "${slug}"`);
    }
    this.factories.set(slug, factory);
    this.roles.set(slug, roles);
  }

  has(slug: string): boolean {
    return this.factories.has(slug);
  }

  create(slug: string, roomId: string, config?: unknown): BaseGame {
    const factory = this.factories.get(slug);
    if (!factory) {
      throw new Error(`No game implementation registered for slug "${slug}"`);
    }
    return factory(roomId, config);
  }

  listRegisteredSlugs(): string[] {
    return Array.from(this.factories.keys());
  }
}

export const GameRegistry = new GameRegistryClass();
