import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import type { PublicGame } from "../types";

function toPublicGame(game: {
  id: string;
  name: string;
  slug: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  isActive: boolean;
}): PublicGame {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    description: game.description,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    isActive: game.isActive,
  };
}

// The Game Library is entirely data-driven from the `games` table. Adding a
// new game to the platform is a data operation (insert a row + register its
// engine in GameRegistry), never a change to this service.
export const GameService = {
  async listActiveGames(): Promise<PublicGame[]> {
    const games = await prisma.game.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    return games.map(toPublicGame);
  },

  async getBySlug(slug: string) {
    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) throw ApiError.notFound(`ไม่พบเกม "${slug}"`);
    return game;
  },

  async getPublicBySlug(slug: string): Promise<PublicGame> {
    const game = await this.getBySlug(slug);
    return toPublicGame(game);
  },
};
