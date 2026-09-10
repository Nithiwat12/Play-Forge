import type { SpyfallPublicPlayer } from "./types";

interface PlayerListProps {
  players: SpyfallPublicPlayer[];
  selfUserId?: string;
  onAsk?: (userId: string) => void;
}

export function PlayerList({ players, selfUserId, onAsk }: PlayerListProps) {
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
          {onAsk && player.userId !== selfUserId && (
            <button
              onClick={() => onAsk(player.userId)}
              className="text-xs text-brand-400 hover:text-brand-300"
            >
              ถาม
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
