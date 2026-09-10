import { create } from "zustand";
import type { Scoreboard } from "../types";

interface GameResultEnvelope {
  summary: string;
  winnerUserIds: string[];
  details: Record<string, unknown>;
}

interface GameState {
  // Deliberately untyped at this generic layer - each game's own
  // components (e.g. games/spyfall/*) cast these to that game's
  // SpyfallPublicState / SpyfallPrivateState. Never store another
  // player's private data here; the server only ever sends this socket
  // its own private state to begin with.
  publicState: unknown;
  privateState: unknown;
  lastResult: GameResultEnvelope | null;
  // Match-wide score table (game-agnostic - see ScoreboardService), kept
  // separate from publicState/privateState since it spans every round
  // played in the room, not just the current one.
  scoreboard: Scoreboard | null;
  setState: (publicState: unknown, privateState: unknown) => void;
  setResult: (result: GameResultEnvelope) => void;
  setScoreboard: (scoreboard: Scoreboard | null) => void;
  clear: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  publicState: null,
  privateState: null,
  lastResult: null,
  scoreboard: null,
  setState: (publicState, privateState) => set({ publicState, privateState }),
  setResult: (lastResult) => set({ lastResult }),
  setScoreboard: (scoreboard) => set({ scoreboard }),
  clear: () => set({ publicState: null, privateState: null, lastResult: null, scoreboard: null }),
}));
