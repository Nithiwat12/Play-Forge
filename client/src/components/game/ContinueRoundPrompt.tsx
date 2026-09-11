import { useEffect, useState } from "react";
import { Card } from "../common/Card";
import { Button } from "../common/Button";

export interface ContinuePollInfo {
  deadline: number;
  totalPlayers: number;
  votesFor: number;
  votesAgainst: number;
  myVote: boolean | null;
}

export interface ContinueResolutionInfo {
  nextRoundAt: number;
}

interface ContinueRoundPromptProps {
  poll: ContinuePollInfo | null;
  resolution: ContinueResolutionInfo | null;
  error: string | null;
  isSubmittingVote: boolean;
  isSkipping: boolean;
  onVote: (wantsContinue: boolean) => void;
  onSkip: () => void;
  onDismissResolution: () => void;
  onDismissError: () => void;
}

// Ticks down to a target timestamp every second, entirely client-side for
// display purposes only - the actual transition (next round starting, or
// the poll timing out) is always driven by the server, so a slow tab or a
// clock a few seconds off never desyncs anything, it just shows a slightly
// stale number for a moment.
function useCountdownSeconds(targetMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs == null) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [targetMs]);

  if (targetMs == null) return 0;
  return Math.max(0, Math.ceil((targetMs - now) / 1000));
}

/**
 * Game-agnostic "play another round?" flow, shown after any game's round
 * ends with the match not yet complete (see Scoreboard.matchComplete).
 * Deliberately lives outside any specific game component - it only ever
 * looks at generic room/scoreboard concepts, so it works the same way no
 * matter which game is active. Rendered as fixed-position overlays so it
 * shows up on top of whatever the active game is already displaying (the
 * finished-round/scoreboard screen), without that screen needing to know
 * this exists.
 */
export function ContinueRoundPrompt({
  poll,
  resolution,
  error,
  isSubmittingVote,
  isSkipping,
  onVote,
  onSkip,
  onDismissResolution,
  onDismissError,
}: ContinueRoundPromptProps) {
  const pollSecondsLeft = useCountdownSeconds(poll?.deadline ?? null);
  const nextRoundSecondsLeft = useCountdownSeconds(resolution?.nextRoundAt ?? null);

  if (poll) {
    const hasVoted = poll.myVote !== null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <Card className="w-full max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">
            จบรอบแล้ว
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">เล่นรอบต่อไปกันไหม?</h2>
          <p className="mt-2 text-sm text-slate-400">
            เสียงส่วนมากเป็นตัวตัดสิน - ถ้าไม่เลือกภายใน {pollSecondsLeft} วินาที จะถือว่ากลับไปที่ล็อบบี้
          </p>
          <p className="mt-2 text-xs text-slate-500">
            ต่อ {poll.votesFor} · ไม่ต่อ {poll.votesAgainst} จาก {poll.totalPlayers} คน
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => onVote(false)}
              disabled={isSubmittingVote}
              isLoading={isSubmittingVote && poll.myVote === false}
            >
              กลับล็อบบี้
            </Button>
            <Button
              variant="primary"
              onClick={() => onVote(true)}
              disabled={isSubmittingVote}
              isLoading={isSubmittingVote && poll.myVote === true}
            >
              เล่นต่อ
            </Button>
          </div>
          {hasVoted && (
            <p className="mt-3 text-right text-xs text-slate-500">รอผู้เล่นคนอื่นโหวต...</p>
          )}
        </Card>
      </div>
    );
  }

  if (resolution) {
    return (
      <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <Card className="flex w-full max-w-md flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-sm text-slate-200">
            เริ่มรอบต่อไปใน {nextRoundSecondsLeft} วินาที...
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onSkip} isLoading={isSkipping}>
              ข้าม
            </Button>
            <button
              onClick={onDismissResolution}
              aria-label="ปิด"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <Card className="flex w-full max-w-md flex-wrap items-center justify-between gap-3 border-red-800 py-3">
          <p className="text-sm text-red-300">{error}</p>
          <Button variant="ghost" onClick={onDismissError}>
            ปิด
          </Button>
        </Card>
      </div>
    );
  }

  return null;
}
