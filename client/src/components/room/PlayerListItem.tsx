import { memo } from "react";
import type { RoomPlayer } from "../../types";

interface PlayerListItemProps {
  player: RoomPlayer;
  isSelf: boolean;
  // Only true for the host's own row, looking at someone else's - lets
  // this row show a kick button without every caller needing to redo that
  // "am I the host, and is this someone else" check itself.
  canKick?: boolean;
  onKick?: () => void;
}

function PlayerListItemImpl({ player, isSelf, canKick, onKick }: PlayerListItemProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`h-2 w-2 flex-shrink-0 rounded-full ${player.connected ? "bg-emerald-500" : "bg-slate-600"}`}
          title={player.connected ? "ออนไลน์" : "ออฟไลน์"}
        />
        <span className="truncate text-sm font-medium text-slate-100">
          {player.username}
          {isSelf && <span className="text-slate-500"> (คุณ)</span>}
        </span>
        {player.isHost && (
          <span className="flex-shrink-0 rounded bg-brand-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-200">
            โฮสต์
          </span>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
        <span
          className={`text-xs font-medium ${player.isReady ? "text-emerald-400" : "text-slate-500"}`}
        >
          {player.isReady ? "พร้อมแล้ว" : "ยังไม่พร้อม"}
        </span>
        {canKick && (
          <button
            onClick={onKick}
            className="text-xs font-medium text-red-400 hover:text-red-300 hover:underline"
          >
            เตะออก
          </button>
        )}
      </div>
    </li>
  );
}

// The Lobby re-renders every player's row on every room:update broadcast
// (e.g. one person toggling ready), and RoomService always sends a fresh
// player array - compare by value so the other rows skip re-rendering.
// onKick is a freshly-bound closure every render (it captures this row's
// own userId) so it's deliberately excluded from the comparison - canKick
// already tells us whether it's even relevant.
export const PlayerListItem = memo(PlayerListItemImpl, (prev, next) => {
  const a = prev.player;
  const b = next.player;
  return (
    prev.isSelf === next.isSelf &&
    prev.canKick === next.canKick &&
    a.userId === b.userId &&
    a.username === b.username &&
    a.connected === b.connected &&
    a.isHost === b.isHost &&
    a.isReady === b.isReady
  );
});
