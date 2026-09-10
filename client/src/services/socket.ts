import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../stores/authStore";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

/** Lazily creates (or returns) the single authenticated socket connection. */
export function connectSocket(): Socket {
  if (socket?.connected || socket?.active) {
    return socket;
  }

  const token = useAuthStore.getState().token;
  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    transports: ["websocket", "polling"],
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

type AckResponse<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Wraps the ack-callback pattern every server socket handler uses into a
 * promise, so components can `await emitWithAck(...)` instead of nesting
 * callbacks.
 */
export function emitWithAck<TResponse extends Record<string, unknown> = Record<string, never>>(
  event: string,
  payload: unknown
): Promise<AckResponse<TResponse>> {
  return new Promise((resolve, reject) => {
    const activeSocket = getSocket();
    if (!activeSocket) {
      reject(new Error("Not connected to the server"));
      return;
    }
    activeSocket.timeout(8000).emit(event, payload, (err: Error | null, response: AckResponse<TResponse>) => {
      if (err) {
        reject(new Error("The server did not respond in time"));
        return;
      }
      resolve(response);
    });
  });
}
