import { Button } from "../common/Button";

interface HowToPlayStep {
  emoji: string;
  text: string;
}

interface HowToPlayContent {
  emoji: string;
  title: string;
  steps: HowToPlayStep[];
}

// Per-game "how to play" copy, written short and simple (not the same text
// as the game's one-line library description). Keyed by slug so a future
// second game just adds its own entry here - nothing else changes.
const HOW_TO_PLAY: Record<string, HowToPlayContent> = {
  spyfall: {
    emoji: "🕵️",
    title: "วิธีเล่น Spy Hunt",
    steps: [
      { emoji: "🕵️", text: "ระบบจะสุ่มผู้เล่นคนหนึ่งเป็น \"สปาย\" แบบลับ ๆ ไม่มีใครรู้ว่าใครเป็น" },
      {
        emoji: "📍",
        text: "คนอื่นที่เหลือทุกคนจะเห็น \"สถานที่\" และ \"อาชีพ\" ของตัวเองในสถานที่นั้น ส่วนสปายจะไม่เห็นสถานที่เลย",
      },
      { emoji: "❓", text: "ผลัดกันถามคำถามเกี่ยวกับสถานที่ เพื่อดูว่าใครตอบแปลก ๆ จนน่าสงสัย" },
      { emoji: "🤫", text: "สปายต้องฟังคำใบ้แล้วเดาสถานที่ให้ถูก โดยไม่ให้ใครจับได้ว่าตัวเองคือสปาย" },
      {
        emoji: "🗳️",
        text: "ใครก็ได้กดปุ่ม \"ขอเปิดโหวต\" เมื่อคิดว่ารู้แล้วว่าใครเป็นสปาย เมื่อคนส่วนใหญ่กด จะเข้าสู่โหมดโหวต",
      },
      {
        emoji: "✅",
        text: "ผู้เล่นทั่วไปโหวตเลือกคนที่คิดว่าเป็นสปาย ส่วนสปายพูดคำทายสถานที่ออกมาดัง ๆ แล้วกดบอกเองตามจริงว่าทายถูกหรือผิด",
      },
      { emoji: "🏆", text: "โหวตถูกตัวสปาย ฝ่ายผู้เล่นทั่วไปชนะ ถ้าโหวตผิดคนหรือสปายทายสถานที่ถูก ฝ่ายสปายชนะ" },
      { emoji: "⏱️", text: "ถ้าโหวตเสมอกันตั้งแต่ 2 คนขึ้นไป จะได้เวลาพิเศษเพิ่มอีก 5 นาทีเพื่อคุยกันต่อ" },
    ],
  },
};

interface HowToPlayModalProps {
  gameSlug: string;
  onClose: () => void;
}

export function HowToPlayModal({ gameSlug, onClose }: HowToPlayModalProps) {
  const content = HOW_TO_PLAY[gameSlug];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="ปิด"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 pr-8">
          <span className="text-3xl">{content?.emoji ?? "📔"}</span>
          <h2 className="text-lg font-semibold text-white">{content?.title ?? "วิธีเล่น"}</h2>
        </div>

        {content ? (
          <ol className="mt-5 flex flex-col gap-3">
            {content.steps.map((step, index) => (
              <li
                key={index}
                className="flex items-start gap-3 rounded-xl bg-slate-800/80 p-3 text-sm text-slate-200"
              >
                <span className="text-xl leading-none">{step.emoji}</span>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-slate-400">ยังไม่มีคำแนะนำการเล่นสำหรับเกมนี้</p>
        )}

        <Button className="mt-6 w-full" onClick={onClose}>
          เข้าใจแล้ว เริ่มเล่นเลย
        </Button>
      </div>
    </div>
  );
}
