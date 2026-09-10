import { createServer } from "http";
import { createApp } from "./app";
import { createSocketServer } from "./socket";
import { env } from "./config/env";
import "./games/registerGames"; // side-effect: populates GameRegistry

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Board Game Platform server listening on port ${env.port} (${env.nodeEnv})`);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
