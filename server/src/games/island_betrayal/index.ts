import { GameRegistry } from "../core/GameRegistry";
import { IslandBetrayalGame } from "./IslandBetrayalGame";
GameRegistry.register("island_betrayal", roomId => new IslandBetrayalGame(roomId));
export { IslandBetrayalGame };
