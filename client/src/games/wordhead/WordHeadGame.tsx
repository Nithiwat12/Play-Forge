import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Timer } from "../../components/common/Timer";
import { ScoreboardTable } from "../../components/game/ScoreboardTable";
import { PlayerBoard } from "./PlayerBoard";
import { AnswerPoll } from "./AnswerPoll";
import { NotesPad } from "./NotesPad";
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
  matchClosesAt?: number | null;
}

export function WordHeadGame({
  room,
  publicState,
  privateState,
  selfUserId,
  onAction,
  scoreboard,
  matchClosesAt,
}: WordHeadGameProps) {
  const navigate = useNavigate();
  const [questionText, setQuestionText] = useState("");
  const [guessText, setGuessText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [votingChoice, setVotingChoice] = useState<"YES" | "NO" | "UNSURE" | null>(null);

  const isFinished = publicState.phase === "FINISHED";
  const isAnswerWindow = publicState.phase === "ANSWER_WINDOW";
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

  const categoryLabel = getCategoryLabel(publicState.wordCategory);
  const currentRoundNumber = scoreboard
    ? Math.min(scoreboard.roundsPlayed + (isFinished ? 0 : 1), scoreboard.numberOfRounds ?? Infinity)
    : 1;

  const [nowForMatchClose, setNowForMatchClose] = useState(() => Date.now());
  useEffect(() => {
    if (!matchClosesAt) return;
    const interval = setInterval(() => setNowForMatchClose(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [matchClosesAt]);
  const matchClosesSecondsLeft = matchClosesAt
    ? Math.max(0, Math.ceil((matchClosesAt - nowForMatchClose) / 1000))
    : 0;

  function handleBackToLobbyOrHome() {
    if (matchComplete) {
      navigate("/home", { state: { notice: `เกม "${room.roomName}" จบแล้ว! เล่นครบ ${scoreboard?.numberOfRounds} รอบ` } });
    } else {
      navigate(`/lobby/${room.roomCode}`);
    }
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

  async function handleAsk() {
    setIsSubmittingAction(true);
    try {
      await runAction(WORDHEAD_ACTIONS.ASK_QUESTION, { questionText: questionText.trim() || null }, () =>
        setQuestionText("")
      );
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleGuess() {
    if (!guessText.trim()) return;
    setIsSubmittingAction(true);
    try {
      await runAction(WORDHEAD_ACTIONS.GUESS, { guessText }, () => setGuessText(""));
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handlePass() {
    setIsSubmittingAction(true);
    try {
      await runAction(WORDHEAD_ACTIONS.PASS_TURN, {});
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleVote(vote: "YES" | "NO" | "UNSURE") {
    setVotingChoice(vote);
    try {
      await runAction(WORDHEAD_ACTIONS.ANSWER_QUESTION, { vote });
    } finally {
      setVotingChoice(null);
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
          <div className="flex items-center gap-2">
            {publicState.roundEndsAt && !isFinished && (
              <div className="text-right">
                <p className="text-[10px] uppercase text-slate-500">เวลาทั้งรอบ</p>
                <Timer endsAt={publicState.roundEndsAt} />
              </div>
            )}
            {publicState.turnEndsAt && !isFinished && (
              <div className="text-right">
                <p className="text-[10px] uppercase text-slate-500">เวลาในตานี้</p>
                <Timer endsAt={publicState.turnEndsAt} />
              </div>
            )}
          </div>
        </Card>

        {isFinished && publicState.result && (
          <Card className="border-brand-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">จบเกมแล้ว</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{publicState.result.summary}</h2>
            <p className="mt-2 text-sm text-slate-400">
              ทายถูก {publicState.result.correctCount} / {publicState.result.totalPlayers} คน
            </p>

            {Object.values(publicState.result.scores ?? {}).some((pts) => pts > 0) && (
              <div className="mt-4 rounded-lg bg-slate-900/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">คะแนนที่ได้รอบนี้</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {Object.entries(publicState.result.scores)
                    .filter(([, pts]) => pts > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([userId, pts]) => (
                      <li key={userId} className="flex items-center justify-between text-sm text-slate-300">
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
                  🏆 จบแมตช์แล้ว! ดูตารางคะแนนรวมด้านล่าง - ห้องจะปิดอัตโนมัติใน {matchClosesSecondsLeft} วินาที
                </p>
              ) : (
                <p className="flex items-center text-xs text-slate-500">รอผลโหวตว่าจะเล่นต่อหรือกลับล็อบบี้...</p>
              )}
              <Button variant="secondary" onClick={handleBackToLobbyOrHome}>
                {matchComplete ? "กลับหน้าหลัก" : "กลับไปที่ล็อบบี้"}
              </Button>
            </div>
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        {isFinished && scoreboard && <ScoreboardTable scoreboard={scoreboard} />}

        {isAnswerWindow && publicState.pendingPoll && (
          <AnswerPoll
            poll={publicState.pendingPoll}
            askerUsername={usernameByUserId.get(publicState.pendingPoll.askerUserId) ?? "ไม่ทราบชื่อ"}
            selfUserId={selfUserId}
            isSubmitting={votingChoice !== null}
            onVote={handleVote}
          />
        )}

        {!isFinished && publicState.phase === "TURN" && (
          <Card>
            {isMyTurn ? (
              <>
                <h2 className="text-sm font-semibold text-slate-300">ตาของคุณ - ถามคำถามหรือทายคำของตัวเอง</h2>
                <p className="mt-1 text-xs text-slate-500">
                  ถ้านั่งเล่นด้วยกัน จะถามด้วยปากเปล่าแล้วกดปุ่ม "ถามคำถาม" เฉย ๆ ก็ได้ ไม่ต้องพิมพ์คำถามก็ได้
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="พิมพ์คำถาม (ไม่จำเป็น)..."
                    className="flex-1"
                  />
                  <Button onClick={handleAsk} isLoading={isSubmittingAction}>
                    ถามคำถาม
                  </Button>
                </div>

                <h2 className="mt-5 text-sm font-semibold text-slate-300">ทายคำของตัวเอง</h2>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={guessText}
                    onChange={(e) => setGuessText(e.target.value)}
                    placeholder="พิมพ์คำที่คุณคิดว่าใช่..."
                    className="flex-1"
                  />
                  <Button variant="danger" onClick={handleGuess} disabled={!guessText.trim()} isLoading={isSubmittingAction}>
                    ทายคำ
                  </Button>
                </div>

                <div className="mt-4">
                  <Button variant="secondary" onClick={handlePass} isLoading={isSubmittingAction}>
                    ข้ามตานี้
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                รอ <span className="font-medium text-white">{currentTurnUsername}</span> ถามคำถามหรือทายคำ...
              </p>
            )}
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </Card>
        )}

        <Card>
          <h2 className="text-sm font-semibold text-slate-300">ประวัติการเล่น</h2>
          <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
            {publicState.log.length === 0 && (
              <p className="text-sm text-slate-500">ยังไม่มีการถามคำถาม - เริ่มถามกันเลย!</p>
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
                  <div
                    key={entry.id}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      entry.guessCorrect ? "bg-emerald-950/60 text-emerald-200" : "bg-slate-900/70 text-slate-300"
                    }`}
                  >
                    <span className="font-medium text-slate-200">{entry.username}</span> ทายว่า "{entry.text}"
                    {entry.guessCorrect ? " - ถูกต้อง! 🎉" : " - ยังไม่ถูก"}
                  </div>
                );
              }
              return (
                <div key={entry.id} className="rounded-lg bg-slate-900/70 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-200">{entry.username}</span>
                  <span className="text-slate-300">
                    {" "}
                    {entry.text ? `ถามว่า "${entry.text}"` : "ถามคำถาม (ด้วยวาจา)"}
                  </span>
                  {entry.answer && (
                    <span
                      className={`ml-2 font-semibold ${
                        entry.answer === "YES"
                          ? "text-emerald-400"
                          : entry.answer === "NO"
                            ? "text-red-400"
                            : "text-slate-400"
                      }`}
                    >
                      {entry.answer === "YES" ? "ใช่" : entry.answer === "NO" ? "ไม่ใช่" : "ไม่แน่ใจ"}
                    </span>
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
            <PlayerBoard
              players={publicState.players}
              wordsByUserId={privateState.wordsByUserId}
              currentTurnUserId={publicState.currentTurnUserId}
              selfUserId={selfUserId}
            />
          </div>
        </Card>

        <NotesPad notes={privateState.notes} onSave={handleSaveNotes} />
      </div>
    </div>
  );
}
