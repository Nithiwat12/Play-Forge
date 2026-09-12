import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";

interface GuessJudgeModalProps {
  guesserUsername: string;
  guessText: string;
  isMarkingCorrect: boolean;
  isMarkingWrong: boolean;
  onMarkCorrect: () => void;
  onMarkWrong: () => void;
  votesCorrectCount: number;
  votesCount: number;
  waitingNames: string[];
  error: string | null;
  votesNeeded: number;
  selfVote: "correct" | "wrong" | null;
}

export function GuessJudgeModal({
  guesserUsername,
  guessText,
  isMarkingCorrect,
  isMarkingWrong,
  onMarkCorrect,
  onMarkWrong,
  votesCorrectCount,
  votesCount,
  waitingNames,
  error,
  votesNeeded,
  selfVote,
}: GuessJudgeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <Card className="max-h-[85vh] w-full max-w-sm overflow-y-auto border-amber-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">🔔 {guesserUsername} ตอบแล้ว</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{guessText ? `"${guessText}"` : "ตอบด้วยเสียง"}</h2>
        <p className="mt-2 text-sm text-slate-400">รอคนใบ้ทุกคนโหวตครบ แล้วตัดสินด้วยเสียงส่วนมาก หากเสมอให้ทายใหม่</p>
        <p className="mt-1 text-xs text-slate-500">
          โหวตแล้ว {votesCount}/{votesNeeded} คน · ถูก {votesCorrectCount} / ไม่ถูก {votesCount - votesCorrectCount}
        </p>
        <p className="mt-2 break-words text-xs text-slate-400">รอ: {waitingNames.join(", ")}</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onMarkWrong} isLoading={isMarkingWrong} disabled={isMarkingCorrect || selfVote !== null}>
            {selfVote === "wrong" ? "❌ โหวตแล้ว" : "❌ ยังไม่ถูก"}
          </Button>
          <Button
            variant="secondary"
            className="border border-emerald-800 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
            onClick={onMarkCorrect}
            isLoading={isMarkingCorrect}
            disabled={isMarkingWrong || selfVote !== null}
          >
            {selfVote === "correct" ? "✅ กดแล้ว รอคนอื่น..." : "✅ ถูกต้อง"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
