import { create } from "zustand";

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
  setState: (publicState: unknown, privateState: unknown) => void;
  setResult: (result: GameResultEnvelope) => void;
  clear: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  publicState: null,
  privateState: null,
  lastResult: null,
  setState: (publicState, privateState) => set({ publicState, privateState }),
  setResult: (lastResult) => set({ lastResult }),
  clear: () => set({ publicState: null, privateState: null, lastResult: null }),
}));
