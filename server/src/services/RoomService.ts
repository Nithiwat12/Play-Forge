import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { generateRoomCode } from "../utils/roomCode";
import { GameService } from "./GameService";
import type { CreateRoomInput, JoinRoomInput } from "../utils/validators";
import type { PublicRoom, PublicRoomPlayer, RoomSettings } from "../types";

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
    settings: (room.settings as RoomSettings | null) ?? null,
    createdAt: room.createdAt.toISOString(),
  };
}

async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const existing = await prisma.room.findUnique({ where: { roomCode: code } });
    if (!existing) return code;
  }
  throw ApiError.internal("สร้างรหัสห้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
}

async function findByCode(roomCode: string): Promise<RoomWithRelations> {
  const room = await prisma.room.findUnique({
    where: { roomCode: roomCode.toUpperCase() },
    include: roomWithRelations,
  });
  if (!room) throw ApiError.notFound("ไม่พบห้องนี้");
  return room;
}

async function findById(roomId: string): Promise<RoomWithRelations> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: roomWithRelations,
  });
  if (!room) throw ApiError.notFound("ไม่พบห้องนี้");
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
    if (!game.isActive) throw ApiError.badRequest(`เกม "${input.gameSlug}" ไม่พร้อมใช้งาน`);

    if (input.maxPlayers > game.maxPlayers || input.maxPlayers < game.minPlayers) {
      throw ApiError.badRequest(
        `${game.name} รองรับผู้เล่นระหว่าง ${game.minPlayers} ถึง ${game.maxPlayers} คน`
      );
    }

    const roomCode = await generateUniqueRoomCode();
    const passwordHash =
      input.usePassword && input.password
        ? await bcrypt.hash(input.password, ROOM_PASSWORD_SALT_ROUNDS)
        : null;

    // Minutes are friendlier for a host to type; the engine works in
    // seconds, so the conversion happens once, right at creation time.
    const settings: RoomSettings | undefined =
      input.settings?.discussionMinutes || input.settings?.numberOfRounds
        ? {
            ...(input.settings.discussionMinutes
              ? { discussionSeconds: input.settings.discussionMinutes * 60 }
              : {}),
            ...(input.settings.numberOfRounds
              ? { numberOfRounds: input.settings.numberOfRounds }
              : {}),
          }
        : undefined;

    const room = await prisma.room.create({
      data: {
        gameId: game.id,
        roomCode,
        roomName: input.roomName,
        hostId,
        passwordHash,
        maxPlayers: input.maxPlayers,
        settings: settings as any,
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
      throw ApiError.conflict("เกมนี้เริ่มไปแล้ว");
    }

    if (room.players.length >= room.maxPlayers) {
      throw ApiError.conflict("ห้องนี้เต็มแล้ว");
    }

    if (room.passwordHash) {
      if (!input.password) {
        throw ApiError.forbidden("ห้องนี้ต้องใช้รหัสผ่าน");
      }
      const valid = await bcrypt.compare(input.password, room.passwordHash);
      if (!valid) {
        throw ApiError.forbidden("รหัสผ่านห้องไม่ถูกต้อง");
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
    if (!player) throw ApiError.forbidden("คุณไม่ได้อยู่ในห้องนี้");

    await prisma.roomPlayer.update({ where: { id: player.id }, data: { isReady } });
    return toPublicRoom(await findById(roomId));
  },

  // Server-side validation for starting a game. Deliberately generic -
  // knows nothing about Spyfall or any specific game's rules.
  async assertCanStart(userId: string, roomId: string): Promise<RoomWithRelations> {
    const room = await findById(roomId);

    if (room.hostId !== userId) {
      throw ApiError.forbidden("เฉพาะโฮสต์เท่านั้นที่เริ่มเกมได้");
    }
    if (room.status !== "WAITING") {
      throw ApiError.conflict("เกมเริ่มไปแล้วหรือจบไปแล้ว");
    }
    if (room.players.length < room.game.minPlayers) {
      throw ApiError.badRequest(
        `${room.game.name} ต้องมีผู้เล่นอย่างน้อย ${room.game.minPlayers} คนถึงจะเริ่มได้`
      );
    }
    if (room.players.some((p) => !p.isReady)) {
      throw ApiError.badRequest("ผู้เล่นยังไม่พร้อมครบทุกคน");
    }

    const settings = (room.settings as RoomSettings | null) ?? null;
    if (settings?.numberOfRounds) {
      const roundsPlayed = await prisma.gameSession.count({
        where: { roomId, status: "COMPLETED" },
      });
      if (roundsPlayed >= settings.numberOfRounds) {
        throw ApiError.conflict("เล่นครบจำนวนรอบที่กำหนดไว้แล้ว");
      }
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

  // Host-only: dissolves the room entirely for every player at once (unlike
  // leaveRoomById, which only removes the one leaving player and migrates
  // host status). Marks every active seat as left and closes the room out,
  // the same terminal state a room reaches when its last player leaves.
  async disbandRoom(hostId: string, roomId: string): Promise<void> {
    const room = await findById(roomId);
    if (room.hostId !== hostId) {
      throw ApiError.forbidden("เฉพาะโฮสต์เท่านั้นที่ยุบห้องได้");
    }

    await closeRoomRecords(roomId);
  },

  // System-initiated equivalent of disbandRoom, with no host check - used
  // by the idle-lobby cleanup sweep to close out rooms nobody ever started
  // (or came back to) within the time limit.
  async forceCloseRoom(roomId: string): Promise<void> {
    await closeRoomRecords(roomId);
  },

  // Rooms still sitting in WAITING (lobby, game never started - or back in
  // the lobby after a round finished) whose last update was more than
  // `idleMs` ago. PLAYING rooms are never included here - a long
  // discussion round is not "idle", so this never risks cutting a live
  // game short.
  async findStaleWaitingRoomIds(idleMs: number): Promise<string[]> {
    const rooms = await prisma.room.findMany({
      where: {
        status: "WAITING",
        updatedAt: { lt: new Date(Date.now() - idleMs) },
      },
      select: { id: true },
    });
    return rooms.map((r) => r.id);
  },

  toPublicRoom,
};

async function closeRoomRecords(roomId: string): Promise<void> {
  await prisma.roomPlayer.updateMany({
    where: { roomId, leftAt: null },
    data: { leftAt: new Date() },
  });
  await prisma.room.update({ where: { id: roomId }, data: { status: "FINISHED" } });
}
