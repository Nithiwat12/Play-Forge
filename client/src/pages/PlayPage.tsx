import { useCallback, useEffect, useState } from "react";
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
          // Non-critical - the score table just won't show yet.
        });
    }

    async function ensureJoined() {
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

    function handleGameEnd(payload: { scoreboard?: Scoreboard | null }) {
      if (payload.scoreboard) setScoreboard(payload.scoreboard);
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
    socket.on("game:end", handleGameEnd);
    socket.on("room:update", handleRoomUpdate);
    socket.on("room:disbanded", handleDisbanded);
    // Re-run the join on every (re)connect, not just the first one - a brief
    // network drop otherwise leaves this socket silently out of the room
    // (Socket.IO's own auto-reconnect only restores the transport, not
    // room membership or which listeners the server thinks are "in").
    socket.on("connect", ensureJoined);
    if (socket.connected) ensureJoined();

    return () => {
      cancelled = true;
      socket.off("game:state", handleGameState);
      socket.off("game:end", handleGameEnd);
      socket.off("room:update", handleRoomUpdate);
      socket.off("room:disbanded", handleDisbanded);
      socket.off("connect", ensureJoined);
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Stable identities (via useCallback, keyed on the room id rather than
  // the whole room object which is replaced on every room:update) so the
  // game component below doesn't treat these as "new" props on every
  // unrelated re-render - see SpyfallGame.tsx's own useCallback usage for
  // why that matters for its memoized children.
  const roomId = room?.id;
  const handleAction = useCallback(
    async (actionType: string, payload: unknown) => {
      const response = await emitWithAck("game:action", { roomId, actionType, payload });
      return response.ok ? { ok: true } : { ok: false, error: response.error };
    },
    [roomId]
  );

  const handleReplay = useCallback(async () => {
    const response = await emitWithAck("game:start", { roomId });
    return response.ok ? { ok: true } : { ok: false, error: response.error };
  }, [roomId]);

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
