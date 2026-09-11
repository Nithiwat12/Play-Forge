// Mirrors the platform's REST/socket payload shapes. Kept independent of
// the server package (no shared workspace lib) to keep client and server
// deployable and versioned separately.

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface Game {
  id: string;
  name: string;
  slug: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  isActive: boolean;
}

export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface RoomPlayer {
  userId: string;
  username: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: string;
  connected: boolean;
}

export interface RoomSettings {
  discussionSeconds?: number;
  numberOfRounds?: number;
}

export interface ScoreboardTotal {
  userId: string;
  username: string;
  total: number;
}

export interface RoundScoreEntry {
  round: number;
  winner: string;
  reason: string;
  spyUserId: string;
  spyUsername: string;
  scores: Record<string, number>;
}

export interface Scoreboard {
  numberOfRounds: number | null;
  roundsPlayed: number;
  matchComplete: boolean;
  rounds: RoundScoreEntry[];
  totals: ScoreboardTotal[];
  players: { userId: string; username: string }[];
}

export interface Room {
  id: string;
  roomCode: string;
  roomName: string;
  hasPassword: boolean;
  maxPlayers: number;
  status: RoomStatus;
  game: Game;
  hostId: string;
  players: RoomPlayer[];
  settings: RoomSettings | null;
  createdAt: string;
  // Only ever set on the rooms returned by /users/me/active-rooms and
  // /users/me/left-rooms (see server UserService.attachMatchComplete) -
  // true once the room has already played out its full configured round
  // count, so the History page can offer "view scoreboard" instead of
  // "rejoin" for it. Undefined everywhere else.
  matchComplete?: boolean;
}

export interface HistoryEntry {
  gameSessionId: string;
  gameName: string;
  gameSlug: string;
  roomName: string;
  roomCode: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  resultData: unknown;
}

export interface ApiErrorResponse {
  error: {
    message: string;
    details?: unknown;
  };
}
