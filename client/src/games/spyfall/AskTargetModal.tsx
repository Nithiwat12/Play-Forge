import { Card } from "../../components/common/Card";
import type { SpyfallPublicPlayer } from "./types";

interface AskTargetModalProps {
  players: SpyfallPublicPlayer[];
  selfUserId?: string;
  onSelect: (targetUserId: string) => void;
}

// Pops up automatically for whoever's turn it is to ask (askerUserId ===
// selfUserId, before they've picked anyone yet - see SpyfallGame.tsx's
// isMyAskTurn/pendingAskTarget). Picking a name here just closes the popup
// and hands the pick back to the normal page, where the compose box (with
// the optional question text field) takes over - typing into a box buried
// inside a full-screen overlay felt cramped, so composing happens after
// the popup is already gone. No close button: it's this player's turn, and
// picking someone is the only way to move on - same idea as WordHead's
// GuessJudgeModal.
export function AskTargetModal({ players, selfUserId, onSelect }: AskTargetModalProps) {
  const askable = players.filter((p) => p.userId !== selfUserId && p.connected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
      <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto border-brand-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">ถึงตาคุณถามแล้ว!</p>
        <h2 className="mt-1 text-lg font-semibold text-white">จะถามใครดี?</h2>
        <p className="mt-1 text-sm text-slate-400">
          เลือกคนที่จะถาม แล้วค่อยพิมพ์คำถามหรือพูดถามออกเสียงในหน้าเกม
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {askable.length === 0 && (
            <p className="text-sm text-slate-500">ตอนนี้ไม่มีผู้เล่นคนอื่นออนไลน์ให้ถาม</p>
          )}
          {askable.map((p) => (
            <button
              key={p.userId}
              type="button"
              onClick={() => onSelect(p.userId)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-left text-sm text-slate-100 transition hover:border-brand-600 hover:bg-brand-900/40"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {p.username}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
