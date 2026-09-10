import type { Server, Socket } from "socket.io";
import { RoomService } from "../services/RoomService";
import { GameManager } from "../games/core/GameManager";
import { RoomPresence } from "./roomPresence";
import { withPresence } from "./socketUtils";
import { joinRoomSchema } from "../utils/validators";

type Ack = (response: { ok: true; room?: unknown } | { ok: false; error: string }) => void;
const noopAck: Ack = () => {};

/**
 * Generic room lifecycle events, shared by every game on the platform.
 * Nothing in this file knows anything about Spyfall or any other specific
 * game - game rules only ever run inside GameManager/BaseGame. Once a
 * client has joined a room, the room's DB id (not its human-facing code)
 * is used as the Socket.IO room name and as the identifier in every
 * subsequent room:* / game:* event.
 */
export function registerRoomSocket(io: Server, socket: Socket) {
  const userId = socket.data.user.id;

  socket.on(
    "room:join",
    async (payload: { roomCode: string; password?: string }, ack: Ack = noopAck) => {
      try {
        const input = joinRoomSchema.parse(payload ?? {});
        const room = await RoomService.joinRoom(userId, input);

        socket.join(room.id);
        RoomPresence.addConnection(room.id, userId, socket.id);
        socket.data.currentRoomId = room.id;

        const updated = withPresence(room);
        socket.to(room.id).emit("room:playerJoined", {
          userId,
          username: socket.data.user.username,
        });
        io.to(room.id).emit("room:update", { room: updated });
        ack({ ok: true, room: updated });
      } catch (err) {
        ack({ ok: false, error: err instanceof Error ? err.message : "Failed to join room" });
      }
    }
  );

  socket.on("room:leave", async ({ roomId }: { roomId: string }, ack: Ack = noopAck) => {
    try {
      const room = await RoomService.leaveRoomById(userId, roomId);

      GameManager.removePlayer(roomId, userId);
      RoomPresence.removeConnection(roomId, userId, socket.id);
      socket.leave(roomId);
      delete socket.data.currentRoomId;

      socket.to(roomId).emit("room:playerLeft", { userId });
      if (room) {
        io.to(roomId).emit("room:update", { room: withPresence(room) });
      }
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: err instanceof Error ? err.message : "Failed to leave room" });
    }
  });

  socket.on(
    "room:ready",
    async ({ roomId, isReady }: { roomId: string; isReady: boolean }, ack: Ack = noopAck) => {
      try {
        const room = await RoomService.setReadyById(userId, roomId, Boolean(isReady));
        io.to(roomId).emit("room:update", { room: withPresence(room) });
        ack({ ok: true, room: withPresence(room) });
      } catch (err) {
        ack({
          ok: false,
          error: err instanceof Error ? err.message : "Failed to update ready state",
        });
      }
    }
  );

  socket.on("disconnect", () => {
    const roomId: string | undefined = socket.data.currentRoomId;
    if (!roomId) return;

    const fullyDisconnected = RoomPresence.removeConnection(roomId, userId, socket.id);
    if (!fullyDisconnected) return;

    // A dropped connection is NOT the same as an explicit room:leave - the
    // player keeps their seat (and their game role, if a game is active)
    // so they can reconnect. We only broadcast the updated presence.
    RoomService.getPublicRoomById(roomId)
      .then((room) => io.to(roomId).emit("room:update", { room: withPresence(room) }))
      .catch(() => {
        // Room may already be gone (e.g. everyone left) - nothing to update.
      });
  });
}
