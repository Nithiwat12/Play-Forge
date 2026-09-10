import { RoomService } from "../services/RoomService";
import { GameManager } from "../games/core/GameManager";
import { GameSessionService } from "../services/GameSessionService";
import { RoomPresence } from "./roomPresence";
import { withPresence } from "./socketUtils";
import { joinRoomSchema } from "../utils/validators";
import type { AppServer, AppSocket } from "./socketAuth";

type Ack = (response: { ok: true; room?: unknown } | { ok: false; error: string }) => void;
const noopAck: Ack = () => {};

/**
 * Shared teardown broadcast for "this room no longer exists" - used both
 * by the host-initiated room:disband handler below and by the idle-lobby
 * auto-disband sweep (see RoomCleanupService), so the two call sites can
 * never drift out of sync. Kicks every connected member back to their
 * home screen with one message, then clears their socket-room membership
 * and presence bookkeeping.
 */
export async function broadcastRoomClosed(io: AppServer, roomId: string, message: string) {
  io.to(roomId).emit("room:disbanded", { message });

  const socketsInRoom = await io.in(roomId).fetchSockets();
  for (const memberSocket of socketsInRoom) {
    memberSocket.leave(roomId);
    delete memberSocket.data.currentRoomId;
  }
  RoomPresence.clearRoom(roomId);
}

/**
 * Generic room lifecycle events, shared by every game on the platform.
 * Nothing in this file knows anything about Spyfall or any other specific
 * game - game rules only ever run inside GameManager/BaseGame. Once a
 * client has joined a room, the room's DB id (not its human-facing code)
 * is used as the Socket.IO room name and as the identifier in every
 * subsequent room:* / game:* event.
 */
export function registerRoomSocket(io: AppServer, socket: AppSocket) {
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

        // If a game is already running in this room (a player rejoining
        // after a disconnect, or navigating straight into /play/:roomCode
        // for a match already in progress), push that socket a state
        // snapshot immediately. Without this, the client sits on its
        // loading spinner forever - the only other place state is ever
        // broadcast is on the engine's STATE_CHANGED/ENDED events, which
        // only fire in response to some *other* player's next action.
        const activeGame = GameManager.getGame(room.id);
        if (activeGame) {
          socket.emit("game:state", {
            public: activeGame.getPublicState(),
            private: activeGame.getPrivateState(userId),
          });
        }

        ack({ ok: true, room: updated });
      } catch (err) {
        ack({ ok: false, error: err instanceof Error ? err.message : "เข้าห้องไม่สำเร็จ" });
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
      ack({ ok: false, error: err instanceof Error ? err.message : "ออกจากห้องไม่สำเร็จ" });
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
          error: err instanceof Error ? err.message : "อัปเดตสถานะความพร้อมไม่สำเร็จ",
        });
      }
    }
  );

  // Host-only: dissolves the room for everyone at once (leaving isn't
  // enough when the host wants to shut the whole thing down rather than
  // just hand off hosting). Ends any active game in memory, closes out its
  // DB session if one was running, then kicks every connected member back
  // to their home screen with one broadcast.
  socket.on("room:disband", async ({ roomId }: { roomId: string }, ack: Ack = noopAck) => {
    try {
      await RoomService.disbandRoom(userId, roomId);
      await GameSessionService.abortActiveForRoom(roomId);
      GameManager.endGame(roomId);

      await broadcastRoomClosed(io, roomId, "โฮสต์ได้ยุบห้องนี้แล้ว");

      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: err instanceof Error ? err.message : "ยุบห้องไม่สำเร็จ" });
    }
  });

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
