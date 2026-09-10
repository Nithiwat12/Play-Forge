import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { socketAuthMiddleware, type AppServer } from "./socketAuth";
import { registerRoomSocket } from "./roomSocket";
import { registerGameSocket } from "./gameSocket";

export function createSocketServer(httpServer: HttpServer): AppServer {
  const io: AppServer = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin,
      credentials: true,
    },
    // More tolerant than the library defaults (20s/25s) for flaky mobile
    // connections - a slow ping response shouldn't be treated as a dead
    // connection and force a full reconnect + room rejoin cycle when the
    // socket is actually still fine.
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    registerRoomSocket(io, socket);
    registerGameSocket(io, socket);
  });

  return io;
}
