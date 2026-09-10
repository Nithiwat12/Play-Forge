import type { PublicRoom } from "../types";
import { RoomPresence } from "./roomPresence";

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
