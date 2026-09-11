import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";

interface GuessJudgeModalProps {
  guesserUsername: string;
  guessText: string;
  isMarkingCorrect: boolean;
  isMarkingWrong: boolean;
  onMarkCorrect: () => void;
  onMarkWrong: () => void;
  // Winning needs EVERY currently-connected non-turn player to vote ตอบถูก
  // (unanimous) - see WordHeadGame.eligibleVoterIds. selfVote reflects
  // this viewer's own vote so their button can show "waiting on others"
  // instead of looking clickable again after they've already voted.
  votesCorrectCount: number;
  votesNeeded: number;
  selfVote: "correct" | "wrong" | null;
}

// Pops up for everyone EXCEPT the up player the moment they type a guess
// (see publicState.pendingGuess) - separate from the always-available
// ✅/❌ buttons in HintPanel so a typed guess can't just get missed at the
// bottom of the screen. Disappears on its own once anyone resolves it
// (pendingGuess clears server-side either way - see WordHeadGame's
// handleMarkCorrect/handleMarkWrong), same pattern as VoteRequestModal.
export function GuessJudgeModal({
  guesserUsername,
  guessText,
  isMarkingCorrect,
  isMarkingWrong,
  onMarkCorrect,
  onMarkWrong,
  votesCorrectCount,
  votesNeeded,
  selfVote,
}: GuessJudgeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <Card className="w-full max-w-sm border-amber-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">🔔 {guesserUsername} ทายว่า</p>
        <h2 className="mt-1 text-2xl font-bold text-white">"{guessText}"</h2>
        <p className="mt-2 text-sm text-slate-400">ถูกไหม? ต้องกด "ถูกต้อง" ให้ครบทุกคนถึงจะนับเป็นชนะ</p>
        <p className="mt-1 text-xs text-slate-500">
          ยืนยันแล้ว {votesCorrectCount}/{votesNeeded} คน
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onMarkWrong} isLoading={isMarkingWrong} disabled={isMarkingCorrect}>
            ❌ ยังไม่ถูก
          </Button>
          <Button
            variant="secondary"
            className="border border-emerald-800 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
            onClick={onMarkCorrect}
            isLoading={isMarkingCorrect}
            disabled={isMarkingWrong || selfVote === "correct"}
          >
            {selfVote === "correct" ? "✅ กดแล้ว รอคนอื่น..." : "✅ ถูกต้อง"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
