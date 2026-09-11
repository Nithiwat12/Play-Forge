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
  // Returns one entry per room the user has ever finished a round in, most
  // recently played first - not one entry per round. A room reused across
  // several rounds (the common case: replay a few times before leaving)
  // would otherwise flood this list with near-identical cards that only
  // differ by timestamp; the entry shown is just the room's most recent
  // round, and GameResult.tsx already renders the whole match (every round
  // played there) off the room code alone, so nothing is lost by not
  // listing the others. Entirely game-agnostic: resultData is opaque JSON
  // each game defines itself.
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
      orderBy: { startedAt: "desc" },
      take: 100,
    });

    const visible = sessions
      // A session the user has deleted from their own history is hidden
      // here only - the underlying row is kept intact for every other
      // player and for the room's scoreboard/round-count math.
      .filter((session) => !session.history[0]?.hiddenForUserIds.includes(userId));

    // Already ordered most-recent-first, so the first session encountered
    // for a given room is that room's latest round - exactly the one to
    // represent it with.
    const byRoomId = new Map<string, (typeof visible)[number]>();
    const countByRoomId = new Map<string, number>();
    for (const session of visible) {
      if (!byRoomId.has(session.roomId)) byRoomId.set(session.roomId, session);
      countByRoomId.set(session.roomId, (countByRoomId.get(session.roomId) ?? 0) + 1);
    }

    return Array.from(byRoomId.values()).map((session) => ({
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
      roundsInHistory: countByRoomId.get(session.roomId) ?? 1,
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

    const historyRow = session.history[0];
    if (!historyRow) return; // Nothing to hide - no result was ever recorded.
    if (historyRow.hiddenForUserIds.includes(userId)) return; // Already hidden.

    await prisma.gameHistory.update({
      where: { id: historyRow.id },
      data: { hiddenForUserIds: { push: userId } },
    });
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
    const roundsPlayed = Math.max(0, (roundsPlayedByRoomId.get(room.id) ?? 0) - (room.settings?.spyfallRoundOffset ?? 0));
    return {
      ...room,
      matchComplete: Boolean(numberOfRounds && roundsPlayed >= numberOfRounds),
    };
  });
}
