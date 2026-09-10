import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Timer } from "./Timer";
import { RoleCard } from "./RoleCard";
import { PlayerList } from "./PlayerList";
import { Voting } from "./Voting";
import { SPYFALL_ACTIONS } from "./types";
import type { SpyfallPublicState, SpyfallPrivateState } from "./types";
import type { Room } from "../../types";

interface SpyfallGameProps {
  room: Room;
  publicState: SpyfallPublicState;
  privateState: SpyfallPrivateState;
  selfUserId?: string;
  onAction: (actionType: string, payload: unknown) => Promise<{ ok: boolean; error?: string }>;
}

export function SpyfallGame({ room, publicState, privateState, selfUserId, onAction }: SpyfallGameProps) {
  const navigate = useNavigate();
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [guessText, setGuessText] = useState("");
  const [myVoteTargetId, setMyVoteTargetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isFinished = publicState.phase === "FINISHED";

  const otherPlayers = useMemo(
    () => publicState.players.filter((p) => p.userId !== selfUserId),
    [publicState.players, selfUserId]
  );

  async function runAction(actionType: string, payload: unknown, onSuccess?: () => void) {
    setActionError(null);
    const result = await onAction(actionType, payload);
    if (!result.ok) {
      setActionError(result.error ?? "Action failed");
    } else {
      onSuccess?.();
    }
  }

  async function handleAskSubmit() {
    if (!targetUserId || !questionText.trim()) return;
    await runAction(SPYFALL_ACTIONS.QUESTION, { toUserId: targetUserId, text: questionText }, () =>
      setQuestionText("")
    );
  }

  async function handleAnswerSubmit() {
    if (!answerText.trim()) return;
    await runAction(SPYFALL_ACTIONS.ANSWER, { text: answerText }, () => setAnswerText(""));
  }

  async function handleVote(voteTargetUserId: string) {
    await runAction(SPYFALL_ACTIONS.VOTE, { targetUserId: voteTargetUserId }, () =>
      setMyVoteTargetId(voteTargetUserId)
    );
  }

  async function handleGuessSubmit() {
    if (!guessText.trim()) return;
    await runAction(SPYFALL_ACTIONS.GUESS, { location: guessText });
  }

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-6 py-10 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-6">
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{room.roomName}</p>
            <h1 className="text-xl font-semibold text-white">Spyfall</h1>
          </div>
          <Timer endsAt={publicState.timerEndsAt} />
        </Card>

        <RoleCard privateState={privateState} />

        {isFinished && publicState.result && (
          <Card className="border-brand-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">
              Game Over
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {publicState.result.winner === "SPY" ? "The Spy wins!" : "The crew wins!"}
            </h2>
            <p className="mt-2 text-sm text-slate-300">{publicState.result.reason}</p>
            <p className="mt-2 text-sm text-slate-400">
              The Spy was <span className="text-white">{publicState.result.spyUsername}</span> -
              the location was <span className="text-white">{publicState.result.location}</span>.
            </p>
            <Button className="mt-4" onClick={() => navigate(`/lobby/${room.roomCode}`)}>
              Back to Lobby
            </Button>
          </Card>
        )}

        {!isFinished && (
          <Card>
            <h2 className="text-sm font-semibold text-slate-300">Ask a question</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
              >
                <option value="">Choose a player...</option>
                {otherPlayers.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.username}
                  </option>
                ))}
              </select>
              <Input
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="e.g. What's the weather like there?"
                className="flex-1"
              />
              <Button onClick={handleAskSubmit} disabled={!targetUserId || !questionText.trim()}>
                Ask
              </Button>
            </div>

            <h2 className="mt-5 text-sm font-semibold text-slate-300">Answer</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type your answer..."
                className="flex-1"
              />
              <Button variant="secondary" onClick={handleAnswerSubmit} disabled={!answerText.trim()}>
                Answer
              </Button>
            </div>

            {privateState.isSpy && (
              <>
                <h2 className="mt-5 text-sm font-semibold text-red-400">Guess the location</h2>
                <p className="text-xs text-slate-500">
                  Guess correctly to win instantly - guess wrong and you lose immediately.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={guessText}
                    onChange={(e) => setGuessText(e.target.value)}
                    placeholder="e.g. Airport"
                    className="flex-1"
                  />
                  <Button variant="danger" onClick={handleGuessSubmit} disabled={!guessText.trim()}>
                    Guess
                  </Button>
                </div>
              </>
            )}

            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        <Card>
          <h2 className="text-sm font-semibold text-slate-300">Conversation</h2>
          <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
            {publicState.log.length === 0 && (
              <p className="text-sm text-slate-500">No questions yet - break the ice!</p>
            )}
            {publicState.log.map((entry) => (
              <div key={entry.id} className="rounded-lg bg-slate-900/70 px-3 py-2 text-sm">
                <span className="font-medium text-slate-200">{entry.fromUsername}</span>
                {entry.type === "question" && entry.toUsername && (
                  <span className="text-slate-500"> asks {entry.toUsername}</span>
                )}
                {entry.type === "answer" && <span className="text-slate-500"> answers</span>}
                <span className="text-slate-300">: {entry.text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-slate-300">Players</h2>
          <div className="mt-3">
            <PlayerList
              players={publicState.players}
              selfUserId={selfUserId}
              onAsk={(userId) => setTargetUserId(userId)}
            />
          </div>
        </Card>

        {!isFinished && (
          <Card>
            <h2 className="text-sm font-semibold text-slate-300">Vote out the Spy</h2>
            <div className="mt-3">
              <Voting
                players={publicState.players}
                selfUserId={selfUserId}
                myVoteTargetId={myVoteTargetId}
                onVote={handleVote}
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
