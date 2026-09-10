import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { Button } from "../components/common/Button";
import { api, extractErrorMessage } from "../services/api";
import { useRoomStore } from "../stores/roomStore";
import type { Room } from "../types";

export function JoinRoom() {
  const navigate = useNavigate();
  const setRoom = useRoomStore((s) => s.setRoom);

  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { data } = await api.post<{ room: Room }>("/rooms/join", {
        roomCode: roomCode.trim().toUpperCase(),
        password: needsPassword ? password : undefined,
      });
      setRoom(data.room);
      navigate(`/lobby/${data.room.roomCode}`);
    } catch (err) {
      const message = extractErrorMessage(err, "Could not join room");
      if (message.toLowerCase().includes("password")) {
        setNeedsPassword(true);
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-md px-6 py-10">
        <Card>
          <h1 className="text-xl font-semibold text-white">Join a room</h1>
          <p className="mt-1 text-sm text-slate-400">Enter the room code your host shared.</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              id="roomCode"
              label="Room Code"
              required
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              className="tracking-widest"
            />

            {needsPassword && (
              <Input
                id="password"
                type="password"
                label="Room Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
              Join Room
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
