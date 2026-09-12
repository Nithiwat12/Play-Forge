import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { Input } from "../../components/common/Input";
import { PlayerBoard } from "./PlayerBoard";
import { HintPanel } from "./HintPanel";
import { GuessJudgeModal } from "./GuessJudgeModal";
import { Stopwatch } from "./Stopwatch";
import { NotesPad } from "./NotesPad";
import { WordHeadTimeTable } from "./WordHeadTimeTable";
import type { WordHeadTimeEntry } from "./WordHeadTimeTable";
import { getCategoryLabel } from "./categories";
import { WORDHEAD_ACTIONS } from "./types";
import type { WordHeadPublicState, WordHeadPrivateState } from "./types";
import type { Room, Scoreboard } from "../../types";

interface WordHeadGameProps {
  room: Room;
  publicState: WordHeadPublicState;
  privateState: WordHeadPrivateState;
  selfUserId?: string;
  onAction: (actionType: string, payload: unknown) => Promise<{ ok: boolean; error?: string }>;
  onReplay: () => Promise<{ ok: boolean; error?: string }>;
  scoreboard: Scoreboard | null;
}

export function WordHeadGame({
  room,
  publicState,
  privateState,
  selfUserId,
  onAction,
  onReplay,
  scoreboard,
}: WordHeadGameProps) {
  const navigate = useNavigate();
  const [isReplaying, setIsReplaying] = useState(false);
  async function handlePlayAgain() {
    if (isReplaying) return;
    setIsReplaying(true);
    setActionError(null);
    try {
      const response = await onReplay();
      if (!response.ok) setActionError(response.error ?? "เล่นต่อไม่สำเร็จ");
    } finally { setIsReplaying(false); }
  }
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [guessText, setGuessText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isGivingHint, setIsGivingHint] = useState(false);
  const [isMarkingCorrect, setIsMarkingCorrect] = useState(false);
  const [isMarkingWrong, setIsMarkingWrong] = useState(false);

  const isFinished = publicState.phase === "FINISHED";
  const isMyTurn = publicState.phase === "TURN" && publicState.currentTurnUserId === selfUserId;
  const matchComplete = scoreboard?.matchComplete ?? false;

  const usernameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of publicState.players) map.set(p.userId, p.username);
    for (const p of scoreboard?.players ?? []) {
      if (!map.has(p.userId)) map.set(p.userId, p.username);
    }
    return map;
  }, [publicState.players, scoreboard]);

  const currentTurnUsername = publicState.currentTurnUserId
    ? usernameByUserId.get(publicState.currentTurnUserId) ?? "ไม่ทราบชื่อ"
    : null;

  // Wait for the whole roster except the guesser, matching the server.
  const eligibleVoterIds = useMemo(
    () => publicState.players.filter((p) => p.userId !== publicState.currentTurnUserId).map((p) => p.userId),
    [publicState.players, publicState.currentTurnUserId]
  );
  const votesNeeded = eligibleVoterIds.length;
  const votesCorrectCount = eligibleVoterIds.filter((id) => publicState.guessVotes[id] === "correct").length;
  const votesCount = eligibleVoterIds.filter((id) => publicState.guessVotes[id] !== undefined).length;
  const waitingNames = publicState.players.filter((p) => eligibleVoterIds.includes(p.userId) && !publicState.guessVotes[p.userId]).map((p) => `${p.username}${p.connected ? "" : " (ออฟไลน์)"}`);
  const selfVote = selfUserId ? publicState.guessVotes[selfUserId] : undefined;

  useEffect(() => {
    setShowPassConfirm(false);
    setGuessText("");
    setActionError(null);
  }, [publicState.currentTurnUserId, publicState.phase]);

  const categoryLabel = getCategoryLabel(publicState.wordCategory);
  const currentRoundNumber = scoreboard
    ? Math.min(scoreboard.roundsPlayed + (isFinished ? 0 : 1), scoreboard.numberOfRounds ?? Infinity)
    : 1;

  const resultEntries: WordHeadTimeEntry[] = useMemo(() => {
    if (!publicState.result) return [];
    return Object.entries(publicState.result.scores).map(([userId, seconds]) => ({
      userId,
      username: usernameByUserId.get(userId) ?? "ไม่ทราบชื่อ",
      seconds,
      correct: publicState.result!.correctUserIds.includes(userId),
    }));
  }, [publicState.result, usernameByUserId]);

  // Cumulative total across every round played so far this match (only
  // meaningful once numberOfRounds > 1 is configured) - re-derived from the
  // same generic scoreboard.totals the shared ScoreboardTable uses, since
  // that's sorted highest-first for a points game; wordhead's totals are
  // seconds where lower is better, so this re-sorts ascending instead of
  // reusing that shared component as-is.
  const cumulativeEntries: WordHeadTimeEntry[] = useMemo(() => {
    if (!scoreboard || scoreboard.roundsPlayed <= 1) return [];
    return scoreboard.totals.map((t) => ({ userId: t.userId, username: t.username, seconds: t.total }));
  }, [scoreboard]);

  // The room stays open and playable after a match completes now (see
  // gameSocket's finalizeGame - it no longer auto-closes the room), so this
  // is always just a normal trip back to the lobby.
  function handleBackToLobbyOrHome() {
    navigate(`/lobby/${room.roomCode}`);
  }

  const runAction = useCallback(
    async (actionType: string, payload: unknown, onSuccess?: () => void) => {
      setActionError(null);
      const result = await onAction(actionType, payload);
      if (!result.ok) {
        setActionError(result.error ?? "การกระทำล้มเหลว");
      } else {
        onSuccess?.();
      }
      return result;
    },
    [onAction]
  );

  async function handleGuess() {
    if (!guessText.trim() || publicState.pendingGuess || isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      await runAction(WORDHEAD_ACTIONS.GUESS, { guessText }, () => setGuessText(""));
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleAnswer() {
    if (publicState.pendingGuess || isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      await runAction(WORDHEAD_ACTIONS.ANSWER, {});
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handlePass() {
    if (isSubmittingAction || publicState.pendingGuess) return;
    setIsSubmittingAction(true);
    try {
      await runAction(WORDHEAD_ACTIONS.PASS_TURN, {}, () => setShowPassConfirm(false));
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleGiveHint(hintText: string | null) {
    setIsGivingHint(true);
    try {
      await runAction(WORDHEAD_ACTIONS.HINT, { hintText });
    } finally {
      setIsGivingHint(false);
    }
  }

  async function handleMarkCorrect() {
    if (!publicState.pendingGuess || selfVote || isMarkingCorrect || isMarkingWrong) return;
    setIsMarkingCorrect(true);
    try {
      await runAction(WORDHEAD_ACTIONS.MARK_CORRECT, { guessId: publicState.pendingGuess.id });
    } finally {
      setIsMarkingCorrect(false);
    }
  }

  async function handleMarkWrong() {
    if (!publicState.pendingGuess || selfVote || isMarkingCorrect || isMarkingWrong) return;
    setIsMarkingWrong(true);
    try {
      await runAction(WORDHEAD_ACTIONS.MARK_WRONG, { guessId: publicState.pendingGuess.id });
    } finally {
      setIsMarkingWrong(false);
    }
  }

  function handleSaveNotes(notes: string) {
    void onAction(WORDHEAD_ACTIONS.UPDATE_NOTES, { notes });
  }

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4 sm:gap-6">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">{room.roomName}</p>
            <h1 className="text-xl font-semibold text-white">{room.game.name}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {scoreboard?.numberOfRounds && `รอบที่ ${currentRoundNumber} / ${scoreboard.numberOfRounds} · `}
              {categoryLabel && `หมวด ${categoryLabel}`}
            </p>
          </div>
          {!isFinished && <Stopwatch startedAt={publicState.turnStartedAt} />}
        </Card>

        {isFinished && publicState.result && (
          <Card className="border-brand-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">จบเกมแล้ว</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{publicState.result.summary}</h2>
            {publicState.result.fastestUserId && (
              <p className="mt-2 text-sm text-slate-300">
                ⚡ เร็วที่สุด: <span className="font-semibold text-emerald-400">{usernameByUserId.get(publicState.result.fastestUserId) ?? "ไม่ทราบชื่อ"}</span>
                {publicState.result.slowestUserId && publicState.result.slowestUserId !== publicState.result.fastestUserId && (
                  <>
                    {" "}· 🐢 ช้าที่สุด:{" "}
                    <span className="font-semibold text-amber-400">
                      {usernameByUserId.get(publicState.result.slowestUserId) ?? "ไม่ทราบชื่อ"}
                    </span>
                  </>
                )}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {matchComplete ? (
                <p className="flex items-center gap-1 text-sm font-medium text-amber-400">
                  🏆 จบแมตช์แล้ว! ดูตารางคะแนนรวมด้านล่าง - เลือกเล่นต่อหรือกลับล็อบบี้ได้เมื่อพร้อม
                </p>
              ) : (
                <p className="flex items-center text-xs text-slate-500">เลือกเล่นต่อหรือกลับล็อบบี้ได้เมื่อพร้อม</p>
              )}
              <Button onClick={() => { void handlePlayAgain(); }} isLoading={isReplaying}>เล่นต่อ</Button>
              <Button variant="secondary" onClick={handleBackToLobbyOrHome}>
                กลับไปที่ล็อบบี้
              </Button>
            </div>
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        {isFinished && <WordHeadTimeTable entries={resultEntries} title="สรุปเวลารอบนี้" />}
        {isFinished && cumulativeEntries.length > 0 && (
          <WordHeadTimeTable entries={cumulativeEntries} title="เวลารวมสะสมทั้งแมตช์" />
        )}

        {!isFinished && publicState.phase === "TURN" && isMyTurn && (
          <Card className="border-amber-700">
            <h2 className="text-sm font-semibold text-slate-300">ตาของคุณ - ทายคำของตัวเอง</h2>
            <p className="mt-1 text-xs text-slate-500">
              คนอื่นในห้องเห็นคำของคุณและกำลังช่วยใบ้อยู่ - ฟังคำใบ้แล้วตอบได้เลย จะพูดออกเสียงหรือพิมพ์ก็ได้
              พิมพ์แล้วกด “ทายคำ” หรือพูดแล้วกด “ตอบแล้ว” รอคนใบ้ทุกคนโหวตครบ ตัดสินด้วยเสียงส่วนมาก
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                disabled={Boolean(publicState.pendingGuess) || isSubmittingAction}
                maxLength={200}
                value={guessText}
                onChange={(e) => setGuessText(e.target.value)}
                placeholder="พิมพ์คำที่คุณคิดว่าใช่..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleGuess();
                }}
              />
              <Button variant="danger" onClick={handleGuess} disabled={!guessText.trim() || Boolean(publicState.pendingGuess)} isLoading={isSubmittingAction}>
                ทายคำ
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={handleAnswer} disabled={Boolean(publicState.pendingGuess)} isLoading={isSubmittingAction}>
                ตอบแล้ว
              </Button>
              <Button variant="ghost" onClick={() => setShowPassConfirm(true)} disabled={Boolean(publicState.pendingGuess)} isLoading={isSubmittingAction}>
                ยอมแพ้ / ข้ามตานี้
              </Button>
            </div>
            {publicState.pendingGuess && (
              <div className="mt-3 text-sm text-slate-300" role="status">
                <p>รอคนใบ้โหวตครบ: {votesCount}/{votesNeeded} คน · ถูก {votesCorrectCount} / ไม่ถูก {votesCount - votesCorrectCount}</p>
                <p className="mt-1 text-slate-400">รอ: {waitingNames.join(", ")}</p>
              </div>
            )}
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        {!isFinished && publicState.phase === "TURN" && !isMyTurn && currentTurnUsername && (
          <>
            <HintPanel
              currentWord={privateState.currentWord}
              currentTurnUsername={currentTurnUsername}
              hintCooldownEndsAt={privateState.hintCooldownEndsAt}
              isSubmitting={isGivingHint}
              onGiveHint={handleGiveHint}
            />
            {actionError && <p className="text-sm text-red-400">{actionError}</p>}
          </>
        )}

        {!isFinished &&
          publicState.phase === "TURN" &&
          !isMyTurn &&
          currentTurnUsername &&
          publicState.pendingGuess && (
            <GuessJudgeModal
              guesserUsername={currentTurnUsername}
              guessText={publicState.pendingGuess.text}
              isMarkingCorrect={isMarkingCorrect}
              isMarkingWrong={isMarkingWrong}
              onMarkCorrect={handleMarkCorrect}
              onMarkWrong={handleMarkWrong}
              votesCount={votesCount}
              waitingNames={waitingNames}
              error={actionError}
              votesCorrectCount={votesCorrectCount}
              votesNeeded={votesNeeded}
              selfVote={selfVote ?? null}
            />
          )}

        <Card>
          <h2 className="text-sm font-semibold text-slate-300">ประวัติการเล่น</h2>
          <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
            {publicState.log.length === 0 && (
              <p className="text-sm text-slate-500">ยังไม่มีใครให้คำใบ้ - เริ่มช่วยกันใบ้ได้เลย!</p>
            )}
            {publicState.log.map((entry) => {
              if (entry.type === "system") {
                return (
                  <div key={entry.id} className="text-center text-xs italic text-amber-400">
                    {entry.text}
                  </div>
                );
              }
              if (entry.type === "guess") {
                return (
                  <div key={entry.id} className="rounded-lg bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                    <span className="font-medium text-slate-200">{entry.username}</span> {entry.text ? `ทายว่า "${entry.text}"` : "ตอบด้วยเสียง"}
                    <span className="italic text-slate-500"> - รอเพื่อนกดยืนยัน</span>
                  </div>
                );
              }
              return (
                <div key={entry.id} className="rounded-lg bg-emerald-950/30 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-200">💡 {entry.username}</span>
                  <span className="text-slate-300">
                    {" "}
                    {entry.text ? `ใบ้ว่า "${entry.text}"` : "ให้คำใบ้ (ด้วยวาจา)"}
                  </span>
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
            <PlayerBoard
              players={publicState.players}
              currentTurnUserId={publicState.currentTurnUserId}
              selfUserId={selfUserId}
            />
          </div>
        </Card>

        {showPassConfirm && isMyTurn && !publicState.pendingGuess && (
          <ConfirmModal
            title="ยอมแพ้ / ข้ามตานี้?"
            message="เวลาที่ใช้ไปแล้วจะถูกบันทึกไว้ และย้อนกลับไม่ได้"
            confirmLabel={isSubmittingAction ? "กำลังบันทึก..." : "ยืนยันข้ามตา"}
            cancelLabel="เล่นต่อ"
            onConfirm={() => { void handlePass(); }}
            onCancel={() => { if (!isSubmittingAction) setShowPassConfirm(false); }}
          />
        )}
        <NotesPad notes={privateState.notes} onSave={handleSaveNotes} />
      </div>
    </div>
  );
}
