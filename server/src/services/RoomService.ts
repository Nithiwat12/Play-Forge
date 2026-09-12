import { GameRegistry } from "../games/core/GameRegistry";
import { resolveRoleCounts, roleConfigSchema } from "../games/core/roles";
import { islandConfigSchema } from "../games/island_betrayal/config";
import bcrypt from "bcryptjs";
import { GameManager } from "../games/core/GameManager";
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
export const roomWithRelations = {
  game: true,
  players: {
    where: { leftAt: null },
    include: { user: { select: { id: true, username: true } } },
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
      roleDefinitions: GameRegistry.getRoleDefinitions(room.game.slug),
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

// The room-state half of "can a round start right now" - status and minimum
// headcount. Shared by both assertCanStart (which adds its own host-only/
// everyone-ready checks on top) and assertRoomCanStartRound (which doesn't
// need those, since the continue-vote system's majority "yes" is its own
// consent mechanism).
//
// Deliberately does NOT block on settings.numberOfRounds being reached
// anymore - that used to hard-stop here and the room would auto-close
// shortly after (see the old scheduleMatchCompleteDisband), but there's no
// real reason finishing a configured round count has to end the room: the
// group might well want to keep playing together. Scoreboard.matchComplete
// still flips true right on schedule for the "🏆 played all N rounds"
// banner/table - this just no longer treats that as a reason to refuse
// another round.
async function assertRoundCanStart(room: RoomWithRelations): Promise<void> {
  if (room.status !== "WAITING") {
    throw ApiError.conflict("เกมเริ่มไปแล้วหรือจบไปแล้ว");
  }
  if (room.players.length < room.game.minPlayers) {
    throw ApiError.badRequest(
      `${room.game.name} ต้องมีผู้เล่นอย่างน้อย ${room.game.minPlayers} คนถึงจะเริ่มได้`
    );
  }
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

    const definitions = GameRegistry.getRoleDefinitions(game.slug);
    if (input.settings?.roleConfig && definitions.length === 0) throw ApiError.badRequest("เกมนี้ยังไม่รองรับการตั้งค่าบทบาท");
    if (definitions.length) resolveRoleCounts(definitions, input.settings?.roleConfig, input.maxPlayers);
    const roomCode = await generateUniqueRoomCode();
    const passwordHash =
      input.usePassword && input.password
        ? await bcrypt.hash(input.password, ROOM_PASSWORD_SALT_ROUNDS)
        : null;

    // Minutes are friendlier for a host to type; the engine works in
    // seconds, so the conversion happens once, right at creation time.
    let settings: RoomSettings | undefined =
      game.slug !== "island_betrayal" && (
        input.settings?.discussionMinutes ||
        input.settings?.numberOfRounds ||
        input.settings?.categoryMode
      )
        ? {
            ...(input.settings.discussionMinutes
              ? { discussionSeconds: input.settings.discussionMinutes * 60 }
              : {}),
            ...(input.settings.numberOfRounds
              ? { numberOfRounds: input.settings.numberOfRounds }
              : {}),
            // "RANDOM" is the implicit default (no restriction) - only
            // persist a mode when it actually changes behavior, and only
            // carry `category` along for the modes that use it at all.
            ...(input.settings.categoryMode && input.settings.categoryMode !== "RANDOM"
              ? {
                  categoryMode: input.settings.categoryMode,
                  ...(input.settings.categoryMode === "FIXED" && input.settings.category
                    ? { category: input.settings.category }
                    : {}),
                }
              : {}),
          }
        : undefined;

    if (definitions.length) settings = { ...settings, roleConfig: input.settings?.roleConfig ?? {} };
    if (game.slug === "island_betrayal") settings = { ...settings, island: islandConfigSchema.parse(input.settings?.island ?? {}) };

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

    if (room.status === "FINISHED") throw ApiError.conflict("ห้องนี้ปิดแล้ว");

    const alreadyIn = room.players.find((p) => p.userId === userId);
    if (alreadyIn) {
      return toPublicRoom(room);
    }

    // Also recover seats left by clients from before room:pause existed.
    // Only the original engine roster may rejoin a round already underway.
    const originalPlayer = room.status === "PLAYING" &&
      GameManager.getGame(room.id)?.getPlayers().some((p) => p.userId === userId);
    if (originalPlayer) {
      await prisma.roomPlayer.update({
        where: { roomId_userId: { roomId: room.id, userId } },
        data: { leftAt: null, isReady: false, isHost: room.hostId === userId },
      });
      return toPublicRoom(await findById(room.id));
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

  // Host-only: forcibly removes ONE other player from the room while it's
  // still in its lobby (WAITING) - same DB effect as that player leaving on
  // their own (leaveRoomInternal handles host migration etc. too, though it
  // never applies here since a host can't kick themselves), just
  // host-initiated instead. Scoped to WAITING because that's the only place
  // this is offered in the UI (Lobby.tsx) - kicking mid-round would also
  // need the game engine to handle a forced removal, a different problem.
  async kickPlayer(hostId: string, roomId: string, targetUserId: string): Promise<PublicRoom | null> {
    const room = await findById(roomId);
    if (room.hostId !== hostId) {
      throw ApiError.forbidden("เฉพาะโฮสต์เท่านั้นที่เตะผู้เล่นออกได้");
    }
    if (targetUserId === hostId) {
      throw ApiError.badRequest("เตะตัวเองออกไม่ได้ - ใช้ปุ่มออกจากห้องหรือยุบห้องแทน");
    }
    if (room.status !== "WAITING") {
      throw ApiError.conflict("เตะผู้เล่นออกได้เฉพาะตอนอยู่ในห้องรอเท่านั้น");
    }
    const target = room.players.find((p) => p.userId === targetUserId);
    if (!target) {
      throw ApiError.notFound("ไม่พบผู้เล่นนี้ในห้องแล้ว");
    }

    return this.leaveRoomInternal(targetUserId, room);
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
    if (room.players.some((p) => !p.isReady)) {
      throw ApiError.badRequest("ผู้เล่นยังไม่พร้อมครบทุกคน");
    }

    await assertRoundCanStart(room);
    return room;
  },

  // Same room-state checks as assertCanStart (round limit, min players,
  // room status) but without the host-only or everyone-ready requirements -
  // used by the continue-vote system's auto-start, where the vote itself
  // (a majority saying "yes") already stands in for both of those.
  async assertRoomCanStartRound(roomId: string): Promise<RoomWithRelations> {
    const room = await findById(roomId);
    await assertRoundCanStart(room);
    return room;
  },

  async updateRoleConfig(userId: string, roomId: string, input: unknown): Promise<PublicRoom> {
    const room = await findById(roomId);
    if (room.hostId !== userId) throw ApiError.forbidden("เฉพาะหัวหน้าห้องที่ตั้งค่าบทบาทได้");
    if (room.status !== "WAITING" || GameManager.isGameActive(roomId)) throw ApiError.conflict("เริ่มเกมแล้ว เปลี่ยนบทบาทไม่ได้");
    const definitions = GameRegistry.getRoleDefinitions(room.game.slug);
    if (!definitions.length) throw ApiError.badRequest("เกมนี้ยังไม่รองรับการตั้งค่าบทบาท");
    const roleConfig = roleConfigSchema.parse(input);
    resolveRoleCounts(definitions, roleConfig, room.maxPlayers);
    await prisma.room.update({ where: { id: roomId }, data: { settings: { ...((room.settings as RoomSettings) ?? {}), roleConfig } as any } });
    await this.resetReadiness(roomId);
    return toPublicRoom(await findById(roomId));
  },

  async markPlaying(roomId: string) {
    await prisma.room.update({ where: { id: roomId }, data: { status: "PLAYING" } });
  },

  async markFinished(roomId: string) {
    await prisma.room.update({ where: { id: roomId }, data: { status: "FINISHED" } });
  },

  async markWaiting(roomId: string) {
    await prisma.room.updateMany({
      where: { id: roomId, status: "PLAYING" }, data: { status: "WAITING" },
    });
  },

  async prepareMatch(roomId: string): Promise<void> {
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { settings: true } });
    if (!room) throw ApiError.notFound("ไม่พบห้องนี้");
    const settings = (room.settings as RoomSettings | null) ?? {};
    const count = await prisma.gameSession.count({ where: { roomId, status: "COMPLETED" } });
    const rounds = Math.max(1, settings.numberOfRounds ?? 1);
    let offset = settings.matchRoundOffset ?? settings.spyfallRoundOffset ?? (count - count % rounds);
    if (count - offset >= rounds) offset = count;
    await prisma.room.update({ where: { id: roomId }, data: { settings: { ...settings, matchRoundOffset: offset } as any } });
  },

  async resetMatch(roomId: string): Promise<void> {
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { settings: true } });
    if (!room) throw ApiError.notFound("ไม่พบห้องนี้");
    const completed = await prisma.gameSession.count({ where: { roomId, status: "COMPLETED" } });
    const settings = (room.settings as RoomSettings | null) ?? {};
    await prisma.room.update({
      where: { id: roomId },
      data: { settings: { ...settings, matchRoundOffset: completed } as any },
    });
  },

  /** Called when a game ends and the room returns to its lobby. */
  async resetReadiness(roomId: string) {
    await prisma.roomPlayer.updateMany({
      where: { roomId, leftAt: null },
      data: { isReady: false },
    });
  },

  // Persists the host's category pick for the room's next round, in a
  // "PER_ROUND" category-mode match (see gameSocket's pendingCategoryPicks
  // and the "game:selectCategory" handler). Deliberately just merges into
  // the existing settings JSON rather than replacing it - reuses the exact
  // same `settings.category` field a "FIXED"-mode room sets once at
  // creation, so SpyfallGame.getLocationPool never needs to know which mode
  // put the value there.
  async setNextRoundCategory(roomId: string, category: string): Promise<void> {
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { settings: true } });
    if (!room) throw ApiError.notFound("ไม่พบห้องนี้");
    const settings = (room.settings as RoomSettings | null) ?? {};
    await prisma.room.update({
      where: { id: roomId },
      data: { settings: { ...settings, category } as any },
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
