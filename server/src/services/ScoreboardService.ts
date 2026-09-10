import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import type { RoomSettings } from "../types";

export interface RoundScoreEntry {
  round: number;
  winner: string;
  reason: string;
  spyUserId: string;
  spyUsername: string;
  scores: Record<string, number>;
}

export interface ScoreboardTotal {
  userId: string;
  username: string;
  total: number;
}

export interface Scoreboard {
  numberOfRounds: number | null;
  roundsPlayed: number;
  matchComplete: boolean;
  rounds: RoundScoreEntry[];
  totals: ScoreboardTotal[];
  // Every player who has ever sat in this room, for the client to label
  // rounds/totals with - totals only lists players with >0 lifetime
  // points, so a player stuck at 0 would otherwise have no username to
  // show against their row.
  players: { userId: string; username: string }[];
}

// Rolls up every completed round played in a room into a running score
// table. Deliberately game-agnostic at the query level - it only assumes
// each round's GameHistory.resultData.details carries an opaque `scores`
// map of userId -> points, which is exactly what BaseGame.end() already
// returns as `details`. A future non-Spyfall game just needs to populate
// that same `scores` field on its own result shape to plug into this.
export const ScoreboardService = {
  async getScoreboardByRoomId(roomId: string): Promise<Scoreboard> {
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { settings: true } });
    if (!room) throw ApiError.notFound("ไม่พบห้องนี้");

    return buildScoreboard(roomId, (room.settings as RoomSettings | null) ?? null);
  },

  async getScoreboardByRoomCode(roomCode: string): Promise<Scoreboard> {
    const room = await prisma.room.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      select: { id: true, settings: true },
    });
    if (!room) throw ApiError.notFound("ไม่พบห้องนี้");

    return buildScoreboard(room.id, (room.settings as RoomSettings | null) ?? null);
  },
};

async function buildScoreboard(roomId: string, settings: RoomSettings | null): Promise<Scoreboard> {
  const numberOfRounds = settings?.numberOfRounds ?? null;

  const sessions = await prisma.gameSession.findMany({
    where: { roomId, status: "COMPLETED" },
    include: { history: true },
    orderBy: { startedAt: "asc" },
  });

  // Look up every player who has ever sat in this room (not just current
  // ones - a player who left partway through the match still needs their
  // username for rounds they scored points in earlier).
  const allPlayers = await prisma.roomPlayer.findMany({
    where: { roomId },
    include: { user: true },
  });
  const usernameByUserId = new Map(allPlayers.map((p) => [p.userId, p.user.username]));

  const rounds: RoundScoreEntry[] = sessions.map((session, index) => {
    const resultData = session.history[0]?.resultData as
      | { details?: Record<string, unknown> }
      | undefined;
    const details = resultData?.details ?? {};

    return {
      round: index + 1,
      winner: typeof details.winner === "string" ? details.winner : "SPY",
      reason: typeof details.reason === "string" ? details.reason : "",
      spyUserId: typeof details.spyUserId === "string" ? details.spyUserId : "",
      spyUsername: typeof details.spyUsername === "string" ? details.spyUsername : "ไม่ทราบชื่อ",
      scores: (details.scores as Record<string, number> | undefined) ?? {},
    };
  });

  const totalsMap = new Map<string, number>();
  for (const round of rounds) {
    for (const [userId, points] of Object.entries(round.scores)) {
      totalsMap.set(userId, (totalsMap.get(userId) ?? 0) + points);
    }
  }

  const totals: ScoreboardTotal[] = Array.from(totalsMap.entries())
    .map(([userId, total]) => ({
      userId,
      username: usernameByUserId.get(userId) ?? "ไม่ทราบชื่อ",
      total,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    numberOfRounds,
    roundsPlayed: rounds.length,
    matchComplete: numberOfRounds != null && rounds.length >= numberOfRounds,
    rounds,
    totals,
    players: allPlayers.map((p) => ({ userId: p.userId, username: p.user.username })),
  };
}
