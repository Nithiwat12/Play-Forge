import { useEffect, useState } from "react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";

interface HintPanelProps {
  currentWord: string | null;
  currentTurnUsername: string;
  hintCooldownEndsAt: number | null;
  isSubmitting: boolean;
  onGiveHint: (hintText: string | null) => void;
  isMarkingCorrect: boolean;
  isMarkingWrong: boolean;
  onMarkCorrect: () => void;
  onMarkWrong: () => void;
}

// Shown to everyone EXCEPT the current up player. The "ให้คำใบ้" button
// stays visible at all times (per design - it never disappears), just
// disables itself with a countdown while this viewer's own 10-second
// cooldown is active; text is optional so an in-person group can just say
// the hint out loud and tap the button purely to start their cooldown.
//
// The ✅/❌ judging buttons below are always available too, no cooldown -
// they're how the room decides whether the up player's answer (typed or
// just said out loud) is right. A typed guess also pops up GuessJudgeModal
// on top of everything so it can't be missed, but these buttons stay here
// as the everyday way to confirm an answer said out loud.
export function HintPanel({
  currentWord,
  currentTurnUsername,
  hintCooldownEndsAt,
  isSubmitting,
  onGiveHint,
  isMarkingCorrect,
  isMarkingWrong,
  onMarkCorrect,
  onMarkWrong,
}: HintPanelProps) {
  const [hintText, setHintText] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hintCooldownEndsAt) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [hintCooldownEndsAt]);

  const cooldownSecondsLeft = hintCooldownEndsAt ? Math.max(0, Math.ceil((hintCooldownEndsAt - now) / 1000)) : 0;
  const onCooldown = cooldownSecondsLeft > 0;

  function handleSubmit() {
    onGiveHint(hintText.trim() || null);
    setHintText("");
  }

  return (
    <Card className="border-emerald-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">คำของ {currentTurnUsername}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-wide text-white">{currentWord}</h2>
      <p className="mt-1 text-xs text-slate-500">
        ช่วยใบ้ได้เลย - พูดออกเสียงแล้วกดปุ่มเฉย ๆ ก็ได้ ไม่ต้องพิมพ์ก็ได้ กดได้เรื่อย ๆ แต่คุณจะมีคูลดาวน์ของตัวเอง
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          value={hintText}
          onChange={(e) => setHintText(e.target.value)}
          placeholder="พิมพ์คำใบ้ (ไม่จำเป็น)..."
          className="flex-1"
        />
        <Button onClick={handleSubmit} disabled={onCooldown} isLoading={isSubmitting}>
          {onCooldown ? `รอ ${cooldownSecondsLeft} วิ` : "ให้คำใบ้"}
        </Button>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3">
        <p className="text-xs text-slate-500">{currentTurnUsername} ตอบถูกไหม? (ไม่ว่าจะพิมพ์หรือพูดออกเสียง)</p>
        <div className="mt-2 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 border border-emerald-800 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
            onClick={onMarkCorrect}
            isLoading={isMarkingCorrect}
            disabled={isMarkingWrong}
          >
            ✅ ตอบถูก
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onMarkWrong}
            isLoading={isMarkingWrong}
            disabled={isMarkingCorrect}
          >
            ❌ ยังไม่ถูก
          </Button>
        </div>
      </div>
    </Card>
  );
}
