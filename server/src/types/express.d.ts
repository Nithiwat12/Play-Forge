// Augments Express's Request with the authenticated user attached by
// authMiddleware, so controllers get typed access to `req.user`.
import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
      };
    }
  }
}

export {};
