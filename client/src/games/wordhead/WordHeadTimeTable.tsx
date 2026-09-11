import { Card } from "../../components/common/Card";

export interface WordHeadTimeEntry {
  userId: string;
  username: string;
  seconds: number;
  // Omit when the entry isn't about a single round's guess (e.g. a
  // cumulative multi-round total) - the "ข้ามตา" badge only makes sense
  // for one round's real outcome.
  correct?: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)} วินาที`;
}

// Ranks fastest-first (LOWER time is better for this game - the opposite
// of every other game's points table) - reused by both the in-game
// finished panel (WordHeadGame.tsx) and the standalone result page
// (GameResult.tsx) so the two stay visually consistent.
export function WordHeadTimeTable({ entries, title = "สรุปเวลาแต่ละคน" }: { entries: WordHeadTimeEntry[]; title?: string }) {
  const sorted = [...entries].sort((a, b) => a.seconds - b.seconds);
  if (sorted.length === 0) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
        <span className="text-xs text-slate-500">ยิ่งใช้เวลาน้อยยิ่งดี</span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {sorted.map((entry, index) => (
          <li
            key={entry.userId}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/60 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 text-center">{MEDALS[index] ?? `#${index + 1}`}</span>
              <span className="text-slate-200">{entry.username}</span>
              {entry.correct === false && (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  ข้ามตา
                </span>
              )}
            </div>
            <span className="font-mono font-semibold text-emerald-400">{formatSeconds(entry.seconds)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
