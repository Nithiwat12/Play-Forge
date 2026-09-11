import type { WordHeadPublicPlayer } from "./types";

interface PlayerBoardProps {
  players: WordHeadPublicPlayer[];
  wordsByUserId: Record<string, string>;
  currentTurnUserId: string | null;
  selfUserId?: string;
}

// Shows every player's word "held up on their head" - visible to everyone
// except themselves, exactly like the physical game. The current player's
// own row deliberately never shows a word (wordsByUserId never contains
// their own key - see WordHeadGame.getPrivateState).
export function PlayerBoard({ players, wordsByUserId, currentTurnUserId, selfUserId }: PlayerBoardProps) {
  return (
    <div className="flex flex-col gap-2">
      {players.map((p) => {
        const isSelf = p.userId === selfUserId;
        const isTurn = p.userId === currentTurnUserId;
        const word = wordsByUserId[p.userId];
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
                  ตากำลังเล่น
                </span>
              )}
              {p.guessedCorrectly && (
                <span className="flex-shrink-0 rounded bg-emerald-900 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                  ทายถูกแล้ว
                </span>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-3 text-xs text-slate-400">
              {!isSelf && word && <span className="font-mono text-sm text-amber-300">{word}</span>}
              {isSelf && !p.guessedCorrectly && <span className="italic text-slate-600">???</span>}
              <span>คะแนน {p.score}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
