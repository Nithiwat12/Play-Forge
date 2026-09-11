import { useEffect, useRef, useState } from "react";
import { Card } from "../../components/common/Card";

const SAVE_DEBOUNCE_MS = 600;

interface NotesPadProps {
  notes: string;
  onSave: (notes: string) => void;
}

// Personal scratchpad, available to every player at all times (not gated to
// only the current guesser) - purely for jotting down clues while thinking.
// Typing updates local state immediately for a responsive textarea, and is
// debounced before actually calling onSave (which hits the server via the
// UPDATE_NOTES action) so we're not sending a request on every keystroke.
// The server intentionally never broadcasts this back out to the room - see
// WordHeadGame.ts's handleUpdateNotes - so there's no risk of an echoed
// update clobbering what's still being typed.
export function NotesPad({ notes, onSave }: NotesPadProps) {
  const [value, setValue] = useState(notes);
  const lastSavedRef = useRef(notes);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only adopt an external `notes` change (e.g. right after reconnecting) if
  // it doesn't match what we last saved ourselves - otherwise a state push
  // that merely echoes our own prior save would reset the cursor mid-typing.
  useEffect(() => {
    if (notes !== lastSavedRef.current) {
      setValue(notes);
      lastSavedRef.current = notes;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  function handleChange(next: string) {
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      lastSavedRef.current = next;
      onSave(next);
    }, SAVE_DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-300">โน้ตส่วนตัว</h2>
      <p className="mt-1 text-xs text-slate-500">
        จดข้อมูลใบ้ตัวเองได้ตามสบาย - เห็นแค่คุณคนเดียว ไม่มีใครในห้องเห็น
      </p>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="จดคำใบ้ที่ได้จากคำถาม..."
        rows={4}
        maxLength={1000}
        className="mt-3 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
      />
    </Card>
  );
}
