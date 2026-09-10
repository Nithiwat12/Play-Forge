import { prisma } from "../config/prisma";
import type { GameResult } from "../games/core/types";

// Bridges the generic Game Engine (BaseGame/GameManager) to persistence.
// Knows nothing about any specific game's rules - it only ever handles
// the opaque GameResult shape every BaseGame.end() returns.
export const GameSessionService = {
  async createSession(roomId: string, gameId: string) {
    return prisma.gameSession.create({
      data: { roomId, gameId, status: "IN_PROGRESS" },
    });
  },

  async finalizeSession(sessionId: string, result: GameResult) {
    await prisma.$transaction([
      prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          stateSnapshot: result.details as any,
        },
      }),
      prisma.gameHistory.create({
        data: {
          gameSessionId: sessionId,
          resultData: {
            summary: result.summary,
            winnerUserIds: result.winnerUserIds,
            details: result.details,
          } as any,
        },
      }),
    ]);
  },

  async abortSession(sessionId: string) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: "ABORTED", finishedAt: new Date() },
    });
  },
};
