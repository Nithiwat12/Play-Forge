import type { Server, Socket } from "socket.io";
import { AuthService } from "../services/AuthService";

export interface SocketUser {
  id: string;
  username: string;
  email: string;
}

export interface AppSocketData {
  user: SocketUser;
  currentRoomId?: string;
}

// Socket.IO types `Socket.data`/`Server` via a generic parameter (default
// `any`), so it can't be safely re-declared through `declare module`
// augmentation - `tsc` rejects that as an incompatible property
// redeclaration (this was never caught locally because `tsx watch`, used
// for `npm run dev`, transpiles without type-checking). Parameterizing
// Socket/Server with this type is the officially supported way to type
// `socket.data`.
export type AppSocket = Socket<any, any, any, AppSocketData>;
export type AppServer = Server<any, any, any, AppSocketData>;

/**
 * Socket.IO connection middleware. Every socket must present a valid JWT
 * (same token issued by REST login/register) before the connection is
 * accepted - there is no such thing as an unauthenticated socket on this
 * platform, matching "Authenticate Socket.IO connections" in the spec.
 */
export function socketAuthMiddleware(socket: AppSocket, next: (err?: Error) => void) {
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
