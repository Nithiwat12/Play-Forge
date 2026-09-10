import { GameManager } from "../games/core/GameManager";
import { GAME_ENGINE_EVENTS } from "../games/core/types";
import type { BaseGame } from "../games/core/BaseGame";
import { RoomService } from "../services/RoomService";
import { GameSessionService } from "../services/GameSessionService";
import { ScoreboardService } from "../services/ScoreboardService";
import { withPresence } from "./socketUtils";
import type { AppServer, AppSocket } from "./socketAuth";

type Ack = (response: { ok: true } | { ok: false; error: string }) => void;
const noopAck: Ack = () => {};

interface ActiveSessionInfo {
  sessionId: string;
}

// roomId -> the GameSession row backing the currently active game, so the
// result can be persisted once the engine reports it has ended.
const activeSessions = new Map<string, ActiveSessionInfo>();

/**
 * Pushes a fresh state snapshot to every socket currently in the room -
 * individually, because each player's private state differs. This is the
 * one place in the whole platform where "never broadcast every player's
 * role to every client" is enforced: getPrivateState(userId) is computed
 * per-socket and sent only to that socket.
 */
function broadcastGameState(io: AppServer, roomId: string, game: BaseGame) {
  const socketIds = io.sockets.adapter.rooms.get(roomId);
  if (!socketIds) return;

  const publicState = game.getPublicState();
  for (const socketId of socketIds) {
    const memberSocket = io.sockets.sockets.get(socketId);
    if (!memberSocket) continue;
    const privateState = game.getPrivateState(memberSocket.data.user.id);
    memberSocket.emit("game:state", { public: publicState, private: privateState });
  }
}

async function finalizeGame(io: AppServer, roomId: string) {
  // Guards against running twice for the same game. A host-forced end
  // calls this directly, which calls GameManager.endGame -> game.end(),
  // and if the engine hadn't concluded naturally yet that call itself
  // synchronously emits ENDED - re-entering this function before the
  // first call has gone any further. Claiming (deleting) the session
  // immediately, before awaiting anything, makes the second entry a
  // no-op instead of double-finalizing.
  const session = activeSessions.get(roomId);
  if (!session) return;
  activeSessions.delete(roomId);

  const result = GameManager.endGame(roomId);
  if (!result) return;

  await GameSessionService.finalizeSession(session.sessionId, result);

  await RoomService.markWaiting(roomId);
  await RoomService.resetReadiness(roomId);

  const scoreboard = await ScoreboardService.getScoreboardByRoomId(roomId).catch(() => null);
  io.to(roomId).emit("game:end", { result, scoreboard });

  const room = await RoomService.getPublicRoomById(roomId).catch(() => null);
  if (room) {
    io.to(roomId).emit("room:update", { room: withPresence(room) });
  }
}

export function registerGameSocket(io: AppServer, socket: AppSocket) {
  const userId = socket.data.user.id;

  socket.on("game:start", async ({ roomId }: { roomId: string }, ack: Ack = noopAck) => {
    try {
      const room = await RoomService.assertCanStart(userId, roomId);
      const players = room.players.map((p) => ({ userId: p.userId, username: p.user.username }));

      const game = GameManager.startGame(room.id, room.game.slug, players, room.settings ?? undefined);

      const session = await GameSessionService.createSession(room.id, room.gameId);
      activeSessions.set(room.id, { sessionId: session.id });

      await RoomService.markPlaying(room.id);

      game.on(GAME_ENGINE_EVENTS.STATE_CHANGED, () => broadcastGameState(io, room.id, game));
      game.on(GAME_ENGINE_EVENTS.ENDED, () => {
        finalizeGame(io, room.id).catch((err) => console.error("Failed to finalize game:", err));
      });

      const updatedRoom = await RoomService.getPublicRoomById(room.id);
      // Broadcast confirmation that the game has begun (spec's generic
      // "game:start" event), then push everyone's first state snapshot.
      io.to(room.id).emit("game:start", { room: withPresence(updatedRoom) });
      broadcastGameState(io, room.id, game);

      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: err instanceof Error ? err.message : "เริ่มเกมไม่สำเร็จ" });
    }
  });

  // Generic action channel. `actionType` follows the namespaced pattern
  // (e.g. "spyfall:vote") but this file never interprets it - it is
  // forwarded verbatim to whatever game is active for the room, which is
  // the only place that knows what it means. Never trust `payload` here;
  // each game's handleAction is responsible for validating it itself.
  socket.on(
    "game:action",
    (
      { roomId, actionType, payload }: { roomId: string; actionType: string; payload: unknown },
      ack: Ack = noopAck
    ) => {
      try {
        GameManager.handleAction(roomId, userId, actionType, payload);
        ack({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "การกระทำในเกมไม่ถูกต้อง";
        socket.emit("game:error", { message });
        ack({ ok: false, error: message });
      }
    }
  );

  // Lets the host abort an in-progress game early; natural conclusions
  // (timer expiry, vote resolution, a correct/incorrect spy guess) are
  // triggered by the engine itself via the ENDED event above.
  socket.on("game:end", async ({ roomId }: { roomId: string }, ack: Ack = noopAck) => {
    try {
      const room = await RoomService.getRoomById(roomId);
      if (room.hostId !== userId) {
        throw new Error("เฉพาะโฮสต์เท่านั้นที่จบเกมได้");
      }
      await finalizeGame(io, roomId);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: err instanceof Error ? err.message : "จบเกมไม่สำเร็จ" });
    }
  });
}
