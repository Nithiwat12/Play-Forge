import { memo, useEffect, useState } from "react";

function formatElapsed(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.floor(clamped % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Counts UP with no end - the opposite of the shared Timer (which counts
// down to a fixed endsAt) - since a hot-seat turn keeps going until the up
// player guesses right or gives up, not until a clock runs out.
export const Stopwatch = memo(function Stopwatch({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const elapsed = (now - startedAt) / 1000;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-lg text-white">
      ⏱️ {formatElapsed(elapsed)}
    </div>
  );
});
