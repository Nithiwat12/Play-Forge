import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import { api, extractErrorMessage } from "../services/api";
import type { HistoryEntry } from "../types";

export function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ history: HistoryEntry[] }>("/users/me/history")
      .then(({ data }) => setHistory(data.history))
      .catch((err) => setError(extractErrorMessage(err, "Could not load history")))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-white">Game History</h1>
        <p className="mt-1 text-sm text-slate-400">Every game session you've taken part in.</p>

        {isLoading && <Spinner className="mt-16" />}
        {error && <p className="mt-8 text-sm text-red-400">{error}</p>}

        {!isLoading && !error && history.length === 0 && (
          <p className="mt-8 text-sm text-slate-500">No games played yet.</p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {history.map((entry) => (
            <Card
              key={entry.gameSessionId}
              className="cursor-pointer transition hover:border-brand-600"
              onClick={() => navigate(`/result/${entry.gameSessionId}`, { state: { entry } })}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">
                    {entry.gameName} - {entry.roomName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Room {entry.roomCode} - {new Date(entry.startedAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium uppercase ${
                    entry.status === "COMPLETED"
                      ? "bg-emerald-950 text-emerald-400"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {entry.status}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
