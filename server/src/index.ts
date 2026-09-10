import { createServer } from "http";
import { createApp } from "./app";
import { createSocketServer } from "./socket";
import { GameSessionService } from "./services/GameSessionService";
import { env } from "./config/env";
import "./games/registerGames"; // side-effect: populates GameRegistry

const app = createApp();
const httpServer = createServer(app);
// Finish recovery before accepting joins or starting cleanup timers.
GameSessionService.recoverInterruptedGames().then(() => {
  createSocketServer(httpServer);
  httpServer.listen(env.port, () => {
    console.log(`Board Game Platform server listening on port ${env.port} (${env.nodeEnv})`);
  });
}).catch((error) => {
  console.error("Could not recover interrupted games:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
