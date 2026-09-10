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
  onReplay: () => Promise<{ ok: boolean; error?: string }>;
}

export function SpyfallGame({
  room,
  publicState,
  privateState,
  selfUserId,
  onAction,
  onReplay,
}: SpyfallGameProps) {
  const navigate = useNavigate();
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [myVoteTargetId, setMyVoteTargetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);

  const isFinished = publicState.phase === "FINISHED";
  const isVoting = publicState.phase === "VOTING";
  const hasCalledVote = Boolean(selfUserId && publicState.voteCallers.includes(selfUserId));
  const isHost = room.hostId === selfUserId;

  const otherPlayers = useMemo(
    () => publicState.players.filter((p) => p.userId !== selfUserId),
    [publicState.players, selfUserId]
  );

  async function runAction(actionType: string, payload: unknown, onSuccess?: () => void) {
    setActionError(null);
    const result = await onAction(actionType, payload);
    if (!result.ok) {
      setActionError(result.error ?? "การกระทำล้มเหลว");
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

  async function handleCallVote() {
    await runAction(SPYFALL_ACTIONS.CALL_VOTE, {});
  }

  async function handleVote(voteTargetUserId: string) {
    await runAction(SPYFALL_ACTIONS.VOTE, { targetUserId: voteTargetUserId }, () =>
      setMyVoteTargetId(voteTargetUserId)
    );
  }

  async function handleGuess(correct: boolean) {
    await runAction(SPYFALL_ACTIONS.GUESS, { correct });
  }

  async function handleReplay() {
    setActionError(null);
    setIsReplaying(true);
    try {
      const result = await onReplay();
      if (!result.ok) {
        setActionError(result.error ?? "เริ่มเกมใหม่ไม่สำเร็จ");
      }
    } finally {
      setIsReplaying(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4 sm:gap-6">
        <Card className="flex flex-wrap items-center justify-between gap-3">
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
              จบเกมแล้ว
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {publicState.result.winner === "SPY" ? "สปายชนะ!" : "กลุ่มผู้เล่นชนะ!"}
            </h2>
            <p className="mt-2 text-sm text-slate-300">{publicState.result.reason}</p>
            <p className="mt-2 text-sm text-slate-400">
              สปายคือ <span className="text-white">{publicState.result.spyUsername}</span> -
              สถานที่คือ <span className="text-white">{publicState.result.location}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {isHost ? (
                <Button onClick={handleReplay} isLoading={isReplaying}>
                  เล่นอีกครั้ง
                </Button>
              ) : (
                <p className="flex items-center text-xs text-slate-500">รอโฮสต์กดเล่นอีกครั้ง...</p>
              )}
              <Button variant="secondary" onClick={() => navigate(`/lobby/${room.roomCode}`)}>
                กลับไปที่ล็อบบี้
              </Button>
            </div>
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        {!isFinished && !isVoting && (
          <Card>
            <h2 className="text-sm font-semibold text-slate-300">ถามคำถาม</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
              >
                <option value="">เลือกผู้เล่น...</option>
                {otherPlayers.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.username}
                  </option>
                ))}
              </select>
              <Input
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="เช่น ที่นั่นอากาศเป็นยังไงบ้าง?"
                className="flex-1"
              />
              <Button onClick={handleAskSubmit} disabled={!targetUserId || !questionText.trim()}>
                ถาม
              </Button>
            </div>

            <h2 className="mt-5 text-sm font-semibold text-slate-300">ตอบคำถาม</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="พิมพ์คำตอบของคุณ..."
                className="flex-1"
              />
              <Button variant="secondary" onClick={handleAnswerSubmit} disabled={!answerText.trim()}>
                ตอบ
              </Button>
            </div>

            <h2 className="mt-5 text-sm font-semibold text-slate-300">
              {privateState.isSpy ? "หยุดเกมเพื่อทาย" : "ขอเปิดโหวต"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {privateState.isSpy
                ? "ถ้าคิดว่าทายสถานที่ได้แล้ว กดปุ่มนี้เพื่อหยุดการพูดคุยและเข้าสู่โหมดโหวต แล้วบอกคำทายของคุณออกมาดัง ๆ ให้เพื่อนฟัง"
                : "ถ้าคิดว่ารู้แล้วว่าใครคือสปาย กดปุ่มนี้เพื่อขอเปิดโหวต ต้องได้เสียงข้างมากก่อนถึงจะเข้าสู่โหมดโหวตได้"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                variant={privateState.isSpy ? "danger" : "secondary"}
                onClick={handleCallVote}
                disabled={hasCalledVote}
              >
                {hasCalledVote
                  ? "รอเพื่อนคนอื่น..."
                  : privateState.isSpy
                    ? "หยุดเกม (ขอตอบ)"
                    : "ขอเปิดโหวต"}
              </Button>
              <span className="text-xs text-slate-500">
                {publicState.voteCallers.length} / {publicState.requiredVoteCallers} คนขอโหวตแล้ว
              </span>
            </div>

            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        {isVoting && (
          <Card className="border-amber-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
              โหมดโหวต
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">ถึงเวลาโหวตหาสปายแล้ว!</h2>

            {privateState.isSpy ? (
              <div className="mt-4 rounded-xl border border-red-800 bg-red-950/50 p-4">
                <p className="text-sm text-red-200">
                  บอกคำทายสถานที่ของคุณออกมาดัง ๆ ให้เพื่อนฟัง แล้วกดปุ่มด้านล่างตามจริงว่าทายถูกหรือผิด
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button variant="primary" onClick={() => handleGuess(true)}>
                    ทายถูก
                  </Button>
                  <Button variant="danger" onClick={() => handleGuess(false)}>
                    ทายผิด
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <Voting
                  players={publicState.players}
                  selfUserId={selfUserId}
                  myVoteTargetId={myVoteTargetId}
                  onVote={handleVote}
                />
              </div>
            )}

            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        <Card>
          <h2 className="text-sm font-semibold text-slate-300">บทสนทนา</h2>
          <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
            {publicState.log.length === 0 && (
              <p className="text-sm text-slate-500">ยังไม่มีการถามคำถาม - เริ่มบทสนทนากันเลย!</p>
            )}
            {publicState.log.map((entry) => {
              if (entry.type === "system") {
                return (
                  <div key={entry.id} className="text-center text-xs italic text-amber-400">
                    {entry.text}
                  </div>
                );
              }
              return (
                <div key={entry.id} className="rounded-lg bg-slate-900/70 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-200">{entry.fromUsername}</span>
                  {entry.type === "question" && entry.toUsername && (
                    <span className="text-slate-500"> ถาม {entry.toUsername}</span>
                  )}
                  {entry.type === "answer" && <span className="text-slate-500"> ตอบว่า</span>}
                  <span className="text-slate-300">: {entry.text}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-slate-300">ผู้เล่น</h2>
          <div className="mt-3">
            <PlayerList
              players={publicState.players}
              selfUserId={selfUserId}
              onAsk={!isFinished && !isVoting ? (userId) => setTargetUserId(userId) : undefined}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
