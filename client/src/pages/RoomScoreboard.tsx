import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { ScoreboardTable } from "../components/game/ScoreboardTable";
import { api, extractErrorMessage } from "../services/api";
import type { Scoreboard } from "../types";

// A pure read-only view of a room's final match scoreboard - reached from
// the History page's "ดูตารางคะแนน" for a room whose match has already
// played out its full round count. Deliberately never joins the room (via
// room:join/subscribeToRoom) the way Lobby.tsx does: a match-complete room
// gets auto-closed by the server a few seconds after its last round ends
// (see gameSocket's scheduleMatchCompleteDisband), so by the time someone
// comes back to look at this later the room is very likely FINISHED - and
// joinRoom rejects any FINISHED room outright. The scoreboard REST endpoint
// itself doesn't care about room status, only that the room row still
// exists, so this works whether the room is still briefly around or long
// since closed.
export function RoomScoreboard() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Optional - the page that linked here (History's room list, or a single
  // round's result page) already has the room/game name from its own data,
  // so it's passed along to avoid a redundant lookup. Falls back to just
  // the room code if opened without it (e.g. a direct link). roomCode
  // itself always comes from the URL, never from this state.
  const header = (location.state as { header?: { gameName?: string; roomName?: string } } | null)?.header;

  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) { setError("ไม่พบรหัสห้อง"); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api
      .get<{ scoreboard: Scoreboard }>(`/rooms/${roomCode}/scoreboard`)
      .then((res) => {
        if (!cancelled) setScoreboard(res.data.scoreboard);
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, "โหลดตารางคะแนนไม่สำเร็จ"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <Card>
          <p className="text-sm text-slate-400">{header?.gameName ?? "ตารางคะแนน"}</p>
          <h1 className="text-xl font-semibold text-white">{header?.roomName ?? `ห้อง ${roomCode}`}</h1>
          <p className="mt-1 text-xs text-slate-500">ห้อง {roomCode}</p>

          {isLoading && <Spinner className="mt-8" />}
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          {!isLoading && !error && scoreboard && scoreboard.roundsPlayed === 0 && (
            <p className="mt-4 text-sm text-slate-500">แมตช์นี้ยังไม่มีรอบที่เล่นจบเลย</p>
          )}

          <Button className="mt-6" variant="secondary" onClick={() => navigate("/history")}>
            กลับไปที่ประวัติเกม
          </Button>
        </Card>

        {!isLoading && !error && scoreboard && scoreboard.roundsPlayed > 0 && (
          <div className="mt-4">
            <ScoreboardTable scoreboard={scoreboard} />
          </div>
        )}
      </main>
    </div>
  );
}
