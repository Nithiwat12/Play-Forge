import type { Request, Response } from "express";
import { GameService } from "../services/GameService";
import { asyncHandler } from "../utils/asyncHandler";

export const gameController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const games = await GameService.listActiveGames();
    res.status(200).json({ games });
  }),

  getBySlug: asyncHandler(async (req: Request, res: Response) => {
    const game = await GameService.getPublicBySlug(req.params.slug);
    res.status(200).json({ game });
  }),
};
