import { matchKey } from "./matchMetadata";
import type { RoomSettings } from "../types";
import { prisma } from "../config/prisma";
import { RoomService, roomWithRelations } from "./RoomService";
import { ApiError } from "../utils/ApiError";
import type { PublicRoom } from "../types";

export interface HistoryEntry {
  gameSessionId: string;
  roomId: string;
  gameName: string;
  gameSlug: string;
  roomName: string;
  roomCode: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  resultData: unknown;
  // How many of this room's rounds are still visible in this user's history
  // (i.e. not individually hidden) - always >= 1 for an entry that made it
  // into the returned list at all. Shown so a room that was actually played
  // more than once doesn't look like a single one-off round.
  roundsInHistory: number;
  // Every player who sat in the room this round was played in, so the
  // client can turn the userIds inside resultData.details (e.g. Spyfall's
  // per-player scores map) into actual names without a separate lookup -
  // resultData itself is opaque JSON, but a userId with nothing to resolve
  // it against is useless to show.
  players: { userId: string; username: string }[];
}

export const UserService = {
  // One entry per match; single-round games remain separate even when the room is reused.
  async getHistoryForUser(userId: string): Promise<HistoryEntry[]> {
    const sessions = await prisma.gameSession.findMany({
      where: {
        // A session still IN_PROGRESS isn't "history" yet - its room already
        // shows up under the active-rooms section, so surfacing it here too
        // (with a raw, half-finished status badge) is just confusing.
        status: { not: "IN_PROGRESS" },
        room: {
          players: {
            some: { userId },
          },
        },
      },
      include: {
        game: true,
        room: { include: { players: { select: { userId: true, user: { select: { username: true } } } } } },
        history: true,
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    });

    const visible = sessions
      // A session the user has deleted from their own history is hidden
      // here only - the underlying row is kept intact for every other
      // player and for the room's scoreboard/round-count math.
      .filter((session) => !session.history[0]?.hiddenForUserIds.includes(userId));

    const indexByRoom = new Map<string, number>();
    const keyBySession = new Map<string, string>();
    for (const session of [...sessions].reverse()) {
      const index = indexByRoom.get(session.roomId) ?? 0;
      const rounds = (session.room.settings as RoomSettings | null)?.numberOfRounds ?? 1;
      keyBySession.set(session.id, matchKey(session, index, rounds));
      if (session.status === "COMPLETED") indexByRoom.set(session.roomId, index + 1);
    }
    const byMatch = new Map<string, (typeof visible)[number]>();
    const counts = new Map<string, number>();
    for (const session of visible) {
      const key = keyBySession.get(session.id)!;
      if (!byMatch.has(key)) byMatch.set(key, session);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(byMatch.values()).slice(0, 100).map((session) => ({
      gameSessionId: session.id,
      roomId: session.roomId,
      gameName: session.game.name,
      gameSlug: session.game.slug,
      roomName: session.room.roomName,
      roomCode: session.room.roomCode,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      finishedAt: session.finishedAt ? session.finishedAt.toISOString() : null,
      resultData: session.history[0]?.resultData ?? null,
      roundsInHistory: counts.get(keyBySession.get(session.id)!) ?? 1,
      players: session.room.players.map((p) => ({ userId: p.userId, username: p.user.username })),
    }));
  },

  // "Deletes" one history entry from just this user's own view. The
  // GameSession/GameHistory rows stay in place (other players may still
  // see them, and the room's scoreboard reads them for as long as the
  // match is ongoing) - only this user's id is recorded as having hidden
  // it, and getHistoryForUser filters accordingly.
  async deleteHistoryEntryForUser(userId: string, gameSessionId: string): Promise<void> {
    const session = await prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: { history: true, room: { include: { players: true } } },
    });
    if (!session) throw ApiError.notFound("ไม่พบประวัติเกมนี้");

    const wasPlayer = session.room.players.some((p) => p.userId === userId);
    if (!wasPlayer) throw ApiError.forbidden("คุณไม่ได้เล่นเกมนี้");

    const sessions = await prisma.gameSession.findMany({
      where: { roomId: session.roomId, status: "COMPLETED" }, include: { history: true },
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    });
    const rounds = (session.room.settings as RoomSettings | null)?.numberOfRounds ?? 1;
    const targetIndex = sessions.findIndex((entry) => entry.id === session.id);
    const targetKey = matchKey(session, Math.max(0, targetIndex), rounds);
    const selected = targetIndex < 0 ? [session] : sessions.filter((entry, index) => matchKey(entry, index, rounds) === targetKey);
    await prisma.$transaction(selected.flatMap((entry) => entry.history
      .filter((row) => !row.hiddenForUserIds.includes(userId))
      .map((row) => prisma.gameHistory.update({ where: { id: row.id }, data: { hiddenForUserIds: { push: userId } } }))));

  },

  // Same idea as deleteHistoryEntryForUser, but for every round the user
  // has played in one room at once - since getHistoryForUser now shows a
  // room as a single card (see above), "delete" on that card means "hide
  // this whole room's history", not just its most recent round.
  async deleteHistoryForRoomForUser(userId: string, roomId: string): Promise<void> {
    const sessions = await prisma.gameSession.findMany({
      where: { roomId, room: { players: { some: { userId } } } },
      include: { history: true },
    });
    if (sessions.length === 0) throw ApiError.notFound("ไม่พบประวัติเกมนี้");

    await Promise.all(
      sessions
        .map((session) => session.history[0])
        .filter((historyRow): historyRow is NonNullable<typeof historyRow> => Boolean(historyRow))
        .filter((historyRow) => !historyRow.hiddenForUserIds.includes(userId))
        .map((historyRow) =>
          prisma.gameHistory.update({
            where: { id: historyRow.id },
            data: { hiddenForUserIds: { push: userId } },
          })
        )
    );
  },

  // Rooms this user is still an active seat in (not WAITING/FINISHED with
  // leftAt set) - lets someone who accidentally hit "leave game" (or just
  // closed the tab) find their way back in from the History page.
  async getActiveRoomsForUser(userId: string): Promise<PublicRoom[]> {
    const rooms = await prisma.room.findMany({
      where: {
        status: { in: ["WAITING", "PLAYING"] },
        players: {
          some: { userId, leftAt: null },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: roomWithRelations,
    });

    return attachMatchComplete(rooms.map((room) => RoomService.toPublicRoom(room)));
  },

  // Rooms this user left (leftAt set on their RoomPlayer row) that still
  // exist - i.e. the room was never disbanded and never ran down to zero
  // players (both of which mark it FINISHED). Shown on the History page
  // separately from finished game sessions, since leaving a room isn't the
  // same thing as a game ending - the room (and its other players) may
  // still be around.
  async getLeftRoomsForUser(userId: string): Promise<PublicRoom[]> {
    const rooms = await prisma.room.findMany({
      where: {
        status: { in: ["WAITING", "PLAYING"] },
        players: {
          some: { userId, leftAt: { not: null } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: roomWithRelations,
    });

    return attachMatchComplete(rooms.map((room) => RoomService.toPublicRoom(room)));
  },
};

// A room sitting in WAITING can mean two different things: a fresh lobby
// nobody has started yet, or one that already played out its full
// configured round count (see Scoreboard.matchComplete) - still fully
// rejoinable and startable again (RoomService.assertRoundCanStart doesn't
// block on this), just worth labeling differently in the History page so
// "🏆 played all N rounds already" doesn't read as a plain ordinary lobby.
// Batched into one query rather than one round-count lookup per room.
async function attachMatchComplete(rooms: PublicRoom[]): Promise<PublicRoom[]> {
  const roomIdsWithLimit = rooms
    .filter((room) => room.settings?.numberOfRounds)
    .map((room) => room.id);

  if (roomIdsWithLimit.length === 0) {
    return rooms.map((room) => ({ ...room, matchComplete: false }));
  }

  const counts = await prisma.gameSession.groupBy({
    by: ["roomId"],
    where: { roomId: { in: roomIdsWithLimit }, status: "COMPLETED" },
    _count: { _all: true },
  });
  const roundsPlayedByRoomId = new Map(counts.map((c) => [c.roomId, c._count._all]));

  return rooms.map((room) => {
    const numberOfRounds = room.settings?.numberOfRounds;
    const roundsPlayed = Math.max(0, (roundsPlayedByRoomId.get(room.id) ?? 0) - (room.settings?.matchRoundOffset ?? room.settings?.spyfallRoundOffset ?? 0));
    return {
      ...room,
      matchComplete: Boolean(numberOfRounds && roundsPlayed >= numberOfRounds),
    };
  });
}
