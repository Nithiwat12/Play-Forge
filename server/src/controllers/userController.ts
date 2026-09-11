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

  deleteMyHistoryEntry: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await UserService.deleteHistoryEntryForUser(req.user.id, req.params.gameSessionId);
    res.status(200).json({ ok: true });
  }),

  // Hides every round the user played in one room at once - see
  // getHistoryForUser (now one card per room) and
  // deleteHistoryForRoomForUser for why this differs from the single-round
  // delete above.
  deleteMyHistoryForRoom: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await UserService.deleteHistoryForRoomForUser(req.user.id, req.params.roomId);
    res.status(200).json({ ok: true });
  }),
};
