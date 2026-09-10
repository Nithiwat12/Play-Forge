import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { RoomCodeBadge } from "../components/room/RoomCodeBadge";
import { PlayerListItem } from "../components/room/PlayerListItem";
import { connectSocket, emitWithAck, getSocket } from "../services/socket";
import { useRoomStore } from "../stores/roomStore";
import { useAuthStore } from "../stores/authStore";
import { extractErrorMessage } from "../services/api";
import type { Room } from "../types";

export function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { room, setRoom, clearRoom } = useRoomStore();

  const [isJoining, setIsJoining] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    const socket = connectSocket();
    let cancelled = false;

    async function joinRoom() {
      try {
        const response = await emitWithAck<{ room: Room }>("room:join", { roomCode });
        if (cancelled) return;
        if (!response.ok) {
          setError(response.error);
          return;
        }
        setRoom(response.room);
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, "เข้าล็อบบี้ไม่สำเร็จ"));
      } finally {
        if (!cancelled) setIsJoining(false);
      }
    }

    function handleRoomUpdate({ room: updatedRoom }: { room: Room }) {
      setRoom(updatedRoom);
    }

    function handleGameStart({ room: updatedRoom }: { room: Room }) {
      setRoom(updatedRoom);
      navigate(`/play/${updatedRoom.roomCode}`);
    }

    socket.on("room:update", handleRoomUpdate);
    socket.on("game:start", handleGameStart);
    joinRoom();

    return () => {
      cancelled = true;
      socket.off("room:update", handleRoomUpdate);
      socket.off("game:start", handleGameStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  async function handleToggleReady() {
    if (!room) return;
    const isReady = !room.players.find((p) => p.userId === currentUser?.id)?.isReady;
    await emitWithAck("room:ready", { roomId: room.id, isReady });
  }

  async function handleStart() {
    if (!room) return;
    setIsStarting(true);
    setError(null);
    try {
      const response = await emitWithAck("game:start", { roomId: room.id });
      if (!response.ok) setError(response.error);
    } finally {
      setIsStarting(false);
    }
  }

  function handleLeave() {
    if (room) {
      getSocket()?.emit("room:leave", { roomId: room.id });
    }
    clearRoom();
    navigate("/home");
  }

  if (isJoining) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <Spinner className="mt-24" />
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-md px-6 py-10">
          <Card>
            <p className="text-sm text-red-400">{error}</p>
            <Button className="mt-4 w-full" onClick={() => navigate("/home")}>
              กลับไปที่คลังเกม
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (!room) return null;

  const self = room.players.find((p) => p.userId === currentUser?.id);
  const isHost = self?.isHost ?? false;
  const canStart = room.players.length >= room.game.minPlayers;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">{room.game.name}</p>
              <h1 className="text-xl font-semibold text-white">{room.roomName}</h1>
            </div>
            <RoomCodeBadge code={room.roomCode} />
          </div>

          <p className="mt-4 text-sm text-slate-400">
            {room.players.length} / {room.maxPlayers} ผู้เล่น
          </p>

          <ul className="mt-4 flex flex-col gap-2">
            {room.players.map((player) => (
              <PlayerListItem
                key={player.userId}
                player={player}
                isSelf={player.userId === currentUser?.id}
              />
            ))}
          </ul>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant={self?.isReady ? "secondary" : "primary"} onClick={handleToggleReady}>
              {self?.isReady ? "ยังไม่พร้อม" : "พร้อมแล้ว"}
            </Button>
            {isHost && (
              <Button
                variant="primary"
                onClick={handleStart}
                isLoading={isStarting}
                disabled={!canStart}
                title={!canStart ? `ต้องมีผู้เล่นอย่างน้อย ${room.game.minPlayers} คน` : undefined}
              >
                เริ่มเกม
              </Button>
            )}
            <Button variant="ghost" onClick={handleLeave}>
              ออกจากห้อง
            </Button>
          </div>

          {isHost && !canStart && (
            <p className="mt-3 text-xs text-slate-500">
              รอผู้เล่นเข้าร่วมอย่างน้อย {room.game.minPlayers} คนก่อนจึงจะเริ่มเกมได้
            </p>
          )}
        </Card>
      </main>
    </div>
  );
}
