import { memo, useEffect, useState } from "react";

function formatSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Memoized so a chat message or vote elsewhere on the page doesn't force
// this to re-render too - it only cares about `endsAt`, a plain number,
// so the default shallow-prop comparison memo does is already enough.
export const Timer = memo(function Timer({ endsAt }: { endsAt: number | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!endsAt) return null;

  const remaining = Math.round((endsAt - now) / 1000);
  const isLow = remaining <= 30;

  return (
    <div
      className={`rounded-lg border px-4 py-2 font-mono text-lg ${
        isLow ? "border-red-700 bg-red-950 text-red-300" : "border-slate-700 bg-slate-900 text-white"
      }`}
    >
      {formatSeconds(remaining)}
    </div>
  );
});
