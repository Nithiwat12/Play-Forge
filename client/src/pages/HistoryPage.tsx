import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { api, extractErrorMessage } from "../services/api";
import type { HistoryEntry, Room } from "../types";

export function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeRooms, setActiveRooms] = useState<Room[]>([]);
  const [leftRooms, setLeftRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ history: HistoryEntry[] }>("/users/me/history"),
      api.get<{ rooms: Room[] }>("/users/me/active-rooms"),
      api.get<{ rooms: Room[] }>("/users/me/left-rooms"),
    ])
      .then(([historyRes, activeRes, leftRes]) => {
        setHistory(historyRes.data.history);
        setActiveRooms(activeRes.data.rooms);
        setLeftRooms(leftRes.data.rooms);
      })
      .catch((err) => setError(extractErrorMessage(err, "โหลดประวัติเกมไม่สำเร็จ")))
      .finally(() => setIsLoading(false));
  }, []);

  function handleRejoin(room: Room) {
    navigate(room.status === "WAITING" ? `/lobby/${room.roomCode}` : `/play/${room.roomCode}`);
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold text-white">ประวัติเกม</h1>
        <p className="mt-1 text-sm text-slate-400">เกมทุกรอบที่คุณเคยเล่น</p>

        {isLoading && <Spinner className="mt-16" />}
        {error && <p className="mt-8 text-sm text-red-400">{error}</p>}

        {!isLoading && !error && activeRooms.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
              เกมที่กำลังเล่นอยู่
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              ออกจากเกมไปโดยไม่ตั้งใจ? กลับเข้าไปเล่นต่อได้ที่นี่
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {activeRooms.map((room) => (
                <Card
                  key={room.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">
                      {room.game.name} - {room.roomName}
                    </p>
                    <p className="text-xs text-slate-500">
                      รหัสห้อง {room.roomCode} ·{" "}
                      {room.status === "WAITING" ? "รอในล็อบบี้" : "กำลังเล่น"}
                    </p>
                  </div>
                  <Button onClick={() => handleRejoin(room)}>กลับเข้าเกม</Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !error && leftRooms.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400">
              ห้องที่คุณออกมาแล้ว
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              ห้องเหล่านี้ยังไม่ถูกยุบ ถ้ายังอยู่ในล็อบบี้ (ยังไม่เริ่มเกม) กดเพื่อกลับเข้าไปได้
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {leftRooms.map((room) => (
                <Card
                  key={room.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">
                      {room.game.name} - {room.roomName}
                    </p>
                    <p className="text-xs text-slate-500">
                      รหัสห้อง {room.roomCode} ·{" "}
                      {room.status === "WAITING" ? "รอในล็อบบี้" : "กำลังเล่นอยู่"}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => handleRejoin(room)}>
                    เข้าห้องอีกครั้ง
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !error && history.length === 0 && activeRooms.length === 0 && leftRooms.length === 0 && (
          <p className="mt-8 text-sm text-slate-500">ยังไม่เคยเล่นเกมเลย</p>
        )}

        {!isLoading && !error && history.length > 0 && (
          <div className="mt-8">
            {(activeRooms.length > 0 || leftRooms.length > 0) && (
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                เกมที่จบแล้ว
              </h2>
            )}
            <div className="flex flex-col gap-3">
              {history.map((entry) => (
                <Card
                  key={entry.gameSessionId}
                  className="cursor-pointer transition hover:border-brand-600"
                  onClick={() => navigate(`/result/${entry.gameSessionId}`, { state: { entry } })}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">
                        {entry.gameName} - {entry.roomName}
                      </p>
                      <p className="text-xs text-slate-500">
                        ห้อง {entry.roomCode} - {new Date(entry.startedAt).toLocaleString("th-TH")}
                      </p>
                    </div>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium uppercase ${
                        entry.status === "COMPLETED"
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {entry.status === "COMPLETED"
                        ? "จบแล้ว"
                        : entry.status === "ABORTED"
                          ? "ยกเลิก"
                          : entry.status}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
