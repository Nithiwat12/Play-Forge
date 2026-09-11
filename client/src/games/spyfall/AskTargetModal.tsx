import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import type { SpyfallPublicPlayer } from "./types";

interface AskTargetModalProps {
  players: SpyfallPublicPlayer[];
  selfUserId?: string;
  blockedUserId?: string | null;
  isSubmitting?: boolean;
  error?: string | null;
  onSelect: (targetUserId: string) => void;
  onClose: () => void;
}

export function AskTargetModal({ players, selfUserId, blockedUserId, isSubmitting, error, onSelect, onClose }: AskTargetModalProps) {
  const askable = players.filter((p) => p.userId !== selfUserId && p.userId !== blockedUserId && p.connected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
      <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto border-brand-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">ถึงตาคุณถามแล้ว!</p>
        <h2 className="mt-1 text-lg font-semibold text-white">จะถามใครดี?</h2>
        <p className="mt-1 text-sm text-slate-400">
          เลือกชื่อเพื่อส่งคำถามทันที ห้ามถามย้อนคนที่เพิ่งถามคุณ
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {askable.length === 0 && (
            <p className="text-sm text-slate-500">ยังไม่มีคนที่ถามได้ออนไลน์ ต้องผ่านคนอื่นก่อนจึงจะถามย้อนกลับได้</p>
          )}
          {askable.map((p) => (
            <button
              key={p.userId}
              type="button"
              disabled={isSubmitting}
              onClick={() => onSelect(p.userId)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-left text-sm text-slate-100 transition hover:border-brand-600 hover:bg-brand-900/40"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {p.username}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" disabled={isSubmitting} onClick={onClose}>
            ปิดไปคิดต่อ
          </Button>
        </div>
      </Card>
    </div>
  );
}
