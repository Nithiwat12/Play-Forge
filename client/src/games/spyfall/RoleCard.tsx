import { memo, useState } from "react";
import type { SpyfallPrivateState } from "./types";

function RoleCardImpl({ privateState }: { privateState: SpyfallPrivateState }) {
  const [revealed, setRevealed] = useState(false);
  if (!revealed) {
    return <button type="button" aria-expanded={false} onClick={() => setRevealed(true)}
      className="w-full rounded-xl border border-brand-800 bg-brand-950/40 p-5 text-center text-slate-100">
      บทบาทของคุณถูกปิดบัง — คลิกเพื่อเปิด
    </button>;
  }
  if (privateState.isSpy) {
    return (
      <button type="button" aria-expanded={true} aria-label="ซ่อนบทบาท" onClick={() => setRevealed(false)} className="w-full rounded-xl border border-red-800 bg-red-950/60 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-400">บทบาทของคุณ</p>
        <p className="mt-1 text-2xl font-bold text-red-200">คุณคือสปาย</p>
        <p className="mt-2 text-sm text-red-300">
          หาสถานที่ให้เจอจากคำถามของทุกคน โดยไม่ให้ใครจับได้ว่าคุณคือสปาย
        </p>
      </button>
    );
  }

  return (
    <button type="button" aria-expanded={true} aria-label="ซ่อนบทบาท" onClick={() => setRevealed(false)} className="w-full rounded-xl border border-brand-800 bg-brand-950/40 p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">สถานที่</p>
      <p className="mt-1 text-2xl font-bold text-white">{privateState.location}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-400">
        บทบาทของคุณ
      </p>
      <p className="mt-1 text-lg text-slate-100">{privateState.role}</p>
    </button>
  );
}

// The server sends a brand-new privateState object on every broadcast
// (even ones that don't concern this player's own role), so the default
// reference-equality memo would never skip a render here - compare the
// three fields that actually matter instead.
export const RoleCard = memo(RoleCardImpl, (prev, next) => {
  const a = prev.privateState;
  const b = next.privateState;
  return a.isSpy === b.isSpy && a.location === b.location && a.role === b.role;
});
