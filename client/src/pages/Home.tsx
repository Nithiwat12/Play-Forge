import { useEffect, useState } from "react";
import { Navbar } from "../components/common/Navbar";
import { GameCard } from "../components/game/GameCard";
import { Spinner } from "../components/common/Spinner";
import { api, extractErrorMessage } from "../services/api";
import type { Game } from "../types";

export function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-white">คลังเกม</h1>
        <p className="mt-1 text-sm text-slate-400">
          เลือกเกมเพื่อสร้างหรือเข้าร่วมห้อง เกมใหม่จะแสดงที่นี่โดยอัตโนมัติ
        </p>

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
