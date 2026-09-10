import { Card } from "../common/Card";
import { Button } from "../common/Button";

// Per-game "how to play" copy, written short and simple (not the same text
// as the game's one-line library description). Keyed by slug so a future
// second game just adds its own entry here - nothing else changes.
const HOW_TO_PLAY: Record<string, { title: string; steps: string[] }> = {
  spyfall: {
    title: "วิธีเล่น Spyfall",
    steps: [
      "ระบบจะสุ่มผู้เล่นคนหนึ่งเป็น \"สปาย\" แบบลับ ๆ ไม่มีใครรู้ว่าใครเป็น",
      "คนอื่นที่เหลือทุกคนจะเห็น \"สถานที่\" และ \"อาชีพ\" ของตัวเองในสถานที่นั้น ส่วนสปายจะไม่เห็นสถานที่เลย",
      "ผลัดกันถามคำถามเกี่ยวกับสถานที่ เช่น \"ที่นี่มีกลิ่นแบบไหน\" เพื่อดูว่าใครตอบแปลก ๆ จนน่าสงสัยว่าไม่รู้จักสถานที่จริง",
      "สปายต้องฟังคำใบ้จากคำถาม-คำตอบของทุกคน แล้วเดาสถานที่ให้ถูก โดยไม่ให้ใครจับได้ว่าตัวเองคือสปาย",
      "ใครก็ได้กดปุ่ม \"ขอเปิดโหวต\" เมื่อคิดว่ารู้แล้วว่าใครเป็นสปาย (หรือถ้าเป็นสปายเองและคิดว่าทายสถานที่ได้แล้ว) เมื่อคนส่วนใหญ่กด จะเข้าสู่โหมดโหวต",
      "ในโหมดโหวต ผู้เล่นทั่วไปจะโหวตเลือกคนที่คิดว่าเป็นสปาย ส่วนสปายจะพูดคำทายสถานที่ออกมาดัง ๆ แล้วกดบอกเองตามจริงว่าทายถูกหรือผิด",
      "โหวตถูกตัวสปาย ฝ่ายผู้เล่นทั่วไปชนะ ถ้าโหวตผิดคนหรือสปายทายสถานที่ถูก ฝ่ายสปายชนะ",
      "ถ้าโหวตเสมอกันตั้งแต่ 2 คนขึ้นไป จะได้เวลาพิเศษเพิ่มอีก 5 นาทีเพื่อคุยกันต่อ",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <Card className="max-h-[85vh] w-full max-w-md overflow-y-auto">
        <h2 className="text-lg font-semibold text-white">{content?.title ?? "วิธีเล่น"}</h2>

        {content ? (
          <ol className="mt-4 flex flex-col gap-3 text-sm text-slate-300">
            {content.steps.map((step, index) => (
              <li key={index} className="flex gap-2">
                <span className="font-semibold text-brand-400">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-slate-400">ยังไม่มีคำแนะนำการเล่นสำหรับเกมนี้</p>
        )}

        <Button className="mt-6 w-full" variant="secondary" onClick={onClose}>
          เข้าใจแล้ว
        </Button>
      </Card>
    </div>
  );
}
