import { useEffect, useState } from "react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { SPYFALL_CATEGORIES, getCategoryLabel } from "./categories";

export interface CategoryPendingInfo {
  // The category the room last actually played (every location has one,
  // even a randomly-picked round) - null if there's genuinely no previous
  // round to reference yet (a brand-new room's very first pick).
  lastCategory: string | null;
}

interface CategoryPickerPromptProps {
  pending: CategoryPendingInfo | null;
  isHost: boolean;
  isSubmitting: boolean;
  error: string | null;
  onSelect: (category: string) => void;
  onDismissError: () => void;
  // Which moment this pick is happening at, purely for wording:
  // "roundStart" = the host just pressed "start game" from the lobby (round
  // 1 of a match, or a fresh match in a reused room) - "roundEnd" = a round
  // just finished and everyone agreed to keep playing (see
  // ContinueRoundPrompt). Defaults to "roundEnd", the original context this
  // component was built for.
  context?: "roundStart" | "roundEnd";
}

// Spyfall-specific step inserted wherever a "PER_ROUND" category-mode match
// is about to begin a round - either the game-agnostic "play another
// round?" flow (see ContinueRoundPrompt) once everyone agrees to continue,
// or the lobby's "start game" button for a fresh round 1 - the room never
// actually starts the round (no timer, nothing) until the host picks (or
// repeats) a category here.
export function CategoryPickerPrompt({
  pending,
  isHost,
  isSubmitting,
  error,
  onSelect,
  onDismissError,
  context = "roundEnd",
}: CategoryPickerPromptProps) {
  const [selected, setSelected] = useState<string>(SPYFALL_CATEGORIES[0].id);
  // Only the "someone else is picking, I'm just waiting" view can be closed
  // - it's purely a local UI dismissal, the room still won't actually start
  // the round until the host really picks one, and everyone gets moved on
  // automatically (via game:start) once that happens whether or not they
  // closed this. Reset the moment a *new* pending pick opens, so closing it
  // during one wait doesn't leave the next one pre-dismissed too.
  const [waitingDismissed, setWaitingDismissed] = useState(false);

  useEffect(() => {
    if (pending) setWaitingDismissed(false);
  }, [pending]);

  if (!pending) return null;
  if (!isHost && waitingDismissed) return null;

  const lastLabel = getCategoryLabel(pending.lastCategory);
  const eyebrow = context === "roundStart" ? "เตรียมเริ่มเกม" : "จบรอบแล้ว";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <Card className="w-full max-w-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {isHost ? "เลือกหมวดหมู่รอบต่อไป" : "หัวหน้าห้องกำลังเลือกหมวดหมู่..."}
            </h2>
          </div>
          {!isHost && (
            <button
              type="button"
              onClick={() => setWaitingDismissed(true)}
              aria-label="ปิด"
              className="shrink-0 text-lg leading-none text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {isHost ? (
          <>
            <p className="mt-2 text-sm text-slate-400">
              ผู้เล่นคนอื่นต้องรอจนกว่าจะเลือกเสร็จ ถึงจะเริ่มรอบได้ (เวลายังไม่เริ่มนับจนกว่าจะเลือก)
            </p>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={isSubmitting}
              className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            >
              {SPYFALL_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              {pending.lastCategory && lastLabel && (
                <Button
                  variant="secondary"
                  onClick={() => onSelect(pending.lastCategory!)}
                  disabled={isSubmitting}
                >
                  เล่นหมวดเดิม ({lastLabel})
                </Button>
              )}
              <Button variant="primary" onClick={() => onSelect(selected)} isLoading={isSubmitting}>
                ยืนยันหมวดหมู่
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            {lastLabel ? `รอบที่แล้วเล่นหมวด "${lastLabel}"` : "รอสักครู่..."}
          </p>
        )}

        {error && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-950/50 px-3 py-2">
            <p className="text-sm text-red-300">{error}</p>
            <Button variant="ghost" onClick={onDismissError}>
              ปิด
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
