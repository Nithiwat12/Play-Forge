import type { Request, Response } from "express";
import { AuthService } from "../services/AuthService";
import { registerSchema, loginSchema } from "../utils/validators";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function setAuthCookie(res: Response, token: string) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const input = registerSchema.parse(req.body);
    const { user, token } = await AuthService.register(input);
    setAuthCookie(res, token);
    res.status(201).json({ user, token });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body);
    const { user, token } = await AuthService.login(input);
    setAuthCookie(res, token);
    res.status(200).json({ user, token });
  }),

  logout: asyncHandler(async (_req: Request, res: Response) => {
    res.clearCookie(env.cookieName);
    res.status(200).json({ message: "Logged out" });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await AuthService.getById(req.user.id);
    res.status(200).json({ user });
  }),
};
