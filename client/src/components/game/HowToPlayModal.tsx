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
      { emoji: "📝", text: "สปายมีรายชื่อสถานที่ทั้งหมดให้เปิดดูได้ตลอด ไว้กาตัดตัวเลือกส่วนตัวระหว่างฟังคนอื่นคุย" },
      {
        emoji: "🗳️",
        text: "ใครก็ได้กดปุ่ม \"ขอเปิดโหวต\" เมื่อคิดว่ารู้แล้วว่าใครเป็นสปาย - ทุกคน (สปายด้วย) จะได้ป๊อปอัปให้ตอบรับ/ปฏิเสธ ถ้าอย่างน้อยครึ่งห้องเห็นด้วยก็เข้าสู่โหมดโหวตได้เลย ถ้าไม่ถึงครึ่ง จะเล่นต่อและต้องรอ 2 นาทีก่อนขอใหม่ได้",
      },
      {
        emoji: "✅",
        text: "ทุกคนโหวตเลือกคนที่คิดว่าเป็นสปายได้ (สปายเองก็โหวตกลบเกลื่อนได้เหมือนกัน) พร้อมกันนั้นสปายจะได้ป๊อปอัปให้เลือกตอบสถานที่จริง ๆ 1 ที่",
      },
      {
        emoji: "🏳️",
        text: "สปายมีปุ่ม \"ยอมแพ้ / ขอทายเลย\" แยกต่างหาก กดแล้วเปิดเผยตัวทันทีต่อทุกคน แลกกับเวลาส่วนตัว 5 นาทีในการทายสถานที่โดยไม่ต้องรอใคร - กดแล้วย้อนกลับไม่ได้",
      },
      { emoji: "🏆", text: "โหวตถูกตัวสปาย ฝ่ายผู้เล่นทั่วไปชนะ ถ้าโหวตผิดคนหรือสปายทายสถานที่ถูก ฝ่ายสปายชนะ (ถ้าสปายยอมแพ้แล้วทายไม่ทันเวลา ฝ่ายผู้เล่นทั่วไปชนะทันที)" },
      {
        emoji: "⏱️",
        text: "โหมดโหวตมีเวลาจำกัด 5 นาที พอมีคนได้เสียงข้างมากแล้วสรุปผลได้ทันที ไม่ต้องรอให้ครบทุกคน ถ้าหมดเวลาก็สรุปจากสิ่งที่มีอยู่ตอนนั้น",
      },
      {
        emoji: "🤝",
        text: "ถ้าโหวตเสมอกันตั้งแต่ 2 คนขึ้นไป จะเข้าสู่ \"รอบดีเบท\" - มีป๊อปอัปแจ้งเตือน ได้เวลาพิเศษอีก 5 นาทีคุยกันต่อ และรอบถัดไปโหวตได้เฉพาะคนที่คะแนนเท่ากันเท่านั้น (สูงสุด 2 ครั้งต่อรอบเกม)",
      },
    ],
  },
  wordhead: {
    emoji: "🧠",
    title: "วิธีเล่น ทายคำบนหัว",
    steps: [
      { emoji: "🔀", text: "เล่นทีละคน - ระบบจะสุ่มเลือกลำดับผู้เล่น แล้ววนให้แต่ละคนขึ้นทายทีละคนจนครบทุกคน" },
      {
        emoji: "🙈",
        text: "ตอนถึงตาใคร ระบบจะสุ่ม \"คำ\" ให้ 1 คำ ซึ่งคนนั้นจะมองไม่เห็นคำของตัวเอง แต่ทุกคนที่เหลือในห้องจะเห็นคำนั้นชัดเจน",
      },
      {
        emoji: "💡",
        text: "คนอื่นที่ไม่ใช่เจ้าของตาช่วยกันกดปุ่ม \"ให้คำใบ้\" ได้ตลอดเวลา จะพิมพ์คำใบ้หรือพูดออกเสียงแล้วกดเฉย ๆ ก็ได้ - ปุ่มจะขึ้นให้กดได้เสมอ แต่กดแล้วจะมีคูลดาวน์ส่วนตัวประมาณ 10 วินาทีก่อนกดซ้ำได้อีก",
      },
      { emoji: "⏱️", text: "นาฬิกาจับเวลาจะเริ่มนับตั้งแต่ขึ้นตา และนับไปเรื่อย ๆ จนกว่าจะทายถูก - ยิ่งใช้เวลาน้อยยิ่งดี" },
      { emoji: "⌨️", text: "เจ้าของตาพิมพ์คำตอบที่คิดว่าใช่ได้เรื่อย ๆ ไม่จำกัดจำนวนครั้ง ทายผิดไม่มีโทษ แค่เสียเวลาเพิ่ม" },
      {
        emoji: "🏳️",
        text: "ถ้าคิดไม่ออกจริง ๆ กดปุ่ม \"ยอมแพ้ / ข้ามตานี้\" ได้ - เวลาที่ใช้ไปจนถึงตอนนั้นจะถูกบันทึกไว้เป็นเวลาของตานี้ และย้อนกลับไม่ได้",
      },
      { emoji: "🏆", text: "เมื่อทุกคนขึ้นทายครบแล้ว เกมจบและสรุปตารางเวลาของทุกคน - ใครใช้เวลาน้อยที่สุดคือผู้ชนะของรอบนี้" },
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
