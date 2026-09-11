import { useState } from "react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";

interface GuessModalProps {
  locations: string[];
  eliminated: Set<string>;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (location: string) => void;
  onClose: () => void;
}

// The Spy's final answer, picked from the real location list - replaces
// the old honor-system "ทายถูก/ทายผิด" self-report buttons. Picking a
// location only highlights it; a separate confirm step guards against an
// accidental tap ending the round on the wrong answer.
export function GuessModal({
  locations,
  eliminated,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: GuessModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
      <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto">
        <h2 className="text-lg font-semibold text-white">ตอบสถานที่</h2>
        <p className="mt-1 text-sm text-slate-400">
          เลือกสถานที่ที่คุณคิดว่าใช่ แล้วกดยืนยัน - ตอบได้ครั้งเดียวเท่านั้น
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {locations.map((name) => {
            const isSelected = selected === name;
            const isOut = eliminated.has(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelected(name)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "border-brand-500 bg-brand-900/60 text-white"
                    : isOut
                      ? "border-slate-800 bg-slate-900/40 text-slate-600 line-through"
                      : "border-slate-700 bg-slate-900 text-slate-100 hover:border-brand-600"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            ปิดไปคิดต่อ
          </Button>
          <Button
            variant="danger"
            disabled={!selected}
            isLoading={isSubmitting}
            onClick={() => selected && onSubmit(selected)}
          >
            ยืนยันคำตอบ{selected ? `: ${selected}` : ""}
          </Button>
        </div>
      </Card>
    </div>
  );
}
