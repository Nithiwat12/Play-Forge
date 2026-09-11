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
import { AskTargetModal } from "./AskTargetModal";
import { VoteRequestModal } from "./VoteRequestModal";
import { ScoreboardTable } from "../../components/game/ScoreboardTable";
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
  // AskTargetModal no longer pops itself open automatically the instant
  // it's this player's turn - there's a "ถามคนต่อไป" button in the
  // "ถาม-ตอบ" card instead (see isMyAskTurn below), and clicking it is what
  // flips this true. Reset alongside pendingAskTarget once the ask turn
  // ends, so next turn starts back at the button, not a reopened popup.
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  // Set the instant this player picks a name from AskTargetModal - null
  // means no one's picked yet, non-null means the modal is closed and the
  // normal page is showing the compose box to type/send the question (see
  // the "ถาม-ตอบ" card below). Reset automatically once this player's ask
  // turn ends, whichever way it ends (see the effect a bit below).
  const [pendingAskTarget, setPendingAskTarget] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
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

  // The room stays open and playable after a match completes now (see
  // gameSocket's finalizeGame - it no longer auto-closes the room), so this
  // is always just a normal trip back to the lobby.
  function handleBackToLobbyOrHome() {
    navigate(`/lobby/${room.roomCode}`);
  }

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

  // Only pops open once the Spy actually has an answer window - during
  // ordinary VOTING there's nothing to open, since the Spy can't answer
  // until the group's vote genuinely concludes (see handleGuess server
  // side); that's REVEALED now regardless of whether it got there via a
  // voluntary surrender or a just-finished vote that failed to catch them.
  useEffect(() => {
    if (isRevealed && privateState.isSpy) {
      setIsGuessModalOpen(true);
      setGuessError(null);
      setIsLocationListOpen(false);
    } else {
      setIsGuessModalOpen(false);
    }
  }, [isRevealed, privateState.isSpy]);

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
  // REVEALED covers two different situations - see types.ts's
  // revealedReason doc comment - and the banner/copy below reads very
  // differently for each: a voluntary surrender (loses if time runs out)
  // vs. a bonus chance after the group's own vote already failed to catch
  // the Spy (never a loss, just falls back to the normal escape).
  const isVoteEscapedBonus = isRevealed && publicState.revealedReason === "VOTE_ESCAPED";

  const showVoteCallPollModal = Boolean(publicState.votePoll) && !hasRespondedToPoll;

  const askerUsername = publicState.askerUserId
    ? usernameByUserId.get(publicState.askerUserId) ?? "ไม่ทราบชื่อ"
    : null;
  // True for this player's whole ask turn - from the instant it becomes
  // their turn until the server confirms a question is actually pending.
  // A "ถามคนต่อไป" button shows first (see the "ถาม-ตอบ" card below);
  // pressing it opens AskTargetModal (name only, no text box), and picking
  // a name there closes the popup and reveals the compose box on the
  // normal page instead - typing a full-screen-overlay text field felt
  // cramped, so the question itself gets composed after the popup's gone.
  const isMyAskTurn =
    !isFinished && !isVoting && !isRevealed &&
    publicState.askerUserId === selfUserId && !publicState.pendingQuestion;
  const isMyQuestionToAnswer =
    !isFinished && !isVoting && !isRevealed && publicState.pendingQuestion?.toUserId === selfUserId;

  // Clears the local "did I open the popup / who did I pick" state the
  // instant this ask turn ends (submitted, or otherwise moved on) so the
  // next time it's this player's turn, it starts back at the button
  // instead of reopening a stale popup or pre-filled compose box.
  useEffect(() => {
    if (!isMyAskTurn) {
      setIsAskModalOpen(false);
      setPendingAskTarget(null);
      setQuestionText("");
    }
  }, [isMyAskTurn]);

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

  // Called from the compose box's "ถาม" button, once a target has already
  // been picked via AskTargetModal - text is optional, since the question
  // itself is often just asked out loud once someone's picked.
  async function handleAskSubmit(targetUserId: string, text: string) {
    setIsAsking(true);
    try {
      await runAction(SPYFALL_ACTIONS.QUESTION, { toUserId: targetUserId, text: text || undefined });
    } finally {
      setIsAsking(false);
    }
  }

  // Only the player currently on the hook to answer sees the box this is
  // wired to (see isMyQuestionToAnswer below) - pressing "ตอบแล้ว" closes
  // out the question and hands them the turn to ask next, whether or not
  // they typed anything (answering out loud is just as valid).
  async function handleAnswerSubmit() {
    setIsAnswering(true);
    try {
      await runAction(SPYFALL_ACTIONS.ANSWER, { text: answerText.trim() || undefined }, () => setAnswerText(""));
    } finally {
      setIsAnswering(false);
    }
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
      // On success the round concludes and isRevealed flips to false, which
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
                  🏆 จบแมตช์แล้ว! ดูตารางคะแนนรวมด้านล่าง - รอผลโหวตว่าจะเล่นแมตช์ใหม่ต่อหรือกลับล็อบบี้...
                </p>
              ) : (
                <p className="flex items-center text-xs text-slate-500">
                  รอผลโหวตว่าจะเล่นต่อหรือกลับล็อบบี้...
                </p>
              )}
              <Button variant="secondary" onClick={handleBackToLobbyOrHome}>
                กลับไปที่ล็อบบี้
              </Button>
            </div>
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        {isFinished && scoreboard && <ScoreboardTable scoreboard={scoreboard} />}

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
            <h2 className="text-sm font-semibold text-slate-300">ถาม-ตอบ</h2>
            {publicState.pendingQuestion ? (
              <p className="mt-1 text-xs text-slate-500">
                🎤 {askerUsername} ถาม {publicState.pendingQuestion.toUsername} อยู่ - รอ
                {publicState.pendingQuestion.toUsername}ตอบ
              </p>
            ) : isMyAskTurn && !pendingAskTarget ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">🎤 ถึงตาคุณถามแล้ว!</p>
                <Button onClick={() => setIsAskModalOpen(true)}>ถามคนต่อไป</Button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                🎤 ตาของ {askerUsername ?? "ใครสักคน"} ที่จะเลือกถามต่อ
              </p>
            )}

            {isMyAskTurn && pendingAskTarget && (
              <div className="mt-4 rounded-xl border border-brand-700 bg-brand-950/30 p-4">
                <p className="text-sm text-brand-200">
                  กำลังจะถาม{" "}
                  <span className="font-semibold">
                    {usernameByUserId.get(pendingAskTarget) ?? "ไม่ทราบชื่อ"}
                  </span>{" "}
                  - จะพูดถามออกเสียงหรือพิมพ์คำถามก็ได้
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="พิมพ์คำถาม (ไม่จำเป็น)..."
                    className="flex-1"
                  />
                  <Button onClick={() => handleAskSubmit(pendingAskTarget, questionText)} isLoading={isAsking}>
                    ถาม
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingAskTarget(null);
                    setIsAskModalOpen(true);
                  }}
                  className="mt-2 text-xs text-slate-500 hover:text-slate-300 hover:underline"
                >
                  เปลี่ยนคนที่จะถาม
                </button>
              </div>
            )}

            {isMyQuestionToAnswer && (
              <div className="mt-4 rounded-xl border border-amber-700 bg-amber-950/30 p-4">
                <p className="text-sm text-amber-200">
                  {askerUsername} ถามคุณอยู่ - จะพูดตอบออกเสียงหรือพิมพ์ก็ได้ แล้วกด "ตอบแล้ว"
                  เพื่อรับตาถามคนต่อไป
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="พิมพ์คำตอบ (ไม่จำเป็น)..."
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={handleAnswerSubmit} isLoading={isAnswering}>
                    ตอบแล้ว
                  </Button>
                </div>
              </div>
            )}

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
          <Card className={isVoteEscapedBonus ? "border-emerald-700" : "border-red-700"}>
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${
                isVoteEscapedBonus ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isVoteEscapedBonus ? "โหวตจบแล้ว - สปายรอดจากการโหวต!" : "สปายเปิดเผยตัวแล้ว!"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {isVoteEscapedBonus
                ? `${revealedSpyUsername ?? "สปาย"} มีโอกาสพิเศษทายสถานที่รับ 3 แต้ม`
                : `${revealedSpyUsername} คือสปาย - กำลังทายสถานที่อยู่`}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {isVoteEscapedBonus
                ? "มีเวลา 5 นาทีให้สปายทายเพื่อรับโบนัส - ถ้าไม่ทายหรือหมดเวลา สปายจะรอดตัวไปแบบธรรมดา (1 แต้ม) ไม่ถือว่าแพ้"
                : "มีเวลา 5 นาทีให้สปายทาย - ถ้าหมดเวลาก่อนสปายจะแพ้ทันที"}
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
                  รอให้ทุกคนโหวตครบ หรือหมดเวลาโหวตก่อน - ถ้ากลุ่มจับคุณไม่ได้ คุณจะได้โอกาสพิเศษทายสถานที่ทีหลัง
                  (โหวตด้านล่างได้ด้วยถ้าอยากกลบเกลื่อน)
                </p>
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
                  {entry.text ? (
                    <span className="text-slate-300">: {entry.text}</span>
                  ) : (
                    <span className="italic text-slate-500"> (ไม่ได้พิมพ์ข้อความ - ถามด้วยวาจา)</span>
                  )}
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
              askerUserId={!isFinished && !isVoting && !isRevealed ? publicState.askerUserId : null}
              pendingTargetUserId={
                !isFinished && !isVoting && !isRevealed ? publicState.pendingQuestion?.toUserId ?? null : null
              }
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

      {isMyAskTurn && isAskModalOpen && !pendingAskTarget && (
        <AskTargetModal
          players={publicState.players}
          selfUserId={selfUserId}
          onSelect={(targetUserId) => {
            setIsAskModalOpen(false);
            setPendingAskTarget(targetUserId);
          }}
          onClose={() => setIsAskModalOpen(false)}
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
