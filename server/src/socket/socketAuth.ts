import type { Socket } from "socket.io";
import { AuthService } from "../services/AuthService";

export interface SocketUser {
  id: string;
  username: string;
  email: string;
}

declare module "socket.io" {
  interface Socket {
    data: {
      user: SocketUser;
      currentRoomId?: string;
    };
  }
}

/**
 * Socket.IO connection middleware. Every socket must present a valid JWT
 * (same token issued by REST login/register) before the connection is
 * accepted - there is no such thing as an unauthenticated socket on this
 * platform, matching "Authenticate Socket.IO connections" in the spec.
 */
export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token =
    (socket.handshake.auth?.token as string | undefined) ??
    (socket.handshake.headers.authorization?.startsWith("Bearer ")
      ? socket.handshake.headers.authorization.slice("Bearer ".length)
      : undefined);

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const decoded = AuthService.verifyToken(token);
    socket.data.user = { id: decoded.sub, username: decoded.username, email: decoded.email };
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
}
