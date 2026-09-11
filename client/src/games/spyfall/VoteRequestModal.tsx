import { useEffect, useState } from "react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";

interface VoteRequestModalProps {
  deadline: number;
  votesFor: number;
  votesAgainst: number;
  totalPlayers: number;
  isSubmitting: boolean;
  onRespond: (accept: boolean) => void;
}

// Ticks down to the poll's deadline every second, purely for display - the
// actual resolution (majority reached early, or the timeout) always comes
// from the server, so a slow tab never desyncs anything, it just shows a
// slightly stale number for a moment. Mirrors ContinueRoundPrompt's own
// countdown hook.
function useCountdownSeconds(targetMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [targetMs]);
  return Math.max(0, Math.ceil((targetMs - now) / 1000));
}

// Pops up for anyone who hasn't answered the currently-open "shall we open
// the accusation vote?" poll yet (see publicState.votePoll) - identical for
// everyone, the Spy included, since their response counts exactly like
// anyone else's and isn't revealed. Majority accept opens the voting
// screen; majority decline (or a timeout with no majority either way)
// keeps the discussion going and starts a cooldown on the request button.
export function VoteRequestModal({
  deadline,
  votesFor,
  votesAgainst,
  totalPlayers,
  isSubmitting,
  onRespond,
}: VoteRequestModalProps) {
  const secondsLeft = useCountdownSeconds(deadline);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <Card className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">มีคนขอเปิดโหวต</p>
        <h2 className="mt-1 text-lg font-semibold text-white">เปิดโหมดโหวตหาสปายกันไหม?</h2>
        <p className="mt-2 text-sm text-slate-400">
          เสียงส่วนมากเป็นตัวตัดสิน - ถ้าไม่ตอบภายใน {secondsLeft} วินาที จะถือว่าเล่นต่อ
        </p>
        <p className="mt-2 text-xs text-slate-500">
          เห็นด้วย {votesFor} · ไม่เห็นด้วย {votesAgainst} จาก {totalPlayers} คน
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => onRespond(false)} disabled={isSubmitting}>
            ไม่เห็นด้วย เล่นต่อ
          </Button>
          <Button variant="primary" onClick={() => onRespond(true)} isLoading={isSubmitting}>
            เห็นด้วย เปิดโหวต
          </Button>
        </div>
      </Card>
    </div>
  );
}
