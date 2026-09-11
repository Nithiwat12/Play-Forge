import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Timer } from "./Timer";
import { RoleCard } from "./RoleCard";
import { PlayerList } from "./PlayerList";
import { Voting } from "./Voting";
import { LocationChecklist } from "./LocationChecklist";
import { GuessModal } from "./GuessModal";
import { VoteRequestModal } from "./VoteRequestModal";
import { SPYFALL_ACTIONS } from "./types";
import type { SpyfallPublicState, SpyfallPrivateState } from "./types";
import type { Room, Scoreboard } from "../../types";

interface SpyfallGameProps {
  room: Room;
  publicState: SpyfallPublicState;
  privateState: SpyfallPrivateState;
  selfUserId?: string;
  onAction: (actionType: string, payload: unknown) => Promise<{ ok: boolean; error?: string }>;
  onReplay: () => Promise<{ ok: boolean; error?: string }>;
  scoreboard: Scoreboard | null;
}

export function SpyfallGame({
  room,
  publicState,
  privateState,
  selfUserId,
  onAction,
  scoreboard,
}: SpyfallGameProps) {
  const navigate = useNavigate();
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [myVoteTargetId, setMyVoteTargetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // The Spy's own scratchpad - which locations they've personally crossed
  // off while thinking. Purely local: never sent to the server. Kept
  // across the IN_PROGRESS -> VOTING transition (and through a tie
  // extension back to IN_PROGRESS) since the answer popup reuses it to
  // show what's already been ruled out - only a genuinely new round
  // (FINISHED -> IN_PROGRESS) clears it.
  const [eliminated, setEliminated] = useState<Set<string>>(new Set());
  const toggleEliminated = useCallback((name: string) => {
    setEliminated((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Opened on demand via a button on the normal discussion screen (per
  // "มีปุ่มที่กดแล้วจะมีลิสรายชื่อสถานที่ทั้งหมดเด้งขึ้น") rather than
  // sitting inline the whole time.
  const [isLocationListOpen, setIsLocationListOpen] = useState(false);

  // The Spy's final-answer popup - opens itself the moment voting starts
  // (once everyone has agreed to open it, or the discussion clock runs
  // out), per "จะเด้งไปหน้าตอบเลย" - no extra click needed to see it.
  const [isGuessModalOpen, setIsGuessModalOpen] = useState(false);
  const [guessError, setGuessError] = useState<string | null>(null);
  const [isGuessing, setIsGuessing] = useState(false);

  const [isCallingVote, setIsCallingVote] = useState(false);
  // Responding (accept/decline) to the currently-open call-vote poll.
  const [isRespondingToPoll, setIsRespondingToPoll] = useState(false);

  // The Spy's "surrender / go straight to answering" button - separate
  // from the shared call-vote flow entirely (see handleSurrender below).
  const [isSurrendering, setIsSurrendering] = useState(false);

  const isFinished = publicState.phase === "FINISHED";
  const isVoting = publicState.phase === "VOTING";
  const isRevealed = publicState.phase === "REVEALED";
  const hasRespondedToPoll = Boolean(
    selfUserId && publicState.votePoll?.responderIds.includes(selfUserId)
  );
  const matchComplete = scoreboard?.matchComplete ?? false;

  // Live countdown for the call-vote button's post-rejection cooldown -
  // purely for display, the server is what actually enforces it.
  const [nowForCooldown, setNowForCooldown] = useState(() => Date.now());
  useEffect(() => {
    if (!publicState.voteCallCooldownUntil) return;
    const interval = setInterval(() => setNowForCooldown(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [publicState.voteCallCooldownUntil]);
  const voteCallCooldownSecondsLeft = publicState.voteCallCooldownUntil
    ? Math.max(0, Math.ceil((publicState.voteCallCooldownUntil - nowForCooldown) / 1000))
    : 0;
  const isVoteCallOnCooldown = voteCallCooldownSecondsLeft > 0;

  // A tie-extension "debate round" is IN_PROGRESS (discussion) with
  // debateCandidateIds set - distinct from a normal discussion phase, and
  // distinct from the later VOTING phase the same debateCandidateIds also
  // narrows once voting reopens (see Voting's allowedTargetIds below).
  const isDebateRound = publicState.phase === "IN_PROGRESS" && Boolean(publicState.debateCandidateIds);
  // Announces a debate round once, keyed off its own timerEndsAt so a
  // second/nested tie (a fresh debate round with a new deadline) shows its
  // own announcement again rather than staying suppressed by an earlier one.
  const [dismissedDebateTimerEndsAt, setDismissedDebateTimerEndsAt] = useState<number | null>(null);
  const showDebateAnnouncement = isDebateRound && publicState.timerEndsAt !== dismissedDebateTimerEndsAt;

  const previousPhaseRef = useRef(publicState.phase);
  useEffect(() => {
    const isNewRound = previousPhaseRef.current === "FINISHED" && publicState.phase === "IN_PROGRESS";
    previousPhaseRef.current = publicState.phase;
    if (isNewRound) {
      setEliminated(new Set());
      setIsLocationListOpen(false);
    }
  }, [publicState.phase]);

  useEffect(() => {
    if ((isVoting || isRevealed) && privateState.isSpy) {
      setIsGuessModalOpen(true);
      setGuessError(null);
      setIsLocationListOpen(false);
    } else {
      setIsGuessModalOpen(false);
    }
  }, [isVoting, isRevealed, privateState.isSpy]);

  const otherPlayers = useMemo(
    () => publicState.players.filter((p) => p.userId !== selfUserId),
    [publicState.players, selfUserId]
  );

  const usernameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of publicState.players) map.set(p.userId, p.username);
    for (const p of scoreboard?.players ?? []) {
      if (!map.has(p.userId)) map.set(p.userId, p.username);
    }
    return map;
  }, [publicState.players, scoreboard]);

  const currentRoundNumber = scoreboard
    ? Math.min(scoreboard.roundsPlayed + (isFinished ? 0 : 1), scoreboard.numberOfRounds ?? Infinity)
    : 1;

  const debateCandidateNames = useMemo(
    () => (publicState.debateCandidateIds ?? []).map((id) => usernameByUserId.get(id) ?? "ไม่ทราบชื่อ"),
    [publicState.debateCandidateIds, usernameByUserId]
  );

  const revealedSpyUsername = publicState.revealedSpyUserId
    ? usernameByUserId.get(publicState.revealedSpyUserId) ?? "ไม่ทราบชื่อ"
    : null;

  const showVoteCallPollModal = Boolean(publicState.votePoll) && !hasRespondedToPoll;

  const runAction = useCallback(
    async (actionType: string, payload: unknown, onSuccess?: () => void) => {
      setActionError(null);
      const result = await onAction(actionType, payload);
      if (!result.ok) {
        setActionError(result.error ?? "การกระทำล้มเหลว");
      } else {
        onSuccess?.();
      }
    },
    [onAction]
  );

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
    setIsCallingVote(true);
    try {
      await runAction(SPYFALL_ACTIONS.CALL_VOTE, {});
    } finally {
      setIsCallingVote(false);
    }
  }

  // Accept/decline the currently-open call-vote poll (see VoteRequestModal).
  async function handleVoteCallResponse(accept: boolean) {
    setIsRespondingToPoll(true);
    try {
      await runAction(SPYFALL_ACTIONS.VOTE_CALL_RESPONSE, { accept });
    } finally {
      setIsRespondingToPoll(false);
    }
  }

  // Spy-only, irreversible: outs them to the whole table immediately and
  // starts their own dedicated answer window (see handleSurrender on the
  // server) - confirm first since there's no undo.
  async function handleSurrender() {
    if (!window.confirm("แน่ใจนะ? กดแล้วทุกคนจะรู้ทันทีว่าคุณเป็นสปาย และย้อนกลับไม่ได้")) {
      return;
    }
    setIsSurrendering(true);
    try {
      await runAction(SPYFALL_ACTIONS.SURRENDER, {});
    } finally {
      setIsSurrendering(false);
    }
  }

  // Stable identity (via useCallback) so the memoized PlayerList/Voting
  // components below can actually skip re-rendering on unrelated updates
  // (a new chat message, the timer ticking, etc.) instead of treating
  // this as "changed" on every single render.
  const handleAsk = useCallback((userId: string) => setTargetUserId(userId), []);

  const handleVote = useCallback(
    async (voteTargetUserId: string) => {
      await runAction(SPYFALL_ACTIONS.VOTE, { targetUserId: voteTargetUserId }, () =>
        setMyVoteTargetId(voteTargetUserId)
      );
    },
    [runAction]
  );

  async function handleGuess(location: string) {
    setGuessError(null);
    setIsGuessing(true);
    try {
      const result = await onAction(SPYFALL_ACTIONS.GUESS, { location });
      if (!result.ok) {
        setGuessError(result.error ?? "ตอบไม่สำเร็จ กรุณาลองใหม่");
      }
      // On success the round concludes and isVoting flips to false, which
      // closes the modal itself via the effect above - nothing to do here.
    } finally {
      setIsGuessing(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4 sm:gap-6">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">{room.roomName}</p>
            <h1 className="text-xl font-semibold text-white">{room.game.name}</h1>
            {scoreboard?.numberOfRounds && (
              <p className="mt-1 text-xs text-slate-500">
                รอบที่ {currentRoundNumber} / {scoreboard.numberOfRounds}
              </p>
            )}
          </div>
          <Timer endsAt={publicState.timerEndsAt} />
        </Card>

        <RoleCard privateState={privateState} />

        {!isFinished && !isVoting && !isRevealed && privateState.isSpy && privateState.locationOptions && (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-300">รายชื่อสถานที่</h2>
              <p className="mt-1 text-xs text-slate-500">
                เปิดดูรายชื่อสถานที่ทั้งหมด ไว้กาตัดตัวเลือกส่วนตัวระหว่างฟังคนอื่นคุยกัน
              </p>
            </div>
            <Button variant="secondary" onClick={() => setIsLocationListOpen(true)}>
              เปิดรายชื่อสถานที่ ({privateState.locationOptions.length - eliminated.size}/
              {privateState.locationOptions.length})
            </Button>
          </Card>
        )}

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

            {Object.values(publicState.result.scores ?? {}).some((pts) => pts > 0) && (
              <div className="mt-4 rounded-lg bg-slate-900/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  คะแนนที่ได้รอบนี้
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {Object.entries(publicState.result.scores)
                    .filter(([, pts]) => pts > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([userId, pts]) => (
                      <li
                        key={userId}
                        className="flex items-center justify-between text-sm text-slate-300"
                      >
                        <span>{usernameByUserId.get(userId) ?? "ไม่ทราบชื่อ"}</span>
                        <span className="font-semibold text-emerald-400">+{pts}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {matchComplete ? (
                <p className="flex items-center gap-1 text-sm font-medium text-amber-400">
                  🏆 จบแมตช์แล้ว! ดูตารางคะแนนรวมด้านล่าง
                </p>
              ) : (
                <p className="flex items-center text-xs text-slate-500">
                  รอผลโหวตว่าจะเล่นต่อหรือกลับล็อบบี้...
                </p>
              )}
              <Button variant="secondary" onClick={() => navigate(`/lobby/${room.roomCode}`)}>
                กลับไปที่ล็อบบี้
              </Button>
            </div>
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        {isFinished && scoreboard && scoreboard.roundsPlayed > 0 && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-300">ตารางคะแนนรวม</h2>
              {scoreboard.numberOfRounds && (
                <span className="text-xs text-slate-500">
                  เล่นแล้ว {scoreboard.roundsPlayed} / {scoreboard.numberOfRounds} รอบ
                </span>
              )}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-max text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-500">
                    <th className="pb-2 pr-3">ผู้เล่น</th>
                    {scoreboard.rounds.map((r) => (
                      <th key={r.round} className="px-2 pb-2 text-center">
                        รอบ {r.round}
                      </th>
                    ))}
                    <th className="pb-2 pl-3 text-right">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreboard.players.map((p) => {
                    const total = scoreboard.totals.find((t) => t.userId === p.userId)?.total ?? 0;
                    return (
                      <tr key={p.userId} className="border-t border-slate-800">
                        <td className="py-2 pr-3 text-slate-200">{p.username}</td>
                        {scoreboard.rounds.map((r) => (
                          <td key={r.round} className="px-2 py-2 text-center text-slate-400">
                            {r.scores[p.userId] ?? 0}
                          </td>
                        ))}
                        <td className="py-2 pl-3 text-right font-semibold text-white">{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {isDebateRound && (
          <Card className="border-amber-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">รอบดีเบท</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {debateCandidateNames.join(" กับ ")} คะแนนเท่ากัน
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              คุยกันต่อ แล้วกด "ขอเปิดโหวต" อีกครั้งเมื่อพร้อม - รอบนี้โหวตได้เฉพาะสองคนนี้เท่านั้น
            </p>
          </Card>
        )}

        {!isFinished && !isVoting && !isRevealed && (
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

            <h2 className="mt-5 text-sm font-semibold text-slate-300">ขอเปิดโหวต</h2>
            <p className="mt-1 text-xs text-slate-500">
              ถ้าคิดว่ารู้แล้วว่าใครคือสปาย กดปุ่มนี้เพื่อขอเปิดโหวต ต้องให้เสียงส่วนมากในห้องเห็นด้วยถึงจะเข้าสู่โหมดโหวตได้
              - ถ้าเสียงส่วนมากไม่เห็นด้วย จะต้องรอสักครู่ก่อนขอใหม่ได้
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleCallVote}
                disabled={Boolean(publicState.votePoll) || isVoteCallOnCooldown}
                isLoading={isCallingVote}
              >
                {publicState.votePoll
                  ? "รอผลโหวต..."
                  : isVoteCallOnCooldown
                    ? `รออีก ${voteCallCooldownSecondsLeft} วินาที`
                    : "ขอเปิดโหวต"}
              </Button>
            </div>

            {privateState.isSpy && (
              <>
                <h2 className="mt-5 text-sm font-semibold text-red-400">ยอมแพ้ / ขอทายเลย</h2>
                <p className="mt-1 text-xs text-slate-500">
                  เปิดเผยว่าคุณเป็นสปายทันทีต่อทุกคน แลกกับเวลาส่วนตัว 5 นาทีในการทายสถานที่
                  โดยไม่ต้องรอใคร - กดแล้วย้อนกลับไม่ได้
                </p>
                <div className="mt-3">
                  <Button variant="danger" onClick={handleSurrender} isLoading={isSurrendering}>
                    ยอมแพ้ ขอทายเลย
                  </Button>
                </div>
              </>
            )}

            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        {isRevealed && (
          <Card className="border-red-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-400">สปายเปิดเผยตัวแล้ว!</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {revealedSpyUsername} คือสปาย - กำลังทายสถานที่อยู่
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              มีเวลา 5 นาทีให้สปายทาย - ถ้าหมดเวลาก่อนสปายจะแพ้ทันที
            </p>
            {privateState.isSpy && !isGuessModalOpen && (
              <Button className="mt-3" variant="danger" onClick={() => setIsGuessModalOpen(true)}>
                เปิดหน้าตอบอีกครั้ง
              </Button>
            )}
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        {isVoting && (
          <Card className="border-amber-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
              โหมดโหวต
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">ถึงเวลาโหวตหาสปายแล้ว!</h2>
            <p className="mt-1 text-xs text-slate-500">
              มีเวลา 5 นาที - ถ้าหมดเวลาจะสรุปผลจากสิ่งที่มีอยู่ตอนนั้นทันที
            </p>

            {privateState.isSpy && (
              <div className="mt-4 rounded-xl border border-red-800 bg-red-950/50 p-4">
                <p className="text-sm text-red-200">
                  เลือกสถานที่ที่คุณคิดว่าใช่จากป๊อปอัป - ตอบได้แค่ครั้งเดียวเท่านั้น (โหวตด้านล่างได้ด้วยถ้าอยากกลบเกลื่อน)
                </p>
                {!isGuessModalOpen && (
                  <Button className="mt-3" variant="danger" onClick={() => setIsGuessModalOpen(true)}>
                    เปิดหน้าตอบอีกครั้ง
                  </Button>
                )}
              </div>
            )}

            <div className="mt-4">
              <Voting
                players={publicState.players}
                selfUserId={selfUserId}
                myVoteTargetId={myVoteTargetId}
                onVote={handleVote}
                allowedTargetIds={publicState.debateCandidateIds}
              />
            </div>

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
              onAsk={!isFinished && !isVoting && !isRevealed ? handleAsk : undefined}
            />
          </div>
        </Card>
      </div>

      {isLocationListOpen && !isVoting && !isRevealed && privateState.isSpy && privateState.locationOptions && (
        <LocationChecklist
          locations={privateState.locationOptions}
          eliminated={eliminated}
          onToggle={toggleEliminated}
          onClose={() => setIsLocationListOpen(false)}
        />
      )}

      {isGuessModalOpen && privateState.isSpy && privateState.locationOptions && (
        <GuessModal
          locations={privateState.locationOptions}
          eliminated={eliminated}
          isSubmitting={isGuessing}
          error={guessError}
          onSubmit={handleGuess}
          onClose={() => setIsGuessModalOpen(false)}
        />
      )}

      {showVoteCallPollModal && publicState.votePoll && (
        <VoteRequestModal
          deadline={publicState.votePoll.deadline}
          votesFor={publicState.votePoll.votesFor}
          votesAgainst={publicState.votePoll.votesAgainst}
          totalPlayers={publicState.votePoll.totalPlayers}
          isSubmitting={isRespondingToPoll}
          onRespond={handleVoteCallResponse}
        />
      )}

      {showDebateAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <Card className="w-full max-w-sm border-amber-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">โหวตเสมอกัน!</p>
            <h2 className="mt-1 text-lg font-semibold text-white">เข้าสู่รอบดีเบท</h2>
            <p className="mt-2 text-sm text-slate-400">
              {debateCandidateNames.join(" กับ ")} มีคะแนนเท่ากัน - มีเวลาพิเศษอีก 5 นาทีให้คุยกันต่อ
              แล้วโหวตได้เฉพาะสองคนนี้เท่านั้น
            </p>
            <div className="mt-6 flex justify-end">
              <Button
                variant="primary"
                onClick={() => setDismissedDebateTimerEndsAt(publicState.timerEndsAt)}
              >
                เข้าใจแล้ว
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
