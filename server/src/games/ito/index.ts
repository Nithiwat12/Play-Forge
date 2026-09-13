import { GameRegistry } from "../core/GameRegistry";
import { ItoGame } from "./ItoGame";
GameRegistry.register("ito", (roomId, config) => new ItoGame(roomId, config as { ito?: unknown } | undefined));
