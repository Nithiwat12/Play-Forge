import type { PublicRoom } from "../types";
import { RoomPresence } from "./roomPresence";
import type { AppServer } from "./socketAuth";

/** Overlays live socket presence onto a DB-derived PublicRoom snapshot. */
export function withPresence(room: PublicRoom): PublicRoom {
  return {
    ...room,
    players: room.players.map((p) => ({
      ...p,
      connected: RoomPresence.isConnected(room.id, p.userId),
    })),
  };
}

/**
 * Shared teardown broadcast for "this room no longer exists" - used by the
 * host-initiated room:disband handler, the idle-lobby auto-disband sweep
 * (RoomCleanupService), and the match-complete auto-close (gameSocket's
 * finalizeGame), so none of those call sites can ever drift out of sync.
 * Kicks every connected member back to their home screen with one message,
 * then clears their socket-room membership and presence bookkeeping.
 *
 * Lives here rather than in roomSocket.ts specifically so gameSocket.ts can
 * import it too without the two socket modules importing each other.
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
 * Host-initiated removal of ONE other player (room:kick) - unlike
 * broadcastRoomClosed above, only that player's own socket(s) get the
 * "you're out" event and get pulled out of the Socket.IO room; everyone
 * else just sees the normal room:update roster refresh the caller sends
 * separately. A user can have more than one socket open (multiple tabs),
 * so every one of them needs to hear about it and leave.
 */
export async function broadcastPlayerKicked(
  io: AppServer,
  roomId: string,
  targetUserId: string,
  message: string
) {
  const socketsInRoom = await io.in(roomId).fetchSockets();
  for (const memberSocket of socketsInRoom) {
    if (memberSocket.data.user.id !== targetUserId) continue;
    memberSocket.emit("room:kicked", { message });
    memberSocket.leave(roomId);
    delete memberSocket.data.currentRoomId;
  }
  RoomPresence.removeUser(roomId, targetUserId);
}
