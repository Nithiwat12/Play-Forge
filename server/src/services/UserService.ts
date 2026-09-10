import { prisma } from "../config/prisma";

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

export const UserService = {
  // Returns every finished game session the user took part in (as a
  // current or former room player), most recent first. Entirely
  // game-agnostic: resultData is opaque JSON each game defines itself.
  async getHistoryForUser(userId: string): Promise<HistoryEntry[]> {
    const sessions = await prisma.gameSession.findMany({
      where: {
        room: {
          players: {
            some: { userId },
          },
        },
      },
      include: {
        game: true,
        room: true,
        history: true,
      },
      orderBy: { startedAt: "desc" },
      take: 100,
    });

    return sessions.map((session) => ({
      gameSessionId: session.id,
      gameName: session.game.name,
      gameSlug: session.game.slug,
      roomName: session.room.roomName,
      roomCode: session.room.roomCode,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      finishedAt: session.finishedAt ? session.finishedAt.toISOString() : null,
      resultData: session.history[0]?.resultData ?? null,
    }));
  },
};
