import { useState } from "react";
import { Link } from "react-router-dom";
import type { Game } from "../../types";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { HowToPlayModal } from "./HowToPlayModal";

// Per-game library-card icon, keyed by slug - a future game just adds its
// own entry here; anything unrecognized falls back to the generic mask.
const GAME_ICONS: Record<string, string> = {
  island_betrayal: "🏝️",
  spyfall: "🕵️",
  wordhead: "🧠",
};

export function GameCard({ game }: { game: Game }) {
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <Card className="flex flex-col gap-4">
      <div className="relative flex h-32 items-center justify-center rounded-xl bg-gradient-to-br from-brand-800 to-slate-900 text-4xl">
        {GAME_ICONS[game.slug] ?? "🎭"}
        <button
          onClick={() => setShowHowToPlay(true)}
          title="วิธีเล่น"
          aria-label="วิธีเล่น"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950/70 text-lg hover:bg-slate-950"
        >
          📔
        </button>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{game.name}</h3>
        <p className="mt-1 text-sm text-slate-400">{game.description}</p>
        <p className="mt-2 text-xs text-slate-500">
          {game.minPlayers}-{game.maxPlayers} ผู้เล่น
        </p>
      </div>
      <Link to={`/games/${game.slug}`}>
        <Button className="w-full">เล่น</Button>
      </Link>

      {showHowToPlay && (
        <HowToPlayModal gameSlug={game.slug} onClose={() => setShowHowToPlay(false)} />
      )}
    </Card>
  );
}
