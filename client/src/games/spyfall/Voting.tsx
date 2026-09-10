import { memo } from "react";
import type { SpyfallPublicPlayer } from "./types";
import { Button } from "../../components/common/Button";
import { playersSignature } from "../../utils/memoCompare";

interface VotingProps {
  players: SpyfallPublicPlayer[];
  selfUserId?: string;
  myVoteTargetId: string | null;
  onVote: (targetUserId: string) => void;
}

function VotingImpl({ players, selfUserId, myVoteTargetId, onVote }: VotingProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-400">
        คิดว่าใครคือสปาย? เลือกโหวตได้เลย เมื่อทุกคนโหวตครบ ผลจะออกทันที
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {players
          .filter((p) => p.userId !== selfUserId)
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
    playersSignature(prev.players) === playersSignature(next.players)
  );
});
