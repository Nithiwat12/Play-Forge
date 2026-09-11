import { memo } from "react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";

interface LocationChecklistProps {
  locations: string[];
  eliminated: Set<string>;
  onToggle: (location: string) => void;
  onClose: () => void;
}

// The Spy's own scratchpad - the full location deck, tap to cross one off
// as it gets ruled out from the conversation. Purely a memory aid: nothing
// here is sent to the server or seen by anyone else, so toggling is
// instant with no network round trip. Opened on demand from a button on
// the normal discussion screen, rather than sitting inline the whole time.
function LocationChecklistImpl({ locations, eliminated, onToggle, onClose }: LocationChecklistProps) {
  const remaining = locations.length - eliminated.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
      <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">รายชื่อสถานที่ (กาตัดตัวเลือก)</h2>
          <span className="text-xs text-slate-500">เหลือ {remaining} / {locations.length}</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          กดชื่อสถานที่เพื่อตัดออกระหว่างคิด ไม่ต้องส่งให้ใครดู เป็นสมุดจดของคุณคนเดียว
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {locations.map((name) => {
            const isOut = eliminated.has(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => onToggle(name)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isOut
                    ? "border-slate-800 bg-slate-900/40 text-slate-600 line-through"
                    : "border-slate-700 bg-slate-900 text-slate-100 hover:border-brand-600"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </Card>
    </div>
  );
}

// `locations` is a fresh array reference from the server on every single
// broadcast even though its contents never change mid-round, so compare by
// length + eliminated-set reference instead of the default shallow prop
// check (which would never skip a render here).
export const LocationChecklist = memo(LocationChecklistImpl, (prev, next) => {
  return (
    prev.locations.length === next.locations.length &&
    prev.locations.every((name, i) => name === next.locations[i]) &&
    prev.eliminated === next.eliminated &&
    prev.onToggle === next.onToggle &&
    prev.onClose === next.onClose
  );
});
