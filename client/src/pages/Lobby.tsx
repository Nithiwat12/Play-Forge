import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { RoomCodeBadge } from "../components/room/RoomCodeBadge";
import { PlayerListItem } from "../components/room/PlayerListItem";
import { ScoreboardTable } from "../components/game/ScoreboardTable";
import { CategoryPickerPrompt } from "../games/spyfall/CategoryPickerPrompt";
import type { CategoryPendingInfo } from "../games/spyfall/CategoryPickerPrompt";
import { subscribeToRoom } from "../services/roomConnection";
import { connectSocket, emitWithAck } from "../services/socket";
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
  const [kickTarget, setKickTarget] = useState<{ userId: string; username: string } | null>(null);
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);

  // A "PER_ROUND" category-mode room's extra step after pressing "start
  // game" - the host must pick (or repeat) this round's category before the
  // round actually begins; see CategoryPickerPrompt. Null for every other
  // mode, and for a room where nobody has pressed "start" yet.
  const [categoryPending, setCategoryPending] = useState<CategoryPendingInfo | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [isSelectingCategory, setIsSelectingCategory] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!roomCode) { setError("ไม่พบรหัสห้อง"); setIsJoining(false); return; }
    setIsJoining(true);
    setError(null);
    clearRoom();
    setScoreboard(null);
    setCategoryPending(null);
    setCategoryError(null);
    const socket = connectSocket();
    let cancelled = false;

    function refreshScoreboard() {
      api
        .get<{ scoreboard: Scoreboard }>(`/rooms/${roomCode}/scoreboard?scope=current`)
        .then((res) => {
          if (!cancelled) setScoreboard(res.data.scoreboard);
        })
        .catch(() => {
          // Non-critical - just means the match-complete banner won't show.
        });
    }

    function handleRoomUpdate({ room: updatedRoom }: { room: Room }) {
      if (updatedRoom.roomCode !== roomCode) return;
      setRoom(updatedRoom);
    }

    function handleGameStart({ room: updatedRoom }: { room: Room }) {
      if (updatedRoom.roomCode !== roomCode) return;
      setRoom(updatedRoom);
      setCategoryPending(null);
      navigate(`/play/${updatedRoom.roomCode}`);
    }

    // Only fires for a "PER_ROUND" category-mode room - see
    // CategoryPickerPrompt. Opened the moment the host presses "start game"
    // (round 1, or a fresh match in a reused room); hands off to
    // handleGameStart once the host actually picks a category.
    function handleCategoryPending(payload: { roomId: string; lastCategory: string | null }) {
      if (payload.roomId !== useRoomStore.getState().room?.id) return;
      setError(null);
      setCategoryError(null);
      setCategoryPending({ lastCategory: payload.lastCategory });
    }

    // The room could no longer actually start once the host finished
    // picking (e.g. someone left while they were choosing) - surface it to
    // everyone, since they've been sitting on a "waiting for host" popup
    // this whole time with no other signal.
    function handleCategoryFailed(payload: { roomId: string; error: string }) {
      if (payload.roomId !== useRoomStore.getState().room?.id) return;
      setCategoryPending(null);
      setError(payload.error);
    }

    function handleDisbanded(payload: { message?: string } = {}) {
      clearRoom();
      navigate("/home", { replace: true, state: payload.message ? { notice: payload.message } : undefined });
    }

    // Only fires for the player who was actually kicked (see
    // socketUtils.broadcastPlayerKicked on the server) - everyone else in
    // the room just gets the usual room:update roster refresh instead.
    function handleKicked(payload: { message?: string } = {}) {
      clearRoom();
      navigate("/home", { replace: true, state: payload.message ? { notice: payload.message } : undefined });
    }

    socket.on("room:update", handleRoomUpdate);
    socket.on("game:start", handleGameStart);
    socket.on("game:categoryPending", handleCategoryPending);
    socket.on("game:categoryFailed", handleCategoryFailed);
    socket.on("room:disbanded", handleDisbanded);
    socket.on("room:kicked", handleKicked);
    const stopJoining = subscribeToRoom(socket, roomCode,
      (response) => {
        setError(null);
        setRoom(response.room);
        setIsJoining(false);
        if (response.room.status === "FINISHED") {
          setError("ห้องนี้ปิดแล้ว");
          return;
        }
        if (response.room.status === "PLAYING") {
          navigate(`/play/${response.room.roomCode}`, { replace: true });
          return;
        }
        refreshScoreboard();
      },
      (message) => { setError(message); setIsJoining(false); },
    );

    return () => {
      cancelled = true;
      stopJoining();
      socket.off("room:update", handleRoomUpdate);
      socket.off("game:start", handleGameStart);
      socket.off("game:categoryPending", handleCategoryPending);
      socket.off("game:categoryFailed", handleCategoryFailed);
      socket.off("room:disbanded", handleDisbanded);
      socket.off("room:kicked", handleKicked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, attempt]);

  async function handleToggleReady() {
    if (!room) return;
    const isReady = !room.players.find((p) => p.userId === currentUser?.id)?.isReady;
    try {
      const response = await emitWithAck("room:ready", { roomId: room.id, isReady });
      if (!response.ok) setError(response.error);
    } catch (err) { setError(extractErrorMessage(err)); }
  }

  async function handleStart() {
    if (!room) return;
    setIsStarting(true);
    setError(null);
    try {
      const response = await emitWithAck("game:start", { roomId: room.id });
      if (!response.ok) setError(response.error);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleSelectCategory(category: string) {
    if (!room) return;
    setIsSelectingCategory(true);
    try {
      const response = await emitWithAck("game:selectCategory", { roomId: room.id, category });
      if (!response.ok) setCategoryError(response.error);
    } catch (err) {
      setCategoryError(extractErrorMessage(err));
    } finally {
      setIsSelectingCategory(false);
    }
  }

  async function leaveOrDisband(event: "room:leave" | "room:disband") {
    if (!room) return;
    try {
      const response = await emitWithAck(event, { roomId: room.id });
      if (!response.ok) throw new Error(response.error);
      clearRoom();
      navigate("/home");
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setShowDisbandConfirm(false); }
  }
  const handleLeave = () => { void leaveOrDisband("room:leave"); };
  const handleConfirmDisband = () => { void leaveOrDisband("room:disband"); };

  async function handleConfirmKick() {
    if (!room || !kickTarget) return;
    const targetUserId = kickTarget.userId;
    setKickTarget(null);
    try {
      const response = await emitWithAck("room:kick", { roomId: room.id, targetUserId });
      if (!response.ok) setError(response.error);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  if (isJoining) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <Spinner className="mt-24" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-10">
          <Card>
            <p className="text-sm text-red-400">{error}</p>
            <Button className="mt-4" onClick={() => setAttempt((n) => n + 1)}>ลองใหม่</Button>
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
  // matchComplete no longer blocks starting another round here (see
  // RoomService.assertRoundCanStart) - it's just a "🏆 played all N rounds"
  // milestone now, same room, same lobby, ready up and go again.
  const canStart = hasEnoughPlayers && allReady;
  const startBlockedReason = !hasEnoughPlayers
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
                canKick={isHost && player.userId !== currentUser?.id}
                onKick={() => setKickTarget({ userId: player.userId, username: player.username })}
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
              🏆 แมตช์นี้เล่นครบ {scoreboard?.numberOfRounds} รอบแล้ว ดูตารางคะแนนรวมด้านล่าง - พร้อมกันแล้วกดเริ่มเกมเพื่อเล่นแมตช์ใหม่ในห้องนี้ต่อได้เลย
            </p>
          )}

          {isHost && !canStart && (
            <p className="mt-3 text-xs text-slate-500">
              {!hasEnoughPlayers
                ? `รอผู้เล่นเข้าร่วมอย่างน้อย ${room.game.minPlayers} คนก่อนจึงจะเริ่มเกมได้`
                : "รอผู้เล่นกดพร้อมให้ครบทุกคนก่อนจึงจะเริ่มเกมได้"}
            </p>
          )}
        </Card>

        {matchComplete && scoreboard && (
          <div className="mt-4">
            <ScoreboardTable scoreboard={scoreboard} />
          </div>
        )}
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
      {kickTarget && (
        <ConfirmModal
          title={`เตะ ${kickTarget.username} ออกจากห้อง?`}
          message="ผู้เล่นคนนี้จะถูกนำออกจากห้องทันที และต้องขอรหัสห้องเพื่อเข้ามาใหม่เอง"
          confirmLabel="เตะออก"
          cancelLabel="ยกเลิก"
          onConfirm={() => void handleConfirmKick()}
          onCancel={() => setKickTarget(null)}
        />
      )}
      <CategoryPickerPrompt
        pending={categoryPending}
        isHost={isHost}
        isSubmitting={isSelectingCategory}
        error={categoryError}
        onSelect={(category) => void handleSelectCategory(category)}
        onDismissError={() => setCategoryError(null)}
        context="roundStart"
      />
    </div>
  );
}
