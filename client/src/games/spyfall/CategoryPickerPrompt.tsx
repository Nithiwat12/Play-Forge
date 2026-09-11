import { useState } from "react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { SPYFALL_CATEGORIES, getCategoryLabel } from "./categories";

export interface CategoryPendingInfo {
  // The category the round that just ended was actually played in (every
  // location has one, even a randomly-picked round 1) - null only if the
  // server genuinely has no idea (shouldn't happen for Spyfall, but the
  // "same category again" shortcut just doesn't show rather than crashing).
  lastCategory: string | null;
}

interface CategoryPickerPromptProps {
  pending: CategoryPendingInfo | null;
  isHost: boolean;
  isSubmitting: boolean;
  error: string | null;
  onSelect: (category: string) => void;
  onDismissError: () => void;
}

// Spyfall-specific step inserted into the game-agnostic "play another
// round?" flow (see ContinueRoundPrompt) only for a "PER_ROUND"
// category-mode match - once everyone agrees to continue, the room doesn't
// go straight into the next-round countdown until the host picks (or
// repeats) this match's next category. Everyone else just waits, same
// overlay style as the continue-vote poll itself.
export function CategoryPickerPrompt({
  pending,
  isHost,
  isSubmitting,
  error,
  onSelect,
  onDismissError,
}: CategoryPickerPromptProps) {
  const [selected, setSelected] = useState<string>(SPYFALL_CATEGORIES[0].id);

  if (!pending) return null;

  const lastLabel = getCategoryLabel(pending.lastCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <Card className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">จบรอบแล้ว</p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          {isHost ? "เลือกหมวดหมู่รอบต่อไป" : "รอหัวหน้าห้องเลือกหมวดหมู่รอบต่อไป..."}
        </h2>

        {isHost ? (
          <>
            <p className="mt-2 text-sm text-slate-400">
              ผู้เล่นคนอื่นต้องรอจนกว่าจะเลือกเสร็จ ถึงจะเริ่มรอบถัดไปได้
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
