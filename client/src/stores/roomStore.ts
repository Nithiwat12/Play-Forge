import { create } from "zustand";
import type { Room } from "../types";

interface RoomState {
  room: Room | null;
  setRoom: (room: Room) => void;
  clearRoom: () => void;
}

// Holds the current room's platform-level state (players, host, status).
// Game-specific state (Spyfall's public/private state) lives in gameStore
// instead, so this store stays reusable for every future game.
export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  clearRoom: () => set({ room: null }),
}));
