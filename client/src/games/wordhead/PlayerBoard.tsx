import type { WordHeadPublicPlayer } from "./types";

interface PlayerBoardProps {
  players: WordHeadPublicPlayer[];
  currentTurnUserId: string | null;
  selfUserId?: string;
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)} วิ`;
}

// Hot-seat roster: highlights whoever's up right now, and shows each
// finished player's time once they've gone (lower is better - see
// types.ts's file-level note) with a checkmark for a real guess vs. an X
// for a give-up.
export function PlayerBoard({ players, currentTurnUserId, selfUserId }: PlayerBoardProps) {
  return (
    <div className="flex flex-col gap-2">
      {players.map((p) => {
        const isSelf = p.userId === selfUserId;
        const isTurn = p.userId === currentTurnUserId;
        return (
          <div
            key={p.userId}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
              isTurn ? "border-brand-600 bg-brand-950/40" : "border-slate-800 bg-slate-900/60"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${p.connected ? "bg-emerald-500" : "bg-slate-600"}`}
              />
              <span className="truncate text-sm font-medium text-slate-200">
                {p.username}
                {isSelf && " (คุณ)"}
              </span>
              {isTurn && (
                <span className="flex-shrink-0 rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-semibold text-brand-200">
                  กำลังเล่น
                </span>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2 text-xs text-slate-400">
              {p.hasGone ? (
                <span className={p.guessedCorrectly ? "text-emerald-400" : "text-slate-500"}>
                  {p.guessedCorrectly ? "✅" : "⏭️"} {p.timeUsedSeconds != null && formatSeconds(p.timeUsedSeconds)}
                </span>
              ) : isTurn ? (
                <span className="italic text-amber-400">กำลังทาย...</span>
              ) : (
                <span className="italic text-slate-600">รอคิว</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
