export const WORDHEAD_CATEGORIES = [
  { id: "animals", label: "สัตว์" },
  { id: "household", label: "สิ่งของในบ้าน" },
  { id: "food", label: "อาหาร/ขนมไทย" },
  { id: "jobs", label: "อาชีพ" },
  { id: "places", label: "สถานที่" },
  { id: "fictional", label: "ตัวละครสมมติ" },
] as const;

export type WordHeadCategoryId = (typeof WORDHEAD_CATEGORIES)[number]["id"];

export interface WordHeadWord {
  text: string;
  category: WordHeadCategoryId;
}

const RAW_WORDS: Record<WordHeadCategoryId, string[]> = {
  animals: [
    "ช้าง", "แมว", "สุนัข", "นกฮูก", "จระเข้", "ผึ้ง", "ปลาหมึก", "อูฐ",
    "เต่า", "ยีราฟ", "เสือ", "กระต่าย", "งู", "ปลาวาฬ", "ผีเสื้อ", "ลิง",
    "แพนด้า", "นกกระจอกเทศ",
  ],
  household: [
    "ตู้เย็น", "หมอน", "ไม้กวาด", "กระทะ", "โคมไฟ", "พัดลม", "กระจกเงา",
    "ผ้าห่ม", "ช้อน", "นาฬิกา", "โต๊ะ", "เก้าอี้", "ถังขยะ", "แปรงสีฟัน",
    "หม้อหุงข้าว", "รีโมททีวี", "กุญแจ", "ร่ม",
  ],
  food: [
    "ส้มตำ", "ต้มยำกุ้ง", "ผัดไทย", "ข้าวเหนียวมะม่วง", "ทองหยิบ", "หมูปิ้ง",
    "ก๋วยเตี๋ยว", "ลูกชิ้น", "ขนมครก", "กล้วยแขก", "น้ำพริกกะปิ", "แกงเขียวหวาน",
    "ไก่ทอด", "ข้าวเหนียวไก่ย่าง", "ทับทิมกรอบ", "ปาท่องโก๋", "ข้าวเหนียวหมูปิ้ง",
    "สังขยา",
  ],
  jobs: [
    "หมอ", "ครู", "ตำรวจ", "นักบิน", "พ่อครัว", "ช่างไฟ", "นักดับเพลิง",
    "ชาวนา", "ทนายความ", "พยาบาล", "วิศวกร", "ช่างตัดผม", "นักดนตรี",
    "นักข่าว", "ยาม", "พนักงานส่งของ", "สถาปนิก", "นักแสดง",
  ],
  places: [
    "โรงเรียน", "สนามบิน", "ตลาดนัด", "โรงพยาบาล", "วัด", "ห้างสรรพสินค้า",
    "ชายหาด", "สวนสัตว์", "สถานีรถไฟฟ้า", "ร้านกาแฟ", "สวนสนุก", "ตลาดน้ำ",
    "ห้องสมุด", "โรงหนัง", "ปั๊มน้ำมัน", "สนามฟุตบอล", "ค่ายมวย", "ท่าเรือ",
  ],
  fictional: [
    "มังกร", "ยักษ์", "นางฟ้า", "ผีเสื้อยักษ์", "โจรสลัด", "หุ่นยนต์",
    "แม่มด", "นินจา", "ซามูไร", "เจ้าหญิง", "อัศวิน", "เอเลี่ยน", "แวมไพร์",
    "ซอมบี้", "นักรบ", "พ่อมด", "เงือก", "ยักษ์จินนี่",
  ],
};

export const WORDHEAD_WORDS: WordHeadWord[] = Object.entries(RAW_WORDS).flatMap(
  ([category, list]) => list.map((text) => ({ text, category: category as WordHeadCategoryId })),
);

export function getWordPool(category?: string): WordHeadWord[] {
  if (!category) return WORDHEAD_WORDS;
  const pool = WORDHEAD_WORDS.filter((w) => w.category === category);
  return pool.length > 0 ? pool : WORDHEAD_WORDS;
}

export function getCategoryLabel(id: string): string {
  return WORDHEAD_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
