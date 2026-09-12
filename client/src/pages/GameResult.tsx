import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { ScoreboardTable } from "../components/game/ScoreboardTable";
import { WordHeadTimeTable } from "../games/wordhead/WordHeadTimeTable";
import type { WordHeadTimeEntry } from "../games/wordhead/WordHeadTimeTable";
import { api, extractErrorMessage } from "../services/api";
import type { HistoryEntry, Scoreboard } from "../types";

// Shaped after SpyfallResult (server/src/games/spyfall/SpyfallState.ts).
interface SpyfallResultDetails {
  winner?: "SPY" | "NON_SPY";
  reason?: string;
  spyUsername?: string;
  location?: string;
}

// Shaped after WordHeadResult (server/src/games/wordhead/WordHeadState.ts).
// Unlike every other game, LOWER is better here - see that file's note.
interface WordHeadResultDetails {
  scores?: Record<string, number>;
  correctUserIds?: string[];
  fastestUserId?: string | null;
  slowestUserId?: string | null;
}

interface ResultData {
  summary?: string;
  details?: SpyfallResultDetails & WordHeadResultDetails;
}

export function GameResult() {
  const { gameSessionId } = useParams<{ gameSessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const entry = (location.state as { entry?: HistoryEntry } | null)?.entry;
  const result = entry?.resultData as ResultData | null | undefined;
  const details = result?.details;
  const isWordHead = entry?.gameSlug === "wordhead";
  const hasSpyfallShape = !isWordHead && Boolean(details?.winner || details?.spyUsername);

  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [isLoadingScoreboard, setIsLoadingScoreboard] = useState(true);
  const [scoreboardError, setScoreboardError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) { setIsLoadingScoreboard(false); return; }
    let cancelled = false;
    setIsLoadingScoreboard(true);
    setScoreboardError(null);
    api
      .get<{ scoreboard: Scoreboard }>(`/rooms/${entry.roomCode}/scoreboard?gameSessionId=${encodeURIComponent(entry.gameSessionId)}`)
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
  }, [entry?.roomCode, entry?.gameSessionId]);

  // The Spy is a different person round to round, so "สปายคือ X" only ever
  // makes sense for a single round taken on its own - once the room has
  // played more than one round, this same page switches to a match-level
  // summary (top scorer + the full table) instead of repeating one round's
  // spy reveal as if it spoke for the whole match. A failed scoreboard
  // fetch falls back to the single-round view, since that much is always
  // available from the history entry itself regardless.
  const isMultiRound = !scoreboardError && (scoreboard?.roundsPlayed ?? 0) > 1;

  // WordHead's scores are seconds (lower = better) - the opposite of every
  // other game's points, so the match-level "winner" here is whoever has
  // the SMALLEST total, not the largest.
  const bestTotal = isWordHead
    ? (scoreboard?.totals.length ? Math.min(...scoreboard.totals.map((t) => t.total)) : 0)
    : (scoreboard?.totals[0]?.total ?? 0);
  const topScorers = isWordHead
    ? (scoreboard?.totals.filter((t) => t.total === bestTotal) ?? [])
    : bestTotal > 0
      ? (scoreboard?.totals.filter((t) => t.total === bestTotal) ?? [])
      : [];

  const cumulativeEntries: WordHeadTimeEntry[] = useMemo(
    () => (scoreboard?.totals ?? []).map((t) => ({ userId: t.userId, username: t.username, seconds: t.total })),
    [scoreboard]
  );

  const usernameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of scoreboard?.players ?? []) map.set(p.userId, p.username);
    return map;
  }, [scoreboard]);

  const singleRoundEntries: WordHeadTimeEntry[] = useMemo(() => {
    if (!isWordHead || !details?.scores) return [];
    return Object.entries(details.scores).map(([userId, seconds]) => ({
      userId,
      username: usernameByUserId.get(userId) ?? "ไม่ทราบชื่อ",
      seconds,
      correct: details.correctUserIds?.includes(userId) ?? false,
    }));
  }, [isWordHead, details, usernameByUserId]);

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
                <p className="mt-1 text-sm text-slate-400">
                  {isWordHead ? `ใช้เวลารวมน้อยที่สุด ${bestTotal.toFixed(1)} วินาที` : `รวม ${bestTotal} คะแนน`}
                </p>
              )}

              <Button className="mt-6" variant="secondary" onClick={() => navigate("/history")}>
                กลับไปที่ประวัติเกม
              </Button>
            </Card>

            {scoreboard && isWordHead && (
              <div className="mt-4">
                <WordHeadTimeTable entries={cumulativeEntries} title="เวลารวมสะสมทั้งแมตช์" />
              </div>
            )}
            {scoreboard && !isWordHead && (
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

            {isWordHead ? (
              <>
                {result?.summary && (
                  <p className="mt-4 rounded-lg bg-slate-900/70 p-4 text-sm text-slate-200">{result.summary}</p>
                )}
                {(details?.fastestUserId || details?.slowestUserId) && (
                  <p className="mt-3 text-sm text-slate-400">
                    {details?.fastestUserId && (
                      <>
                        ⚡ เร็วที่สุด:{" "}
                        <span className="text-white">
                          {usernameByUserId.get(details.fastestUserId) ?? "ไม่ทราบชื่อ"}
                        </span>
                      </>
                    )}
                    {details?.fastestUserId && details?.slowestUserId && details.fastestUserId !== details.slowestUserId && " · "}
                    {details?.slowestUserId && details.slowestUserId !== details.fastestUserId && (
                      <>
                        🐢 ช้าที่สุด:{" "}
                        <span className="text-white">
                          {usernameByUserId.get(details.slowestUserId) ?? "ไม่ทราบชื่อ"}
                        </span>
                      </>
                    )}
                  </p>
                )}
                {singleRoundEntries.length > 0 && (
                  <div className="mt-4">
                    <WordHeadTimeTable entries={singleRoundEntries} title="สรุปเวลารอบนี้" />
                  </div>
                )}
              </>
            ) : hasSpyfallShape ? (
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
