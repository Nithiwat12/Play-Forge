import type { Socket } from "socket.io-client";
import type { Room } from "../types";
import { emitWithAck } from "./socket";

export interface JoinedRoom {
  room: Room;
  gameState: { roomId: string; public: unknown; private: unknown } | null;
}

/** Bounded join lifecycle, including the time BEFORE a socket connects. */
export function subscribeToRoom(
  socket: Socket,
  roomCode: string,
  onJoined: (response: JoinedRoom) => void,
  onError: (message: string) => void,
) {
  let disposed = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout>;
  const armDeadline = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!disposed) onError("เชื่อมต่อห้องไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    }, 12000);
  };
  const join = async () => {
    const current = ++generation;
    armDeadline();
    try {
      const response = await emitWithAck<JoinedRoom & Record<string, unknown>>("room:join", { roomCode });
      if (disposed || current !== generation) return;
      clearTimeout(timer);
      if (!response.ok) { onError(response.error); return; }
      onJoined(response);
    } catch (error) {
      if (disposed || current !== generation) return;
      clearTimeout(timer);
      onError(error instanceof Error ? error.message : "เข้าห้องไม่สำเร็จ");
    }
  };
  const disconnected = () => { generation++; armDeadline(); };
  const failed = () => {
    if (!disposed) onError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
  };
  socket.on("connect", join);
  socket.on("disconnect", disconnected);
  socket.on("connect_error", failed);
  armDeadline();
  if (socket.connected) void join();
  return () => {
    disposed = true;
    generation++;
    clearTimeout(timer);
    socket.off("connect", join);
    socket.off("disconnect", disconnected);
    socket.off("connect_error", failed);
  };
}
