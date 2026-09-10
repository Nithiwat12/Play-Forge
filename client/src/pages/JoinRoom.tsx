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

export function JoinRoom() {
  const { gameSlug } = useParams<{ gameSlug: string }>();
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
      const message = extractErrorMessage(err, "เข้าห้องไม่สำเร็จ");
      if (message.includes("รหัสผ่าน")) {
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
      <main className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-10">
        <button
          onClick={() => navigate(gameSlug ? `/games/${gameSlug}` : "/home")}
          className="mb-4 text-sm text-slate-400 hover:text-white"
        >
          ← ย้อนกลับ
        </button>
        <Card>
          <h1 className="text-xl font-semibold text-white">เข้าร่วมห้อง</h1>
          <p className="mt-1 text-sm text-slate-400">กรอกรหัสห้องที่โฮสต์ส่งให้คุณ</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              id="roomCode"
              label="รหัสห้อง"
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
                label="รหัสผ่านห้อง"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
              เข้าร่วมห้อง
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
