import type { Request, Response } from "express";
import { RoomService } from "../services/RoomService";
import { ScoreboardService } from "../services/ScoreboardService";
import { createRoomSchema, joinRoomSchema } from "../utils/validators";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";

export const roomController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const input = createRoomSchema.parse(req.body);
    const room = await RoomService.createRoom(req.user.id, input);
    res.status(201).json({ room });
  }),

  join: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const input = joinRoomSchema.parse(req.body);
    const room = await RoomService.joinRoom(req.user.id, input);
    res.status(200).json({ room });
  }),

  getByCode: asyncHandler(async (req: Request, res: Response) => {
    const room = await RoomService.getPublicRoomByCode(req.params.roomCode);
    res.status(200).json({ room });
  }),

  leave: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const room = await RoomService.leaveRoomByCode(req.user.id, req.params.roomCode);
    res.status(200).json({ room });
  }),

  getScoreboard: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const scoreboard = await ScoreboardService.getScoreboardByRoomCode(req.params.roomCode, req.query.scope === "current", typeof req.query.gameSessionId === "string" ? req.query.gameSessionId : undefined);
    res.status(200).json({ scoreboard });
  }),
};
