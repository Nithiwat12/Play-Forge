import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import type { JwtPayload } from "../types";

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }
  const cookieToken = (req as any).cookies?.[env.cookieName];
  return cookieToken ?? null;
}

// Protects REST routes: verifies the JWT and attaches the decoded user to
// `req.user`. Every route that touches user-specific or authenticated-only
// data should use this middleware rather than re-implementing auth checks.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next(ApiError.unauthorized("ต้องเข้าสู่ระบบก่อน"));
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.user = {
      id: decoded.sub,
      username: decoded.username,
      email: decoded.email,
    };
    next();
  } catch {
    next(ApiError.unauthorized("โทเคนไม่ถูกต้องหรือหมดอายุ"));
  }
}

// Best-effort auth: attaches req.user if a valid token is present, but does
// not reject the request otherwise. Useful for endpoints that behave
// differently for logged-in users without requiring login.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.user = { id: decoded.sub, username: decoded.username, email: decoded.email };
  } catch {
    // ignore invalid token for optional auth
  }
  next();
}
