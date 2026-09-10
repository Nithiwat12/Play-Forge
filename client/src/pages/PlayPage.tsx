import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Spinner } from "../components/common/Spinner";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { connectSocket, emitWithAck, getSocket } from "../services/socket";
import { useRoomStore } from "../stores/roomStore";
import { useGameStore } from "../stores/gameStore";
import { useAuthStore } from "../stores/authStore";
import { GAME_COMPONENTS } from "../games/registry";
import { extractErrorMessage } from "../services/api";
import type { Room } from "../types";

export function PlayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { room, setRoom, clearRoom } = useRoomStore();
  const { publicState, privateState, setState, clear } = useGameStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDisbandConfirm, setShowDisbandConfirm] = useState(false);

  useEffect(() => {
    if (!roomCode) return;
    const socket = connectSocket();
    let cancelled = false;

    async function ensureJoined() {
      try {
        const response = await emitWithAck<{ room: Room }>("room:join", { roomCode });
        if (cancelled) return;
        if (!response.ok) {
          setError(response.error);
          return;
        }
        setRoom(response.room);
        if (response.room.status === "WAITING") {
          // Game already ended (or never started) - send them to the lobby.
          navigate(`/lobby/${response.room.roomCode}`, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, "ไม่สามารถเข้าเกมได้"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    function handleGameState(payload: { public: unknown; private: unknown }) {
      setState(payload.public, payload.private);
    }

    function handleRoomUpdate({ room: updatedRoom }: { room: Room }) {
      setRoom(updatedRoom);
    }

    function handleDisbanded() {
      clearRoom();
      clear();
      navigate("/home", { replace: true });
    }

    socket.on("game:state", handleGameState);
    socket.on("room:update", handleRoomUpdate);
    socket.on("room:disbanded", handleDisbanded);
    ensureJoined();

    return () => {
      cancelled = true;
      socket.off("game:state", handleGameState);
      socket.off("room:update", handleRoomUpdate);
      socket.off("room:disbanded", handleDisbanded);
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  async function handleAction(actionType: string, payload: unknown) {
    const response = await emitWithAck("game:action", { roomId: room?.id, actionType, payload });
    return response.ok ? { ok: true } : { ok: false, error: response.error };
  }

  async function handleReplay() {
    const response = await emitWithAck("game:start", { roomId: room?.id });
    return response.ok ? { ok: true } : { ok: false, error: response.error };
  }

  function handleConfirmLeave() {
    if (room) {
      getSocket()?.emit("room:leave", { roomId: room.id });
    }
    clearRoom();
    clear();
    navigate("/home");
  }

  function handleConfirmDisband() {
    if (room) {
      getSocket()?.emit("room:disband", { roomId: room.id });
    }
    clearRoom();
    clear();
    navigate("/home");
  }

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
          </Card>
        </main>
      </div>
    );
  }

  const GameComponent = GAME_COMPONENTS[room.game.slug];

  if (!GameComponent || !publicState || !privateState) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <Spinner className="mt-24" />
      </div>
    );
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
