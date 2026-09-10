import { GameRegistry } from "../core/GameRegistry";
import { SpyfallGame, type SpyfallConfig } from "./SpyfallGame";

// Self-registers on import. src/games/registerGames.ts imports every
// game module's index once at server startup, purely for this side effect.
// `config` arrives from the platform as opaque `unknown` (it's whatever
// JSON the host saved on the room at creation time) - only this factory
// knows to cast it to Spyfall's own config shape.
GameRegistry.register(
  "spyfall",
  (roomId: string, config?: unknown) => new SpyfallGame(roomId, config as SpyfallConfig | undefined)
);

export { SpyfallGame };
