import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import type { HistoryEntry } from "../types";

interface ResultData {
  summary?: string;
  winnerUserIds?: string[];
  details?: Record<string, unknown>;
}

export function GameResult() {
  const { gameSessionId } = useParams<{ gameSessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const entry = (location.state as { entry?: HistoryEntry } | null)?.entry;
  const result = entry?.resultData as ResultData | null | undefined;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-10">
        {!entry ? (
          <Card>
            <p className="text-sm text-slate-400">
              Open this result from your{" "}
              <button onClick={() => navigate("/history")} className="text-brand-400 underline">
                game history
              </button>{" "}
              to see the details.
            </p>
            <p className="mt-2 text-xs text-slate-600">Session: {gameSessionId}</p>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-slate-400">{entry.gameName}</p>
            <h1 className="text-xl font-semibold text-white">{entry.roomName}</h1>
            <p className="mt-1 text-xs text-slate-500">
              Room {entry.roomCode} - {new Date(entry.startedAt).toLocaleString()}
            </p>

            {result?.summary && (
              <p className="mt-4 rounded-lg bg-slate-900/70 p-4 text-sm text-slate-200">
                {result.summary}
              </p>
            )}

            {result?.details && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {Object.entries(result.details)
                  .filter(([key]) => !["votes", "voteTally"].includes(key))
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
                      <dd className="text-slate-200">{String(value)}</dd>
                    </div>
                  ))}
              </dl>
            )}

            <Button className="mt-6" variant="secondary" onClick={() => navigate("/history")}>
              Back to history
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
