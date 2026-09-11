// Shared platform-level types used across services, controllers, and the
// socket layer. Game-specific types live inside each game's own module
// (e.g. src/games/spyfall/SpyfallState.ts) and are never imported here.

export interface JwtPayload {
  sub: string; // user id
  username: string;
  email: string;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

export interface PublicGame {
  id: string;
  name: string;
  slug: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  isActive: boolean;
}

export type RoomStatusValue = "WAITING" | "PLAYING" | "FINISHED";

export interface PublicRoomPlayer {
  userId: string;
  username: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: string;
  connected: boolean;
}

// Opaque, game-agnostic settings blob a host can set at room creation.
// Shape-wise it's still Spyfall-only today (Spyfall is the only game
// registered), but living on Room.settings as JSON means adding a second
// game's own settings later needs no schema change here.
export interface RoomSettings {
  discussionSeconds?: number;
  // How many rounds this room's match runs for. Unset = unlimited (the
  // host can keep hitting "replay" indefinitely).
  numberOfRounds?: number;
  // How the location/topic for each round gets picked. Unset/"RANDOM" =
  // every round draws from every location, no restriction. "FIXED" =
  // every round of this match is restricted to `category` (chosen once at
  // room creation). "PER_ROUND" = restricted to `category` too, but the
  // host re-picks (or repeats) it before each round after the first - see
  // gameSocket's pendingCategoryPicks, which is what actually updates
  // `category` here between rounds via RoomService.setNextRoundCategory.
  categoryMode?: "RANDOM" | "FIXED" | "PER_ROUND";
  category?: string;
}

export interface PublicRoom {
  id: string;
  roomCode: string;
  roomName: string;
  hasPassword: boolean;
  maxPlayers: number;
  status: RoomStatusValue;
  game: PublicGame;
  hostId: string;
  players: PublicRoomPlayer[];
  settings: RoomSettings | null;
  createdAt: string;
  // Whether this room has already played out its configured round limit -
  // set only by UserService's active/left-rooms lookups (which already pay
  // for the round-count query for their own listing UI), so it's undefined
  // everywhere else. A room with no numberOfRounds configured is never
  // "complete" this way. See ScoreboardService.matchComplete for the
  // authoritative version computed from a room's actual scoreboard.
  matchComplete?: boolean;
}
