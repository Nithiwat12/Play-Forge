import { memo } from "react";
import type { SpyfallPublicPlayer } from "./types";
import { Button } from "../../components/common/Button";
import { playersSignature } from "../../utils/memoCompare";

interface VotingProps {
  players: SpyfallPublicPlayer[];
  selfUserId?: string;
  myVoteTargetId: string | null;
  onVote: (targetUserId: string) => void;
  // Narrows selectable targets to just these userIds during a tie-extension
  // debate round - null/undefined means anyone (besides yourself) is fair
  // game, same as normal.
  allowedTargetIds?: string[] | null;
}

function VotingImpl({ players, selfUserId, myVoteTargetId, onVote, allowedTargetIds }: VotingProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-400">
        {allowedTargetIds
          ? "รอบดีเบท - โหวตได้เฉพาะคนที่คะแนนเท่ากันเท่านั้น เมื่อทุกคนโหวตครบ ผลจะออกทันที"
          : "คิดว่าใครคือสปาย? เลือกโหวตได้เลย เมื่อทุกคนโหวตครบ ผลจะออกทันที"}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {players
          .filter((p) => p.userId !== selfUserId)
          .filter((p) => !allowedTargetIds || allowedTargetIds.includes(p.userId))
          .map((player) => (
            <Button
              key={player.userId}
              variant={myVoteTargetId === player.userId ? "primary" : "secondary"}
              onClick={() => onVote(player.userId)}
            >
              {player.username}
            </Button>
          ))}
      </div>
    </div>
  );
}

// Same rationale as PlayerList.tsx - `players` is a fresh array every
// broadcast, so compare it by value. `onVote` needs a stable identity
// from the parent (useCallback) to actually benefit from this.
export const Voting = memo(VotingImpl, (prev, next) => {
  return (
    prev.selfUserId === next.selfUserId &&
    prev.myVoteTargetId === next.myVoteTargetId &&
    prev.onVote === next.onVote &&
    playersSignature(prev.players) === playersSignature(next.players) &&
    (prev.allowedTargetIds ?? []).join(",") === (next.allowedTargetIds ?? []).join(",")
  );
});
