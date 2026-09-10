import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Spinner } from "../components/common/Spinner";
import { Card } from "../components/common/Card";
import { connectSocket, emitWithAck } from "../services/socket";
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
  const { room, setRoom } = useRoomStore();
  const { publicState, privateState, setState, clear } = useGameStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (!cancelled) setError(extractErrorMessage(err, "Could not reach the game"));
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

    socket.on("game:state", handleGameState);
    socket.on("room:update", handleRoomUpdate);
    ensureJoined();

    return () => {
      cancelled = true;
      socket.off("game:state", handleGameState);
      socket.off("room:update", handleRoomUpdate);
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  async function handleAction(actionType: string, payload: unknown) {
    const response = await emitWithAck("game:action", { roomId: room?.id, actionType, payload });
    return response.ok ? { ok: true } : { ok: false, error: response.error };
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
        <main className="mx-auto max-w-md px-6 py-10">
          <Card>
            <p className="text-sm text-red-400">{error ?? "Room not found"}</p>
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

  return (
    <div className="min-h-screen">
      <Navbar />
      <GameComponent
        room={room}
        publicState={publicState}
        privateState={privateState}
        selfUserId={currentUser?.id}
        onAction={handleAction}
      />
    </div>
  );
}
