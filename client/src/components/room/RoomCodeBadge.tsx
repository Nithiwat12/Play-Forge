import { useState } from "react";

export function RoomCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (permissions, insecure context) - not critical.
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="คลิกเพื่อคัดลอก"
      className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-xl tracking-[0.3em] text-white hover:border-brand-500"
    >
      {code}
      <span className="text-xs font-sans tracking-normal text-slate-400">
        {copied ? "คัดลอกแล้ว!" : "คัดลอก"}
      </span>
    </button>
  );
}
