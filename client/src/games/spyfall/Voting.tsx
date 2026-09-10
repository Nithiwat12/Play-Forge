import type { SpyfallPublicPlayer } from "./types";
import { Button } from "../../components/common/Button";

interface VotingProps {
  players: SpyfallPublicPlayer[];
  selfUserId?: string;
  myVoteTargetId: string | null;
  onVote: (targetUserId: string) => void;
}

export function Voting({ players, selfUserId, myVoteTargetId, onVote }: VotingProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-400">
        Think you know who the Spy is? Cast your vote below. Once everyone has voted, the result
        is revealed immediately.
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
