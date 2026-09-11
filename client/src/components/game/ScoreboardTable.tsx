import { Card } from "../common/Card";
import type { Scoreboard } from "../../types";

interface ScoreboardTableProps {
  scoreboard: Scoreboard;
}

// The match-wide score table - one row per player, one column per round
// played so far, plus a running total. Shared between the live in-game
// finished-round screen (SpyfallGame) and the lobby's post-match view
// (Lobby), since both need to show the exact same thing: "here's how the
// whole match went", not just the round that just ended.
export function ScoreboardTable({ scoreboard }: ScoreboardTableProps) {
  if (scoreboard.roundsPlayed === 0) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-300">ตารางคะแนนรวม</h2>
        {scoreboard.numberOfRounds && (
          <span className="text-xs text-slate-500">
            เล่นแล้ว {scoreboard.roundsPlayed} / {scoreboard.numberOfRounds} รอบ
          </span>
        )}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-500">
              <th className="pb-2 pr-3">ผู้เล่น</th>
              {scoreboard.rounds.map((r) => (
                <th key={r.round} className="px-2 pb-2 text-center">
                  รอบ {r.round}
                </th>
              ))}
              <th className="pb-2 pl-3 text-right">รวม</th>
            </tr>
          </thead>
          <tbody>
            {scoreboard.players.map((p) => {
              const total = scoreboard.totals.find((t) => t.userId === p.userId)?.total ?? 0;
              return (
                <tr key={p.userId} className="border-t border-slate-800">
                  <td className="py-2 pr-3 text-slate-200">{p.username}</td>
                  {scoreboard.rounds.map((r) => (
                    <td key={r.round} className="px-2 py-2 text-center text-slate-400">
                      {r.scores[p.userId] ?? 0}
                    </td>
                  ))}
                  <td className="py-2 pl-3 text-right font-semibold text-white">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
