import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import type { HistoryEntry } from "../types";

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
  scores?: Record<string, number>;
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
  // spyUserId/winnerUserIds and the raw votes/voteTally arrays deliberately
  // never surface here - a bare userId or vote array means nothing to a
  // player looking back at a past round, only the names do.
  const usernameByUserId = new Map((entry?.players ?? []).map((p) => [p.userId, p.username]));
  const hasSpyfallShape = Boolean(details?.winner || details?.spyUsername || details?.scores);
  const scoreEntries = Object.entries(details?.scores ?? {})
    .filter(([, pts]) => pts > 0)
    .sort(([, a], [, b]) => b - a);

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

                {scoreEntries.length > 0 && (
                  <div className="mt-4 rounded-lg bg-slate-900/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      คะแนนที่ได้รอบนี้
                    </p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-max text-left text-sm">
                        <thead>
                          <tr className="text-xs uppercase text-slate-500">
                            <th className="pb-2 pr-3">ผู้เล่น</th>
                            <th className="pb-2 pl-3 text-right">คะแนน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scoreEntries.map(([userId, pts]) => (
                            <tr key={userId} className="border-t border-slate-800">
                              <td className="py-2 pr-3 text-slate-200">
                                {usernameByUserId.get(userId) ?? "ไม่ทราบชื่อ"}
                              </td>
                              <td className="py-2 pl-3 text-right font-semibold text-emerald-400">
                                +{pts}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              result?.summary && (
                <p className="mt-4 rounded-lg bg-slate-900/70 p-4 text-sm text-slate-200">
                  {result.summary}
                </p>
              )
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() =>
                  navigate(`/scoreboard/${entry.roomCode}`, {
                    state: { header: { gameName: entry.gameName, roomName: entry.roomName } },
                  })
                }
              >
                ดูตารางคะแนนรวมทั้งแมตช์
              </Button>
              <Button variant="secondary" onClick={() => navigate("/history")}>
                กลับไปที่ประวัติเกม
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
