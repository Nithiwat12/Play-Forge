import type { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";

export const userController = {
  getMyHistory: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const history = await UserService.getHistoryForUser(req.user.id);
    res.status(200).json({ history });
  }),

  getMyActiveRooms: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const rooms = await UserService.getActiveRoomsForUser(req.user.id);
    res.status(200).json({ rooms });
  }),

  getMyLeftRooms: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const rooms = await UserService.getLeftRoomsForUser(req.user.id);
    res.status(200).json({ rooms });
  }),
};
