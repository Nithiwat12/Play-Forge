// Platform-wide contracts for the game engine. Nothing here may reference
// a specific game (e.g. Spyfall) - that separation is what lets the room
// and socket systems stay generic.

export interface GamePlayer {
  userId: string;
  username: string;
}

// Thrown by BaseGame.handleAction implementations when a client sends an
// action that is invalid given the current game state or the player's
// permissions. The socket layer catches this and relays only the message
// (never a stack trace) back to the offending client.
export class GameActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameActionError";
  }
}

// Returned by BaseGame.end() and persisted verbatim as GameHistory.resultData.
// Each game defines its own shape for `details`.
export interface GameResult {
  summary: string;
  winnerUserIds: string[];
  details: Record<string, unknown>;
}

export const GAME_ENGINE_EVENTS = {
  // Emitted whenever public and/or private state changes and clients need
  // a fresh push. Payload: none - listeners re-read state via the getters.
  STATE_CHANGED: "stateChanged",
  // Emitted exactly once when the game concludes on its own (e.g. timer
  // expiry, win condition), as opposed to being ended by the room system.
  ENDED: "ended",
} as const;
