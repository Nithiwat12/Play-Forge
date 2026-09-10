import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Spinner } from "../components/common/Spinner";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { subscribeToRoom } from "../services/roomConnection";
import { connectSocket, emitWithAck } from "../services/socket";
import { useRoomStore } from "../stores/roomStore";
import { useGameStore } from "../stores/gameStore";
import { useAuthStore } from "../stores/authStore";
import { GAME_COMPONENTS } from "../games/registry";
import { api, extractErrorMessage } from "../services/api";
import type { Room, Scoreboard } from "../types";

export function PlayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { room, setRoom, clearRoom } = useRoomStore();
  const { publicState, privateState, scoreboard, setState, setScoreboard, clear } = useGameStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDisbandConfirm, setShowDisbandConfirm] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!roomCode) { setError("ไม่พบรหัสห้อง"); setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    clearRoom();
    clear();
    const socket = connectSocket();
    let cancelled = false;

    function refreshScoreboard() {
      api
        .get<{ scoreboard: Scoreboard }>(`/rooms/${roomCode}/scoreboard`)
        .then((res) => {
          if (!cancelled) setScoreboard(res.data.scoreboard);
        })
        .catch(() => {
          // Non-critical - the score table just won't show yet.
        });
    }

    function handleGameState(payload: { roomId: string; public: unknown; private: unknown }) {
      if (payload.roomId !== useRoomStore.getState().room?.id) return;
      setState(payload.public, payload.private);
    }

    function handleGameEnd(payload: { scoreboard?: Scoreboard | null }) {
      if (payload.scoreboard) setScoreboard(payload.scoreboard);
    }

    function handleRoomUpdate({ room: updatedRoom }: { room: Room }) {
      if (updatedRoom.roomCode !== roomCode) return;
      setRoom(updatedRoom);
    }

    function handleDisbanded() {
      clearRoom();
      clear();
      navigate("/home", { replace: true });
    }

    socket.on("game:state", handleGameState);
    socket.on("game:end", handleGameEnd);
    socket.on("room:update", handleRoomUpdate);
    socket.on("room:disbanded", handleDisbanded);
    const stopJoining = subscribeToRoom(socket, roomCode,
      (response) => {
        setError(null);
        setRoom(response.room);
        setIsLoading(false);
        if (response.room.status === "FINISHED") {
          setError("ห้องนี้ปิดแล้ว");
          return;
        }
        if (response.room.status === "WAITING") {
          navigate(`/lobby/${response.room.roomCode}`, { replace: true });
          return;
        }
        if (!response.gameState || response.gameState.roomId !== response.room.id ||
            response.gameState.public == null || response.gameState.private == null) {
          setError("ไม่ได้รับข้อมูลเกม กรุณาลองใหม่หรือกลับหน้าประวัติ");
          return;
        }
        setState(response.gameState.public, response.gameState.private);
        refreshScoreboard();
      },
      (message) => { setError(message); setIsLoading(false); },
    );

    return () => {
      cancelled = true;
      stopJoining();
      socket.off("game:state", handleGameState);
      socket.off("game:end", handleGameEnd);
      socket.off("room:update", handleRoomUpdate);
      socket.off("room:disbanded", handleDisbanded);
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, attempt]);

  // Stable identities (via useCallback, keyed on the room id rather than
  // the whole room object which is replaced on every room:update) so the
  // game component below doesn't treat these as "new" props on every
  // unrelated re-render - see SpyfallGame.tsx's own useCallback usage for
  // why that matters for its memoized children.
  const roomId = room?.id;
  const handleAction = useCallback(
    async (actionType: string, payload: unknown) => {
      try {
        const response = await emitWithAck("game:action", { roomId, actionType, payload });
        return response.ok ? { ok: true } : { ok: false, error: response.error };
      } catch (err) { return { ok: false, error: extractErrorMessage(err) }; }
    },
    [roomId]
  );

  const handleReplay = useCallback(async () => {
    try {
      const response = await emitWithAck("game:start", { roomId });
      return response.ok ? { ok: true } : { ok: false, error: response.error };
    } catch (err) { return { ok: false, error: extractErrorMessage(err) }; }
  }, [roomId]);

  async function leaveOrDisband(event: "room:pause" | "room:disband") {
    if (!room) return;
    try {
      const response = await emitWithAck(event, { roomId: room.id });
      if (!response.ok) throw new Error(response.error);
      clearRoom();
      clear();
      navigate("/home");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setShowLeaveConfirm(false);
      setShowDisbandConfirm(false);
    }
  }
  const handleConfirmLeave = () => { void leaveOrDisband("room:pause"); };
  const handleConfirmDisband = () => { void leaveOrDisband("room:disband"); };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <Spinner className="mt-24" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-10">
          <Card>
            <p className="text-sm text-red-400">{error ?? "ไม่พบห้องนี้"}</p>
            <Button className="mt-4" onClick={() => setAttempt((n) => n + 1)}>ลองใหม่</Button>
            <Button variant="ghost" onClick={() => navigate("/history")}>กลับหน้าประวัติ</Button>
          </Card>
        </main>
      </div>
    );
  }

  const GameComponent = GAME_COMPONENTS[room.game.slug];

  if (!GameComponent || publicState == null || privateState == null) {
    return <div className="min-h-screen"><Navbar /><main className="mx-auto max-w-md px-4 py-10"><Card>
      <p>{!GameComponent ? "เกมนี้ยังไม่รองรับ" : "ไม่ได้รับข้อมูลเกม กรุณาลองใหม่"}</p>
      <Button className="mt-4" onClick={() => setAttempt((n) => n + 1)}>ลองใหม่</Button>
      <Button variant="ghost" onClick={() => navigate("/history")}>กลับหน้าประวัติ</Button>
    </Card></main></div>;
  }

  const isHost = room.hostId === currentUser?.id;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-2 px-4 pt-4 sm:px-6 sm:pt-6 lg:max-w-none lg:px-6">
        {isHost && (
          <Button variant="ghost" onClick={() => setShowDisbandConfirm(true)}>
            ยุบห้อง
          </Button>
        )}
        <Button variant="ghost" onClick={() => setShowLeaveConfirm(true)}>
          ออกจากเกม
        </Button>
      </div>
      <GameComponent
        room={room}
        publicState={publicState}
        privateState={privateState}
        selfUserId={currentUser?.id}
        onAction={handleAction}
        onReplay={handleReplay}
        scoreboard={scoreboard}
      />
      {showLeaveConfirm && (
        <ConfirmModal
          title="ออกจากเกม?"
          message="ถ้าออกตอนนี้ คุณจะพลาดสิ่งที่เกิดขึ้นระหว่างที่ไม่อยู่ แต่กลับเข้ามาเล่นต่อได้ทุกเมื่อ (หน้าประวัติเกม จะมีปุ่มให้กลับเข้าห้องนี้)"
          confirmLabel="ออกจากเกม"
          cancelLabel="เล่นต่อ"
          onConfirm={handleConfirmLeave}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}
      {showDisbandConfirm && (
        <ConfirmModal
          title="ยุบห้องนี้?"
          message="ห้องนี้จะถูกปิดสำหรับทุกคนทันที และเกมที่กำลังเล่นอยู่จะจบลงโดยไม่มีผลแพ้ชนะ ทุกคนจะถูกส่งกลับหน้าแรก"
          confirmLabel="ยุบห้อง"
          cancelLabel="ยกเลิก"
          onConfirm={handleConfirmDisband}
          onCancel={() => setShowDisbandConfirm(false)}
        />
      )}
    </div>
  );
}
