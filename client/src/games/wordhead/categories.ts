// Mirrors server/src/games/wordhead/words.ts's WORDHEAD_CATEGORIES - kept in
// sync by hand, same as Spyfall's categories.ts.
export const WORDHEAD_CATEGORIES = [
  { id: "animals", label: "สัตว์" },
  { id: "household", label: "สิ่งของในบ้าน" },
  { id: "food", label: "อาหาร/ขนมไทย" },
  { id: "jobs", label: "อาชีพ" },
  { id: "places", label: "สถานที่" },
  { id: "fictional", label: "ตัวละครสมมติ" },
] as const;

export function getCategoryLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return WORDHEAD_CATEGORIES.find((c) => c.id === id)?.label ?? null;
}
