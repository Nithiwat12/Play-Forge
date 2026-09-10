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
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    registerRoomSocket(io, socket);
    registerGameSocket(io, socket);
  });

  return io;
}
