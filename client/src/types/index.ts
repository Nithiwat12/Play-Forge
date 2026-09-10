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
  createdAt: string;
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
