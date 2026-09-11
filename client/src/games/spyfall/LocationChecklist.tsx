import { memo } from "react";
import { Card } from "../../components/common/Card";

interface LocationChecklistProps {
  locations: string[];
  eliminated: Set<string>;
  onToggle: (location: string) => void;
}

// The Spy's own scratchpad - the full location deck, tap to cross one off
// as it gets ruled out from the conversation. Purely a memory aid: nothing
// here is sent to the server or seen by anyone else, so toggling is
// instant with no network round trip.
function LocationChecklistImpl({ locations, eliminated, onToggle }: LocationChecklistProps) {
  const remaining = locations.length - eliminated.size;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-300">รายชื่อสถานที่ (กาตัดตัวเลือก)</h2>
        <span className="text-xs text-slate-500">เหลือ {remaining} / {locations.length}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        กดชื่อสถานที่เพื่อตัดออกระหว่างคิด ไม่ต้องส่งให้ใครดู เป็นสมุดจดของคุณคนเดียว
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
    </Card>
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
    prev.onToggle === next.onToggle
  );
});
