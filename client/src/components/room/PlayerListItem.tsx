import { memo } from "react";
import type { RoomPlayer } from "../../types";

function PlayerListItemImpl({ player, isSelf }: { player: RoomPlayer; isSelf: boolean }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${player.connected ? "bg-emerald-500" : "bg-slate-600"}`}
          title={player.connected ? "ออนไลน์" : "ออฟไลน์"}
        />
        <span className="text-sm font-medium text-slate-100">
          {player.username}
          {isSelf && <span className="text-slate-500"> (คุณ)</span>}
        </span>
        {player.isHost && (
          <span className="rounded bg-brand-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-200">
            โฮสต์
          </span>
        )}
      </div>
      <span
        className={`text-xs font-medium ${player.isReady ? "text-emerald-400" : "text-slate-500"}`}
      >
        {player.isReady ? "พร้อมแล้ว" : "ยังไม่พร้อม"}
      </span>
    </li>
  );
}

// The Lobby re-renders every player's row on every room:update broadcast
// (e.g. one person toggling ready), and RoomService always sends a fresh
// player array - compare by value so the other rows skip re-rendering.
export const PlayerListItem = memo(PlayerListItemImpl, (prev, next) => {
  const a = prev.player;
  const b = next.player;
  return (
    prev.isSelf === next.isSelf &&
    a.userId === b.userId &&
    a.username === b.username &&
    a.connected === b.connected &&
    a.isHost === b.isHost &&
    a.isReady === b.isReady
  );
});
