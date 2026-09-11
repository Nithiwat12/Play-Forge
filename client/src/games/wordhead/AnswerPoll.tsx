import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Timer } from "../../components/common/Timer";
import type { WordHeadAnswerPoll } from "./types";

interface AnswerPollProps {
  poll: WordHeadAnswerPoll;
  askerUsername: string;
  selfUserId?: string;
  isSubmitting: boolean;
  onVote: (vote: "YES" | "NO" | "UNSURE") => void;
}

const VOTE_LABEL: Record<"YES" | "NO" | "UNSURE", string> = {
  YES: "ใช่",
  NO: "ไม่ใช่",
  UNSURE: "ไม่แน่ใจ",
};

// The vote tally here is fully public - including to the asker themselves,
// who is trying to work out their own word FROM this pattern of answers.
// That's the whole mechanic, so unlike Spyfall's accusation vote there's no
// secret-ballot handling needed at all.
export function AnswerPoll({ poll, askerUsername, selfUserId, isSubmitting, onVote }: AnswerPollProps) {
  const isAsker = selfUserId === poll.askerUserId;
  const myVote = selfUserId ? poll.votes[selfUserId] : undefined;
  const counts = { YES: 0, NO: 0, UNSURE: 0 };
  for (const v of Object.values(poll.votes)) counts[v] += 1;

  return (
    <Card className="border-amber-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">รอคำตอบ</p>
        <Timer endsAt={poll.endsAt} />
      </div>
      <h2 className="mt-1 text-lg font-semibold text-white">
        {askerUsername} {poll.questionText ? `ถามว่า "${poll.questionText}"` : "กำลังถามคำถาม (ด้วยวาจา)"}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        คำตอบคือ {VOTE_LABEL.YES} {counts.YES} · {VOTE_LABEL.NO} {counts.NO} · {VOTE_LABEL.UNSURE} {counts.UNSURE}
      </p>

      {isAsker ? (
        <p className="mt-3 text-sm text-slate-400">รอทุกคนโหวตคำตอบให้คุณ...</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {(["YES", "NO", "UNSURE"] as const).map((vote) => (
            <Button
              key={vote}
              variant={myVote === vote ? "primary" : "secondary"}
              isLoading={isSubmitting && myVote === vote}
              onClick={() => onVote(vote)}
            >
              {VOTE_LABEL[vote]}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}
