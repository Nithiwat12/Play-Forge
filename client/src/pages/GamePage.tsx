import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { api, extractErrorMessage } from "../services/api";
import type { Game } from "../types";

export function GamePage() {
  const { gameSlug } = useParams<{ gameSlug: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameSlug) return;
    let cancelled = false;
    setIsLoading(true);
    api
      .get<{ game: Game }>(`/games/${gameSlug}`)
      .then(({ data }) => {
        if (!cancelled) setGame(data.game);
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, "ไม่พบเกมนี้"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameSlug]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <button
          onClick={() => navigate("/home")}
          className="mb-4 text-sm text-slate-400 hover:text-white"
        >
          ← ย้อนกลับ
        </button>
        {isLoading && <Spinner className="mt-16" />}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {game && (
          <Card>
            <h1 className="text-2xl font-semibold text-white">{game.name}</h1>
            <p className="mt-2 text-sm text-slate-400">{game.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              {game.minPlayers}-{game.maxPlayers} ผู้เล่น
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Link to={`/games/${game.slug}/create`}>
                <Button className="w-full" variant="primary">
                  สร้างห้อง
                </Button>
              </Link>
              <Link to={`/games/${game.slug}/join`}>
                <Button className="w-full" variant="secondary">
                  เข้าร่วมห้อง
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
