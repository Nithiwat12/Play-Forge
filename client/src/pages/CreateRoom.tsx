import { IslandRoomSettings, islandDefaults } from "../games/island_betrayal/IslandRoomSettings";
import { RoleConfiguration } from "../components/roles/RoleConfiguration";
import type { RoleConfig, RoleDefinition } from "../components/roles/types";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { Button } from "../components/common/Button";
import { api, extractErrorMessage } from "../services/api";
import { useRoomStore } from "../stores/roomStore";
import { SPYFALL_CATEGORIES } from "../games/spyfall/categories";
import { WORDHEAD_CATEGORIES } from "../games/wordhead/categories";
import type { Room, RoomSettings } from "../types";

type CategoryMode = NonNullable<RoomSettings["categoryMode"]>;

// WordHead doesn't support PER_ROUND yet (see gameSocket's Spyfall-specific
// locationCategory coupling in the continue-vote layer) - only Spyfall gets
// that third option.


export function CreateRoom() {
  const { gameSlug } = useParams<{ gameSlug: string }>();
  const navigate = useNavigate();
  const setRoom = useRoomStore((s) => s.setRoom);

  const [roleConfig, setRoleConfig] = useState<RoleConfig>({});
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [islandSettings, setIslandSettings] = useState(islandDefaults);
  useEffect(() => { let cancelled = false; api.get<{game: {roleDefinitions?: RoleDefinition[]}}>(`/games/${gameSlug}`).then(r => { if (!cancelled) setRoleDefinitions(r.data.game.roleDefinitions ?? []); }).catch(() => {}); return () => { cancelled = true; }; }, [gameSlug]);
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [discussionMinutes, setDiscussionMinutes] = useState(8);
  const [limitRounds, setLimitRounds] = useState(false);
  const [numberOfRounds, setNumberOfRounds] = useState(3);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("RANDOM");
  const isIsland = gameSlug === "island_betrayal";
  const isWordHead = gameSlug === "wordhead";
  const isSpyfall = gameSlug === "spyfall";
  const CATEGORIES = isWordHead ? WORDHEAD_CATEGORIES : SPYFALL_CATEGORIES;
  const categoryLabel = isWordHead ? "หมวดหมู่คำ" : "หมวดหมู่สถานที่";
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);
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
        settings: isIsland ? { roleConfig, island: islandSettings } : {
          ...(roleDefinitions.length ? { roleConfig } : {}),
          ...(discussionMinutes ? { discussionMinutes } : {}),
          ...(limitRounds ? { numberOfRounds } : {}),
          categoryMode,
          ...(categoryMode === "FIXED" ? { category } : {}),
        },
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
              min={isIsland ? 4 : 3}
              max={isIsland ? 15 : 8}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            />
            <RoleConfiguration definitions={roleDefinitions} value={roleConfig} onChange={setRoleConfig} playerCount={maxPlayers} />
            {isIsland && <IslandRoomSettings value={islandSettings} onChange={setIslandSettings} />}
            {isSpyfall && (
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
            )}

            {!isIsland && <>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={limitRounds}
                onChange={(e) => setLimitRounds(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-600"
              />
              เล่นแบบหลายรอบสะสมคะแนน (ไม่ติ๊ก = แยกผลแต่ละเกม)
            </label>

            {limitRounds && (
              <Input
                id="numberOfRounds"
                type="number"
                label="จำนวนรอบที่จะเล่น"
                required={limitRounds}
                min={1}
                max={20}
                value={numberOfRounds}
                onChange={(e) => setNumberOfRounds(Number(e.target.value))}
              />
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="categoryMode" className="text-sm text-slate-300">
                {categoryLabel}
              </label>
              <select
                id="categoryMode"
                value={categoryMode}
                onChange={(e) => setCategoryMode(e.target.value as CategoryMode)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="RANDOM">สุ่มทุกรอบ (ทุกหมวดหมู่)</option>
                <option value="FIXED">เลือกหมวดหมู่คงที่ (ใช้ตลอดทั้งแมตช์)</option>
                {isSpyfall && (
                  <option value="PER_ROUND">ให้หัวหน้าห้องเลือกหมวดหมู่ก่อนเริ่มแต่ละรอบ</option>
                )}
              </select>

              {categoryMode === "FIXED" && (
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}

              {categoryMode === "PER_ROUND" && isSpyfall && (
                <p className="text-xs text-slate-500">
                  ก่อนเริ่มทุกรอบ (รวมรอบแรก) จะมีป๊อปอัปให้หัวหน้าห้องเลือกหมวดหมู่ใหม่หรือเล่นหมวดเดิมก็ได้
                  ผู้เล่นคนอื่นจะเห็นข้อความว่าหัวหน้าห้องกำลังเลือกอยู่ (ปิดหน้าต่างนี้ได้ แต่รอบจะยังไม่เริ่มนับเวลาจนกว่าจะเลือกเสร็จ)
                </p>
              )}
            </div>

            </>}
            {isIsland && <p className="rounded-lg bg-slate-900 p-4 text-sm text-slate-300">4–15 คน · กลางวันและกลางคืนยาวเท่ากัน · เกาะใหญ่ มอนสเตอร์ Spy และภารกิจ จบแล้วบันทึกแยกแต่ละเกม</p>}

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
