import { RoomService } from "./RoomService";
import { broadcastRoomClosed } from "../socket/roomSocket";
import type { AppServer } from "../socket/socketAuth";

const IDLE_WAITING_MS = 10 * 60 * 1000; // 10 minutes
const SWEEP_INTERVAL_MS = 60 * 1000; // check every minute

/**
 * Auto-disbands lobbies nobody has touched in a while. Scoped strictly to
 * WAITING-status rooms (never PLAYING) so a legitimate long discussion
 * round is never at risk of being torn down mid-game - only rooms that
 * are just sitting on the "waiting to start" screen with no activity.
 *
 * "Idle" is approximated as "10 minutes since the Room row itself last
 * changed" (host leaving, players readying up, settings changes, etc. all
 * touch Room.updatedAt via Prisma's @updatedAt). This is a practical
 * definition rather than a perfectly exhaustive activity log, but it
 * covers every action that actually matters in a WAITING room.
 */
export function startRoomCleanupSweep(io: AppServer): NodeJS.Timeout {
  return setInterval(() => {
    sweepStaleRooms(io).catch((err) => {
      console.error("Room cleanup sweep failed:", err);
    });
  }, SWEEP_INTERVAL_MS);
}

async function sweepStaleRooms(io: AppServer): Promise<void> {
  const staleRoomIds = await RoomService.findStaleWaitingRoomIds(IDLE_WAITING_MS);

  for (const roomId of staleRoomIds) {
    try {
      await RoomService.forceCloseRoom(roomId);
      await broadcastRoomClosed(io, roomId, "ห้องนี้ถูกยุบเนื่องจากไม่มีความเคลื่อนไหวเกิน 10 นาที");
    } catch (err) {
      console.error(`Failed to auto-disband stale room ${roomId}:`, err);
    }
  }
}
