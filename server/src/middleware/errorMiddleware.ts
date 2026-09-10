import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

export function notFoundMiddleware(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}` } });
}

// Centralized error handler. Normalizes ApiError, Zod validation errors,
// and unexpected exceptions into one JSON response shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Validation failed",
        details: err.flatten(),
      },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: {
      message: "Internal server error",
      ...(env.isProduction ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}
