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
  useEffect(() => { let cancelled = false; api.get<{game: {roleDefinitions?: RoleDefinition[]}}>(`/games/${gameSlug}`).then(r => { if (!cancelled) setRoleDefinitions(r.data.game.roleDefinitions ?? []); }).catch(() => {}); return () => { cancelled = true; }; }, [gameSlug]);
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [discussionMinutes, setDiscussionMinutes] = useState(8);
  const [limitRounds, setLimitRounds] = useState(false);
  const [numberOfRounds, setNumberOfRounds] = useState(3);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("RANDOM");
  const isIto = gameSlug === "ito";
  const [wordSource, setWordSource] = useState<"SYSTEM" | "PLAYERS">("SYSTEM");
  const [playMode, setPlayMode] = useState<"TABLE" | "ONLINE">("ONLINE");
  const [itoStages, setItoStages] = useState(3);
  const [itoMinutes, setItoMinutes] = useState(10);
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
        settings: isIto ? { playMode, ito: { mode: playMode, stages: itoStages, roundSeconds: itoMinutes * 60 } } : {
          playMode,
          ...(isWordHead ? { wordSource } : {}),
          ...(roleDefinitions.length ? { roleConfig } : {}),
          ...(discussionMinutes ? { discussionMinutes } : {}),
          ...(limitRounds ? { numberOfRounds } : {}),
          categoryMode: isWordHead && wordSource === "PLAYERS" ? "RANDOM" : categoryMode,
          ...(categoryMode === "FIXED" && !(isWordHead && wordSource === "PLAYERS") ? { category } : {}),
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
              min={isIto ? 2 : 3}
              max={8}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            />
            <fieldset className="space-y-4 rounded-xl border border-teal-800 p-5">
              <legend className="px-1 font-semibold text-slate-200">รูปแบบเล่น {isIto ? "ito" : isWordHead ? "WordHead" : "Spyfall"}</legend>
              <label htmlFor="playMode" className="block text-sm font-semibold text-slate-300">การสื่อสาร</label>
              <select id="playMode" className="w-full rounded-lg bg-slate-900 p-4 font-semibold text-white" value={playMode} onChange={e => setPlayMode(e.target.value as "TABLE" | "ONLINE")}>
                <option value="ONLINE">ออนไลน์ — {isSpyfall ? "พิมพ์ถาม–ตอบ" : "พิมพ์คำใบ้"} ไม่ใช้เสียง</option>
                <option value="TABLE">นั่งด้วยกัน — พูดคุยด้วยเสียง</option>
              </select>
              <p className="text-sm text-slate-400">{playMode === "ONLINE" ? "ในเกมจะแสดงช่องพิมพ์และปุ่มส่งข้อความ เล่นได้โดยไม่ต้องพูด" : "ในเกมจะแสดงปุ่มสำหรับพูดเล่นและยืนยัน ไม่แสดงช่องพิมพ์คำถามหรือคำใบ้"}</p>
              {isWordHead && <><label htmlFor="wordSource" className="block text-sm font-semibold text-slate-300">ที่มาของโจทย์</label><select id="wordSource" className="w-full rounded-lg bg-slate-900 p-4 text-white" value={wordSource} onChange={e => setWordSource(e.target.value as "SYSTEM" | "PLAYERS")}><option value="SYSTEM">ระบบสุ่มคำให้ทุกคน</option><option value="PLAYERS">ทุกคนพิมพ์โจทย์แล้วสุ่มให้คนอื่น</option></select><p className="text-sm text-slate-400">{wordSource === "SYSTEM" ? "สุ่มจากคลังคำที่เพิ่มคำยากขึ้นในทุกหมวด" : "เริ่มเกมแล้วทุกคนส่งโจทย์ลับคนละคำภายใน 3 นาที ระบบแจกโดยไม่มีใครได้คำของตัวเอง"}</p></>}
              {isIto && <><Input id="itoStages" label="จำนวนด่าน (เพิ่มไพ่คนละใบต่อด่าน)" type="number" min={1} max={3} required value={itoStages} onChange={e => setItoStages(Number(e.target.value))}/><Input id="itoMinutes" label="เวลาต่อด่าน (นาที)" type="number" min={2} max={20} required value={itoMinutes} onChange={e => setItoMinutes(Number(e.target.value))}/></>}
            </fieldset>
            <RoleConfiguration definitions={roleDefinitions} value={roleConfig} onChange={setRoleConfig} playerCount={maxPlayers} />
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

            {!isIto && <>
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

            {!(isWordHead && wordSource === "PLAYERS") && <div className="flex flex-col gap-2">
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
            </div>}

            </>}

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
