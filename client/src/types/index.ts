import type { RoleConfig, RoleDefinition } from "../components/roles/types";
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
  roleDefinitions?: RoleDefinition[];
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
  roleConfig?: RoleConfig;
  discussionSeconds?: number;
  numberOfRounds?: number;
  // How the location/topic for each round gets picked - see CreateRoom's
  // category section and games/spyfall/categories.ts for the id/label list.
  // Unset/"RANDOM" = no restriction. "FIXED" = the whole match is
  // restricted to `category`. "PER_ROUND" = restricted too, but the host
  // re-picks (or repeats) `category` before EVERY round, including the
  // first, via the "game:categoryPending"/"game:selectCategory" socket
  // exchange (see Lobby's and PlayPage's own CategoryPickerPrompt usage).
  categoryMode?: "RANDOM" | "FIXED" | "PER_ROUND";
  category?: string;
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
  // One entry per room now (see server UserService.getHistoryForUser) -
  // this is what HistoryPage's delete button targets, hiding every round
  // played in the room at once rather than just the round shown here.
  roomId: string;
  gameName: string;
  gameSlug: string;
  roomName: string;
  roomCode: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  resultData: unknown;
  // How many of this room's rounds are still in the user's history - only
  // ever > 1 when the room was actually replayed a few times.
  roundsInHistory: number;
  // Every player who sat in the room this round was played in - lets
  // GameResult.tsx resolve userIds inside resultData.details (e.g.
  // Spyfall's per-player scores map) into actual names.
  players: { userId: string; username: string }[];
}

export interface ApiErrorResponse {
  error: {
    message: string;
    details?: unknown;
  };
}
