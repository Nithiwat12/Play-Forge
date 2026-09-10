import { Link } from "react-router-dom";
import type { Game } from "../../types";
import { Button } from "../common/Button";
import { Card } from "../common/Card";

export function GameCard({ game }: { game: Game }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex h-32 items-center justify-center rounded-xl bg-gradient-to-br from-brand-800 to-slate-900 text-4xl">
        🎭
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{game.name}</h3>
        <p className="mt-1 text-sm text-slate-400">{game.description}</p>
        <p className="mt-2 text-xs text-slate-500">
          {game.minPlayers}-{game.maxPlayers} players
        </p>
      </div>
      <Link to={`/games/${game.slug}`}>
        <Button className="w-full">Play</Button>
      </Link>
    </Card>
  );
}
