import { memo } from "react";
import type { SpyfallPublicPlayer } from "./types";
import { playersSignature } from "../../utils/memoCompare";

interface PlayerListProps {
  players: SpyfallPublicPlayer[];
  selfUserId?: string;
  // Whoever's turn it is to pick someone to ask, if any - shown as a badge
  // instead of a per-row "ถาม" button now that asking is a strict relay
  // driven by AskTargetModal (see SpyfallGame.tsx), not a free-for-all
  // anyone could click into at any time.
  askerUserId?: string | null;
  pendingTargetUserId?: string | null;
}

function PlayerListImpl({ players, selfUserId, askerUserId, pendingTargetUserId }: PlayerListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {players.map((player) => (
        <li
          key={player.userId}
          className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5"
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${player.connected ? "bg-emerald-500" : "bg-slate-600"}`}
            />
            <span className="text-sm text-slate-100">
              {player.username}
              {player.userId === selfUserId && <span className="text-slate-500"> (คุณ)</span>}
            </span>
            {player.hasVoted && (
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-400">
                โหวตแล้ว
              </span>
            )}
          </div>
          {player.userId === askerUserId && (
            <span className="text-xs font-medium text-brand-400">กำลังถาม...</span>
          )}
          {player.userId === pendingTargetUserId && (
            <span className="text-xs font-medium text-amber-400">กำลังถูกถาม</span>
          )}
        </li>
      ))}
    </ul>
  );
}

// `players` is a fresh array reference on every single game:state
// broadcast (a new question, a vote, the timer resolving, ...) even when
// this particular list of names/status hasn't changed, so plain memo
// would never help - compare the actual player values instead.
export const PlayerList = memo(PlayerListImpl, (prev, next) => {
  return (
    prev.selfUserId === next.selfUserId &&
    prev.askerUserId === next.askerUserId &&
    prev.pendingTargetUserId === next.pendingTargetUserId &&
    playersSignature(prev.players) === playersSignature(next.players)
  );
});
