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
  createdAt: string;
}
