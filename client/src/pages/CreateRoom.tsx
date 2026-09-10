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

interface CustomLocationDraft {
  name: string;
  rolesText: string;
}

export function CreateRoom() {
  const { gameSlug } = useParams<{ gameSlug: string }>();
  const navigate = useNavigate();
  const setRoom = useRoomStore((s) => s.setRoom);

  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [discussionMinutes, setDiscussionMinutes] = useState(8);
  const [customLocations, setCustomLocations] = useState<CustomLocationDraft[]>([]);
  const [onlyCustomLocations, setOnlyCustomLocations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleAddLocation() {
    setCustomLocations((prev) => [...prev, { name: "", rolesText: "" }]);
  }

  function handleRemoveLocation(index: number) {
    setCustomLocations((prev) => prev.filter((_, i) => i !== index));
  }

  function handleLocationChange(index: number, field: keyof CustomLocationDraft, value: string) {
    setCustomLocations((prev) =>
      prev.map((loc, i) => (i === index ? { ...loc, [field]: value } : loc))
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedLocations = customLocations
      .map((loc) => ({
        name: loc.name.trim(),
        roles: loc.rolesText
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
      }))
      .filter((loc) => loc.name.length > 0 || loc.roles.length > 0);

    const incomplete = trimmedLocations.find((loc) => !loc.name || loc.roles.length < 2);
    if (incomplete) {
      setError("แต่ละสถานที่ที่เพิ่มเองต้องมีชื่อและอาชีพอย่างน้อย 2 อาชีพ (คั่นด้วยจุลภาค)");
      return;
    }

    setIsLoading(true);
    try {
      const settings: Record<string, unknown> = {};
      if (discussionMinutes) settings.discussionMinutes = discussionMinutes;
      if (trimmedLocations.length > 0) {
        settings.customLocations = trimmedLocations;
        if (onlyCustomLocations) settings.onlyCustomLocations = true;
      }

      const { data } = await api.post<{ room: Room }>("/rooms", {
        gameSlug,
        roomName,
        maxPlayers,
        usePassword,
        password: usePassword ? password : undefined,
        settings: Object.keys(settings).length > 0 ? settings : undefined,
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
      <main className="mx-auto max-w-md px-6 py-10">
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

            <div className="rounded-lg border border-slate-800 p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300">สถานที่ที่เพิ่มเอง (ไม่บังคับ)</h2>
                <Button type="button" variant="ghost" onClick={handleAddLocation}>
                  + เพิ่มสถานที่
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                ถ้าไม่เพิ่ม ระบบจะใช้ชุดสถานที่มาตรฐานของเกม
              </p>

              {customLocations.length > 0 && (
                <div className="mt-3 flex flex-col gap-3">
                  {customLocations.map((loc, index) => (
                    <div key={index} className="rounded-lg bg-slate-900/60 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={loc.name}
                          onChange={(e) => handleLocationChange(index, "name", e.target.value)}
                          placeholder="ชื่อสถานที่ เช่น สวนสัตว์"
                          maxLength={40}
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveLocation(index)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          ลบ
                        </button>
                      </div>
                      <input
                        value={loc.rolesText}
                        onChange={(e) => handleLocationChange(index, "rolesText", e.target.value)}
                        placeholder="อาชีพ คั่นด้วยจุลภาค เช่น ผู้ดูแลสัตว์, สัตวแพทย์, นักท่องเที่ยว"
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                  ))}

                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={onlyCustomLocations}
                      onChange={(e) => setOnlyCustomLocations(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-600"
                    />
                    ใช้เฉพาะสถานที่ที่เพิ่มเอง (ไม่ใช้ชุดมาตรฐาน)
                  </label>
                </div>
              )}
            </div>

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
