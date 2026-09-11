import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { ScoreboardTable } from "../components/game/ScoreboardTable";
import { api, extractErrorMessage } from "../services/api";
import type { HistoryEntry, Scoreboard } from "../types";

// Shaped after SpyfallResult (server/src/games/spyfall/SpyfallState.ts) -
// the only game registered today, so it's fine to know its fields here
// rather than fall back to a raw key/value dump. A future second game with
// a differently-shaped `details` just renders as the generic summary-only
// view below (see hasSpyfallShape).
interface SpyfallResultDetails {
  winner?: "SPY" | "NON_SPY";
  reason?: string;
  spyUsername?: string;
  location?: string;
}

interface ResultData {
  summary?: string;
  details?: SpyfallResultDetails;
}

export function GameResult() {
  const { gameSessionId } = useParams<{ gameSessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const entry = (location.state as { entry?: HistoryEntry } | null)?.entry;
  const result = entry?.resultData as ResultData | null | undefined;
  const details = result?.details;
  const hasSpyfallShape = Boolean(details?.winner || details?.spyUsername);

  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [isLoadingScoreboard, setIsLoadingScoreboard] = useState(true);
  const [scoreboardError, setScoreboardError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) { setIsLoadingScoreboard(false); return; }
    let cancelled = false;
    setIsLoadingScoreboard(true);
    setScoreboardError(null);
    api
      .get<{ scoreboard: Scoreboard }>(`/rooms/${entry.roomCode}/scoreboard`)
      .then((res) => {
        if (!cancelled) setScoreboard(res.data.scoreboard);
      })
      .catch((err) => {
        if (!cancelled) setScoreboardError(extractErrorMessage(err, "โหลดตารางคะแนนไม่สำเร็จ"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingScoreboard(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.roomCode]);

  // The Spy is a different person round to round, so "สปายคือ X" only ever
  // makes sense for a single round taken on its own - once the room has
  // played more than one round, this same page switches to a match-level
  // summary (top scorer + the full table) instead of repeating one round's
  // spy reveal as if it spoke for the whole match. A failed scoreboard
  // fetch falls back to the single-round view, since that much is always
  // available from the history entry itself regardless.
  const isMultiRound = !scoreboardError && (scoreboard?.roundsPlayed ?? 0) > 1;
  const maxTotal = scoreboard?.totals[0]?.total ?? 0;
  const topScorers = maxTotal > 0 ? (scoreboard?.totals.filter((t) => t.total === maxTotal) ?? []) : [];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        {!entry ? (
          <Card>
            <p className="text-sm text-slate-400">
              เปิดผลลัพธ์นี้จาก{" "}
              <button onClick={() => navigate("/history")} className="text-brand-400 underline">
                ประวัติเกม
              </button>{" "}
              เพื่อดูรายละเอียด
            </p>
            <p className="mt-2 text-xs text-slate-600">รหัสรอบเกม: {gameSessionId}</p>
          </Card>
        ) : isLoadingScoreboard ? (
          <Card>
            <Spinner className="mt-2" />
          </Card>
        ) : isMultiRound ? (
          <>
            <Card>
              <p className="text-sm text-slate-400">{entry.gameName}</p>
              <h1 className="text-xl font-semibold text-white">{entry.roomName}</h1>
              <p className="mt-1 text-xs text-slate-500">ห้อง {entry.roomCode}</p>

              <h2 className="mt-4 text-lg font-semibold text-white">
                {topScorers.length > 0
                  ? `🏆 ผู้ชนะคือ ${topScorers.map((t) => t.username).join(" และ ")}`
                  : "🏆 จบแมตช์แล้ว"}
              </h2>
              {topScorers.length > 0 && (
                <p className="mt-1 text-sm text-slate-400">รวม {maxTotal} คะแนน</p>
              )}

              <Button className="mt-6" variant="secondary" onClick={() => navigate("/history")}>
                กลับไปที่ประวัติเกม
              </Button>
            </Card>

            {scoreboard && (
              <div className="mt-4">
                <ScoreboardTable scoreboard={scoreboard} />
              </div>
            )}
          </>
        ) : (
          <Card>
            <p className="text-sm text-slate-400">{entry.gameName}</p>
            <h1 className="text-xl font-semibold text-white">{entry.roomName}</h1>
            <p className="mt-1 text-xs text-slate-500">
              ห้อง {entry.roomCode} - {new Date(entry.startedAt).toLocaleString("th-TH")}
            </p>

            {hasSpyfallShape ? (
              <>
                {details?.winner && (
                  <h2 className="mt-4 text-lg font-semibold text-white">
                    {details.winner === "SPY" ? "🕵️ สปายชนะ!" : "🏆 กลุ่มผู้เล่นชนะ!"}
                  </h2>
                )}

                {(details?.reason ?? result?.summary) && (
                  <p className="mt-2 rounded-lg bg-slate-900/70 p-4 text-sm text-slate-200">
                    {details?.reason ?? result?.summary}
                  </p>
                )}

                {(details?.spyUsername || details?.location) && (
                  <p className="mt-3 text-sm text-slate-400">
                    {details?.spyUsername && (
                      <>
                        สปายคือ <span className="text-white">{details.spyUsername}</span>
                      </>
                    )}
                    {details?.spyUsername && details?.location && " - "}
                    {details?.location && (
                      <>
                        สถานที่คือ <span className="text-white">{details.location}</span>
                      </>
                    )}
                  </p>
                )}
              </>
            ) : (
              result?.summary && (
                <p className="mt-4 rounded-lg bg-slate-900/70 p-4 text-sm text-slate-200">
                  {result.summary}
                </p>
              )
            )}

            {scoreboardError && <p className="mt-3 text-sm text-red-400">{scoreboardError}</p>}

            <Button className="mt-6" variant="secondary" onClick={() => navigate("/history")}>
              กลับไปที่ประวัติเกม
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
