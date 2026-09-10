import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { Button } from "../components/common/Button";
import { api, extractErrorMessage } from "../services/api";
import { useRoomStore } from "../stores/roomStore";
import type { Room } from "../types";

export function CreateRoom() {
  const { gameSlug } = useParams<{ gameSlug: string }>();
  const navigate = useNavigate();
  const setRoom = useRoomStore((s) => s.setRoom);

  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { data } = await api.post<{ room: Room }>("/rooms", {
        gameSlug,
        roomName,
        maxPlayers,
        usePassword,
        password: usePassword ? password : undefined,
      });
      setRoom(data.room);
      navigate(`/lobby/${data.room.roomCode}`);
    } catch (err) {
      setError(extractErrorMessage(err, "Could not create room"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-md px-6 py-10">
        <Card>
          <h1 className="text-xl font-semibold text-white">Create a room</h1>
          <p className="mt-1 text-sm text-slate-400">Set up a room for {gameSlug}.</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              id="roomName"
              label="Room Name"
              required
              minLength={3}
              maxLength={40}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Friday Night Spies"
            />
            <Input
              id="maxPlayers"
              type="number"
              label="Maximum Players"
              required
              min={3}
              max={8}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            />

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-600"
              />
              Use Password
            </label>

            {usePassword && (
              <Input
                id="password"
                type="password"
                label="Password"
                required={usePassword}
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
              Create Room
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
