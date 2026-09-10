import type { RoomPlayer } from "../../types";

export function PlayerListItem({ player, isSelf }: { player: RoomPlayer; isSelf: boolean }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${player.connected ? "bg-emerald-500" : "bg-slate-600"}`}
          title={player.connected ? "Connected" : "Disconnected"}
        />
        <span className="text-sm font-medium text-slate-100">
          {player.username}
          {isSelf && <span className="text-slate-500"> (you)</span>}
        </span>
        {player.isHost && (
          <span className="rounded bg-brand-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-200">
            Host
          </span>
        )}
      </div>
      <span
        className={`text-xs font-medium ${player.isReady ? "text-emerald-400" : "text-slate-500"}`}
      >
        {player.isReady ? "Ready" : "Not ready"}
      </span>
    </li>
  );
}
