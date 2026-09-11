import { useState } from "react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import type { SpyfallPublicPlayer } from "./types";

interface AskTargetModalProps {
  players: SpyfallPublicPlayer[];
  selfUserId?: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (targetUserId: string, text: string) => void;
}

// Pops up automatically for whoever's turn it is to ask (askerUserId ===
// selfUserId with no pendingQuestion yet - see SpyfallGame.tsx) - replaces
// the old "ถาม" links next to each name in PlayerList with a proper
// one-question-at-a-time relay. No close button: it's this player's turn,
// and picking someone is the only way to move on - same idea as WordHead's
// GuessJudgeModal. The question itself can be typed here or just asked out
// loud once picked; text is optional either way.
export function AskTargetModal({ players, selfUserId, isSubmitting, error, onSubmit }: AskTargetModalProps) {
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [text, setText] = useState("");

  const askable = players.filter((p) => p.userId !== selfUserId && p.connected);
  const selectedPlayer = askable.find((p) => p.userId === targetUserId) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
      <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto border-brand-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">ถึงตาคุณถามแล้ว!</p>
        <h2 className="mt-1 text-lg font-semibold text-white">จะถามใครดี?</h2>
        <p className="mt-1 text-sm text-slate-400">
          เลือกคนที่จะถาม แล้วจะพิมพ์คำถามหรือพูดถามออกเสียงเลยก็ได้
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {askable.length === 0 && (
            <p className="text-sm text-slate-500">ตอนนี้ไม่มีผู้เล่นคนอื่นออนไลน์ให้ถาม</p>
          )}
          {askable.map((p) => {
            const isSelected = targetUserId === p.userId;
            return (
              <button
                key={p.userId}
                type="button"
                onClick={() => setTargetUserId(p.userId)}
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                  isSelected
                    ? "border-brand-500 bg-brand-900/60 text-white"
                    : "border-slate-700 bg-slate-900 text-slate-100 hover:border-brand-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {p.username}
                </span>
                {isSelected && <span className="text-xs text-brand-400">เลือกแล้ว</span>}
              </button>
            );
          })}
        </div>

        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="พิมพ์คำถาม (ไม่จำเป็น - จะพูดออกเสียงเลยก็ได้)..."
          className="mt-4"
        />

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end">
          <Button
            variant="danger"
            disabled={!targetUserId}
            isLoading={isSubmitting}
            onClick={() => targetUserId && onSubmit(targetUserId, text.trim())}
          >
            ถาม{selectedPlayer ? `: ${selectedPlayer.username}` : ""}
          </Button>
        </div>
      </Card>
    </div>
  );
}
