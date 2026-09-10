import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { generateRoomCode } from "../utils/roomCode";
import { GameService } from "./GameService";
import type { CreateRoomInput, JoinRoomInput } from "../utils/validators";
import type { PublicRoom, PublicRoomPlayer } from "../types";

const ROOM_PASSWORD_SALT_ROUNDS = 10;
const MAX_CODE_ATTEMPTS = 10;

// Prisma `include` shape shared by every query that needs to build a
// PublicRoom, kept in one place so the two never drift apart.
const roomWithRelations = {
  game: true,
  host: true,
  players: {
    where: { leftAt: null },
    include: { user: true },
    orderBy: { joinedAt: "asc" as const },
  },
} satisfies Prisma.RoomInclude;

type RoomWithRelations = Prisma.RoomGetPayload<{ include: typeof roomWithRelations }>;

function toPublicRoom(room: RoomWithRelations): PublicRoom {
  const players: PublicRoomPlayer[] = room.players.map((p) => ({
    userId: p.userId,
    username: p.user.username,
    isHost: p.isHost,
    isReady: p.isReady,
    joinedAt: p.joinedAt.toISOString(),
    // REST responses can't know live socket presence; the socket layer
    // overlays real connected/disconnected status for anything realtime.
    connected: true,
  }));

  return {
    id: room.id,
    roomCode: room.roomCode,
    roomName: room.roomName,
    hasPassword: Boolean(room.passwordHash),
    maxPlayers: room.maxPlayers,
    status: room.status,
    game: {
      id: room.game.id,
      name: room.game.name,
      slug: room.game.slug,
      description: room.game.description,
      minPlayers: room.game.minPlayers,
      maxPlayers: room.game.maxPlayers,
      isActive: room.game.isActive,
    },
    hostId: room.hostId,
    players,
    createdAt: room.createdAt.toISOString(),
  };
}

async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const existing = await prisma.room.findUnique({ where: { roomCode: code } });
    if (!existing) return code;
  }
  throw ApiError.internal("Could not generate a unique room code, please try again");
}

async function findByCode(roomCode: string): Promise<RoomWithRelations> {
  const room = await prisma.room.findUnique({
    where: { roomCode: roomCode.toUpperCase() },
    include: roomWithRelations,
  });
  if (!room) throw ApiError.notFound("Room not found");
  return room;
}

async function findById(roomId: string): Promise<RoomWithRelations> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: roomWithRelations,
  });
  if (!room) throw ApiError.notFound("Room not found");
  return room;
}

/**
 * Core Room System. REST endpoints identify rooms by their human-facing
 * roomCode (what a player types in); the Socket.IO layer identifies rooms
 * by their DB id (used as the Socket.IO room name once a client has
 * joined). Both paths funnel through the same validation logic below so
 * the rules can never diverge between REST and realtime.
 */
