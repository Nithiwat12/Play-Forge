import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { GameCard } from "../components/game/GameCard";
import { Spinner } from "../components/common/Spinner";
import { api, extractErrorMessage } from "../services/api";
import type { Game } from "../types";

export function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // A one-off notice passed via navigation state (e.g. "your match just
  // ended" from SpyfallGame's back-to-home button) - read once on mount,
  // then immediately stripped from history state so refreshing or coming
  // back later never re-shows it.
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null
  );
  useEffect(() => {
    if ((location.state as { notice?: string } | null)?.notice) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ games: Game[] }>("/games")
      .then(({ data }) => {
        if (!cancelled) setGames(data.games);
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, "โหลดรายการเกมไม่สำเร็จ"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold text-white">คลังเกม</h1>
        <p className="mt-1 text-sm text-slate-400">
          เลือกเกมเพื่อสร้างหรือเข้าร่วมห้อง เกมใหม่จะแสดงที่นี่โดยอัตโนมัติ
        </p>

        {notice && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
            <span>🏆 {notice}</span>
            <button
              onClick={() => setNotice(null)}
              aria-label="ปิด"
              className="text-amber-500 hover:text-amber-200"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading && <Spinner className="mt-16" />}
        {error && <p className="mt-8 text-sm text-red-400">{error}</p>}

        {!isLoading && !error && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
