import { GameRegistry } from "../core/GameRegistry";
import { WordHeadGame, type WordHeadConfig } from "./WordHeadGame";

// Self-registers on import - see registerGames.ts.
GameRegistry.register(
  "wordhead",
  (roomId: string, config?: unknown) => new WordHeadGame(roomId, config as WordHeadConfig | undefined)
);

export { WordHeadGame };