export const RoomService = {
  async createRoom(hostId: string, input: CreateRoomInput): Promise<PublicRoom> {
    const game = await GameService.getBySlug(input.gameSlug);
    if (!game.isActive) throw ApiError.badRequest(`Game "${input.gameSlug}" is not available`);

    if (input.maxPlayers > game.maxPlayers || input.maxPlayers < game.minPlayers) {
      throw ApiError.badRequest(
        `${game.name} supports between ${game.minPlayers} and ${game.maxPlayers} players`
      );
    }

    const roomCode = await generateUniqueRoomCode();
    const passwordHash =
      input.usePassword && input.password
        ? await bcrypt.hash(input.password, ROOM_PASSWORD_SALT_ROUNDS)
        : null;

    const room = await prisma.room.create({
      data: {
        gameId: game.id,
        roomCode,
        roomName: input.roomName,
        hostId,
        passwordHash,
        maxPlayers: input.maxPlayers,
        players: {
          create: {
            userId: hostId,
            isHost: true,
            isReady: false,
          },
        },
      },
      include: roomWithRelations,
    });

    return toPublicRoom(room);
  },

  async getPublicRoomByCode(roomCode: string): Promise<PublicRoom> {
    return toPublicRoom(await findByCode(roomCode));
  },

  async getPublicRoomById(roomId: string): Promise<PublicRoom> {
    return toPublicRoom(await findById(roomId));
  },

  /** Internal room record (with hostId/gameId/etc) looked up by DB id. */
  async getRoomById(roomId: string): Promise<RoomWithRelations> {
    return findById(roomId);
  },

  // Validates and applies a join. Used by both the REST join endpoint and
  // the room:join socket handler so the rules can never diverge.
  async joinRoom(userId: string, input: JoinRoomInput): Promise<PublicRoom> {
    const room = await findByCode(input.roomCode);

    const alreadyIn = room.players.find((p) => p.userId === userId);
    if (alreadyIn) {
      return toPublicRoom(room);
    }

    if (room.status !== "WAITING") {
      throw ApiError.conflict("This game has already started");
    }

    if (room.players.length >= room.maxPlayers) {
      throw ApiError.conflict("This room is full");
    }

    if (room.passwordHash) {
      if (!input.password) {
        throw ApiError.forbidden("This room requires a password");
      }
      const valid = await bcrypt.compare(input.password, room.passwordHash);
      if (!valid) {
        throw ApiError.forbidden("Incorrect room password");
      }
    }

    // A player who previously left this exact room already has a
    // RoomPlayer row (roomId+userId is unique) with leftAt set - rejoining
    // must reactivate that row rather than INSERT a duplicate, which would
    // violate the unique constraint. Rejoining never restores host status;
    // that only ever comes from initial creation or leave-triggered
    // migration below.
    await prisma.roomPlayer.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      create: { roomId: room.id, userId, isHost: false, isReady: false },
      update: { leftAt: null, isReady: false, isHost: false },
    });

    return toPublicRoom(await findByCode(input.roomCode));
  },

  async leaveRoomByCode(userId: string, roomCode: string): Promise<PublicRoom | null> {
    const room = await findByCode(roomCode);
    return this.leaveRoomInternal(userId, room);
  },

  async leaveRoomById(userId: string, roomId: string): Promise<PublicRoom | null> {
    const room = await findById(roomId);
    return this.leaveRoomInternal(userId, room);
  },

  async leaveRoomInternal(userId: string, room: RoomWithRelations): Promise<PublicRoom | null> {
    const player = room.players.find((p) => p.userId === userId);
    if (!player) return toPublicRoom(room);

    const remaining = room.players.filter((p) => p.userId !== userId);

    if (remaining.length === 0) {
      await prisma.roomPlayer.update({
        where: { id: player.id },
        data: { leftAt: new Date() },
      });
      await prisma.room.update({ where: { id: room.id }, data: { status: "FINISHED" } });
      return null;
    }

    // Host migration: promote the longest-tenured remaining player, and
    // strip host status from the leaving player's own row so a later
    // rejoin can never resurrect stale host status.
    if (player.isHost) {
      const newHost = remaining[0];
      await prisma.roomPlayer.update({
        where: { id: player.id },
        data: { leftAt: new Date(), isHost: false },
      });
      await prisma.roomPlayer.update({
        where: { id: newHost.id },
        data: { isHost: true },
      });
      await prisma.room.update({ where: { id: room.id }, data: { hostId: newHost.userId } });
    } else {
      await prisma.roomPlayer.update({
        where: { id: player.id },
        data: { leftAt: new Date() },
      });
    }

    return toPublicRoom(await findById(room.id));
  },

  async setReadyById(userId: string, roomId: string, isReady: boolean): Promise<PublicRoom> {
    const room = await findById(roomId);
    const player = room.players.find((p) => p.userId === userId);
    if (!player) throw ApiError.forbidden("You are not in this room");

    await prisma.roomPlayer.update({ where: { id: player.id }, data: { isReady } });
    return toPublicRoom(await findById(roomId));
  },

  // Server-side validation for starting a game. Deliberately generic -
  // knows nothing about Spyfall or any specific game's rules.
  async assertCanStart(userId: string, roomId: string): Promise<RoomWithRelations> {
    const room = await findById(roomId);

    if (room.hostId !== userId) {
      throw ApiError.forbidden("Only the host can start the game");
    }
    if (room.status !== "WAITING") {
      throw ApiError.conflict("Game has already started or finished");
    }
    if (room.players.length < room.game.minPlayers) {
      throw ApiError.badRequest(
        `${room.game.name} needs at least ${room.game.minPlayers} players to start`
      );
    }

    return room;
  },

  async markPlaying(roomId: string) {
    await prisma.room.update({ where: { id: roomId }, data: { status: "PLAYING" } });
  },

  async markFinished(roomId: string) {
    await prisma.room.update({ where: { id: roomId }, data: { status: "FINISHED" } });
  },

  async markWaiting(roomId: string) {
    await prisma.room.update({ where: { id: roomId }, data: { status: "WAITING" } });
  },

  /** Called when a game ends and the room returns to its lobby. */
  async resetReadiness(roomId: string) {
    await prisma.roomPlayer.updateMany({
      where: { roomId, leftAt: null },
      data: { isReady: false },
    });
  },

  toPublicRoom,
};
