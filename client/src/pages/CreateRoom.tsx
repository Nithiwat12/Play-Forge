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
  const [discussionMinutes, setDiscussionMinutes] = useState(8);
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
        settings: discussionMinutes ? { discussionMinutes } : undefined,
      });
      setRoom(data.room);
      navigate(`/lobby/${data.room.roomCode}`);
    } catch (err) {
      setError(extractErrorMessage(err, "สร้างห้องไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-10">
        <button
          onClick={() => navigate(`/games/${gameSlug}`)}
          className="mb-4 text-sm text-slate-400 hover:text-white"
        >
          ← ย้อนกลับ
        </button>
        <Card>
          <h1 className="text-xl font-semibold text-white">สร้างห้อง</h1>
          <p className="mt-1 text-sm text-slate-400">ตั้งค่าห้องสำหรับ {gameSlug}</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              id="roomName"
              label="ชื่อห้อง"
              required
              minLength={3}
              maxLength={40}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="เช่น สายลับคืนวันศุกร์"
            />
            <Input
              id="maxPlayers"
              type="number"
              label="จำนวนผู้เล่นสูงสุด"
              required
              min={3}
              max={8}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            />
            <Input
              id="discussionMinutes"
              type="number"
              label="เวลาพูดคุยต่อรอบ (นาที)"
              required
              min={3}
              max={20}
              value={discussionMinutes}
              onChange={(e) => setDiscussionMinutes(Number(e.target.value))}
            />

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-600"
              />
              ตั้งรหัสผ่านห้อง
            </label>

            {usePassword && (
              <Input
                id="password"
                type="password"
                label="รหัสผ่าน"
                required={usePassword}
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
              สร้างห้อง
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
