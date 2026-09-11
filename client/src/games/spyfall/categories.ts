// Mirrors server/src/games/spyfall/locations.ts's SPYFALL_CATEGORIES - kept
// in sync by hand (no shared package between client/server, same as every
// other Spyfall constant duplicated across the two, e.g. round/player
// limits). Used by CreateRoom's category picker and by
// CategoryPickerPrompt's in-match "choose next round's category" picker.
export const SPYFALL_CATEGORIES = [
  { id: "travel", label: "การเดินทาง" },
  { id: "services", label: "สถานที่ราชการ/บริการ" },
  { id: "education", label: "สถานศึกษา" },
  { id: "food_shopping", label: "ร้านอาหาร/ร้านค้า" },
  { id: "leisure", label: "ท่องเที่ยว/บันเทิง" },
  { id: "residential", label: "ที่พักอาศัย" },
  { id: "sports", label: "กีฬา/ออกกำลังกาย" },
  { id: "nightlife", label: "ไนต์ไลฟ์/ผับบาร์" },
  { id: "government", label: "ราชการ/กฎหมาย" },
  { id: "workplace", label: "ออฟฟิศ/ธุรกิจ" },
  { id: "nature", label: "ธรรมชาติ/กลางแจ้ง" },
  { id: "vehicle", label: "ยานพาหนะ" },
  { id: "unique", label: "สถานที่พิเศษ/แฟนตาซี" },
] as const;

export function getCategoryLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return SPYFALL_CATEGORIES.find((c) => c.id === id)?.label ?? null;
}
