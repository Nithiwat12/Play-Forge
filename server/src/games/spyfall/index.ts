import { GameRegistry } from "../core/GameRegistry";
import { SpyfallGame } from "./SpyfallGame";

// Self-registers on import. src/games/registerGames.ts imports every
// game module's index once at server startup, purely for this side effect.
GameRegistry.register("spyfall", (roomId: string) => new SpyfallGame(roomId));

export { SpyfallGame };
