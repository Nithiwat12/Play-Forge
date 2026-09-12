import { GameRegistry } from "../core/GameRegistry";
import { IslandBetrayalGame } from "./IslandBetrayalGame";
import { ISLAND_ROLES } from "./config";
GameRegistry.register("island_betrayal", (roomId, config) => new IslandBetrayalGame(roomId, config as ConstructorParameters<typeof IslandBetrayalGame>[1]), ISLAND_ROLES);
export { IslandBetrayalGame };
