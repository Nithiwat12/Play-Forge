import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { RoomCodeBadge } from "../components/room/RoomCodeBadge";
import { PlayerListItem } from "../components/room/PlayerListItem";
import { connectSocket, emitWithAck, getSocket } from "../services/socket";
import { useRoomStore } from "../stores/roomStore";
import { useAuthStore } from "../stores/authStore";
import { api, extractErrorMessage } from "../services/api";
import type { Room, Scoreboard } from "../types";

export function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { room, setRoom, clearRoom } = useRoomStore();

  const [isJoining, setIsJoining] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisbandConfirm, setShowDisbandConfirm] = useState(false);
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    const socket = connectSocket();
    let cancelled = false;

    function refreshScoreboard() {
      api
        .get<{ scoreboard: Scoreboard }>(`/rooms/${roomCode}/scoreboard`)
        .then((res) => {
          if (!cancelled) setScoreboard(res.data.scoreboard);
        })
        .catch(() => {
          // Non-critical - just means the match-complete banner won't show.
        });
    }

    async function joinRoom() {
      try {
        const response = await emitWithAck<{ room: Room }>("room:join", { roomCode });
        if (cancelled) return;
        if (!response.ok) {
          setError(response.error);
          return;
        }
        setError(null);
        setRoom(response.room);
        refreshScoreboard();
        if (response.room.status !== "WAITING") {
          // The game is already running (or a network blip just reconnected
          // us mid-round) - the lobby screen is stale, so follow straight
          // into the game instead of stranding the player here.
          navigate(`/play/${response.room.roomCode}`, { replace: true });
        }
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

    function handleDisbanded() {
      clearRoom();
      navigate("/home", { replace: true });
    }

    socket.on("room:update", handleRoomUpdate);
    socket.on("game:start", handleGameStart);
    socket.on("room:disbanded", handleDisbanded);
    // Re-run the join on every (re)connect, not just the first one, so a
    // brief network drop doesn't silently leave this socket out of the
    // room - see the identical comment in PlayPage.tsx.
    socket.on("connect", joinRoom);
    if (socket.connected) joinRoom();

    return () => {
      cancelled = true;
      socket.off("room:update", handleRoomUpdate);
      socket.off("game:start", handleGameStart);
      socket.off("room:disbanded", handleDisbanded);
      socket.off("connect", joinRoom);
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

  function handleConfirmDisband() {
    if (room) {
      getSocket()?.emit("room:disband", { roomId: room.id });
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
        <main className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-10">
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
  const hasEnoughPlayers = room.players.length >= room.game.minPlayers;
  const allReady = room.players.every((p) => p.isReady);
  const matchComplete = scoreboard?.matchComplete ?? false;
  const canStart = hasEnoughPlayers && allReady && !matchComplete;
  const startBlockedReason = matchComplete
    ? "เล่นครบจำนวนรอบที่กำหนดไว้แล้ว"
    : !hasEnoughPlayers
      ? `ต้องมีผู้เล่นอย่างน้อย ${room.game.minPlayers} คน`
      : !allReady
        ? "ผู้เล่นยังไม่พร้อมครบทุกคน"
        : undefined;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
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
                title={startBlockedReason}
              >
                เริ่มเกม
              </Button>
            )}
            <Button variant="ghost" onClick={handleLeave}>
              ออกจากห้อง
            </Button>
            {isHost && (
              <Button variant="ghost" onClick={() => setShowDisbandConfirm(true)}>
                ยุบห้อง
              </Button>
            )}
          </div>

          {matchComplete && (
            <p className="mt-3 text-sm font-medium text-amber-400">
              🏆 แมตช์นี้เล่นครบ {scoreboard?.numberOfRounds} รอบแล้ว ดูผลคะแนนได้จากรอบล่าสุด หรือสร้างห้องใหม่เพื่อเล่นแมตช์ต่อไป
            </p>
          )}

          {isHost && !canStart && !matchComplete && (
            <p className="mt-3 text-xs text-slate-500">
              {!hasEnoughPlayers
                ? `รอผู้เล่นเข้าร่วมอย่างน้อย ${room.game.minPlayers} คนก่อนจึงจะเริ่มเกมได้`
                : "รอผู้เล่นกดพร้อมให้ครบทุกคนก่อนจึงจะเริ่มเกมได้"}
            </p>
          )}
        </Card>
      </main>
      {showDisbandConfirm && (
        <ConfirmModal
          title="ยุบห้องนี้?"
          message="ห้องนี้จะถูกปิดสำหรับทุกคนทันที ทุกคนจะถูกส่งกลับหน้าแรก"
          confirmLabel="ยุบห้อง"
          cancelLabel="ยกเลิก"
          onConfirm={handleConfirmDisband}
          onCancel={() => setShowDisbandConfirm(false)}
        />
      )}
    </div>
  );
}
