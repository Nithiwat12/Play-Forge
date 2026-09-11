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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  // Match-complete rooms are auto-closed by the server a few seconds after
  // their last round ends (see gameSocket's scheduleMatchCompleteDisband),
  // so by the time someone comes back here the room has very likely already
  // gone FINISHED - rejoining it would just fail with "ห้องนี้ปิดแล้ว". Go
  // straight to the read-only scoreboard view instead, which works
  // regardless of the room's status.
  function handleViewScoreboard(room: Room) {
    navigate(`/scoreboard/${room.roomCode}`, {
      state: { header: { gameName: room.game.name, roomName: room.roomName } },
    });
  }

  // Each card now represents a whole room (see server UserService's
  // getHistoryForUser), so deleting it removes every round played there
  // from this user's history at once, not just the one round shown.
  async function handleDeleteHistory(entry: HistoryEntry) {
    const confirmMessage =
      entry.roundsInHistory > 1
        ? `ลบประวัติเกมนี้ทั้งหมด (${entry.roundsInHistory} รอบ)? การกระทำนี้ไม่สามารถย้อนกลับได้`
        : "ลบประวัติเกมนี้? การกระทำนี้ไม่สามารถย้อนกลับได้";
    if (!window.confirm(confirmMessage)) return;
    setDeletingId(entry.gameSessionId);
    try {
      await api.delete(`/users/me/history/room/${entry.roomId}`);
      setHistory((prev) => prev.filter((e) => e.roomId !== entry.roomId));
    } catch (err) {
      setError(extractErrorMessage(err, "ลบประวัติเกมไม่สำเร็จ"));
    } finally {
      setDeletingId(null);
    }
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
                      {room.matchComplete
                        ? "จบแมตช์แล้ว"
                        : room.status === "WAITING"
                          ? "รอในล็อบบี้"
                          : "กำลังเล่น"}
                    </p>
                  </div>
                  <Button onClick={() => (room.matchComplete ? handleViewScoreboard(room) : handleRejoin(room))}>
                    {room.matchComplete ? "ดูตารางคะแนน" : "กลับเข้าเกม"}
                  </Button>
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
                      {room.matchComplete
                        ? "จบแมตช์แล้ว"
                        : room.status === "WAITING"
                          ? "รอในล็อบบี้"
                          : "กำลังเล่นอยู่"}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => (room.matchComplete ? handleViewScoreboard(room) : handleRejoin(room))}
                  >
                    {room.matchComplete ? "ดูตารางคะแนน" : "เข้าห้องอีกครั้ง"}
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
                        {entry.roundsInHistory > 1 && ` · เล่น ${entry.roundsInHistory} รอบ`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                      <button
                        type="button"
                        aria-label="ลบประวัตินี้"
                        title="ลบประวัตินี้"
                        disabled={deletingId === entry.gameSessionId}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHistory(entry);
                        }}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-red-950 hover:text-red-400 disabled:opacity-50"
                      >
                        {deletingId === entry.gameSessionId ? "..." : "ลบ"}
                      </button>
                    </div>
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
