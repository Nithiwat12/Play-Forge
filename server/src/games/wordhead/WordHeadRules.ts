import { GameActionError } from "../core/types";
import type { GuessPayload, HintPayload, UpdateNotesPayload } from "./WordHeadState";

export const WORDHEAD_MIN_PLAYERS = 3;
export const WORDHEAD_MAX_PLAYERS = 8;

// Anyone other than the current hot-seat player can press "give a hint" as
// often as they like, but each individual player gets their own 10-second
// cooldown after pressing it - stops one enthusiastic player from spamming
// hints nonstop while still letting everyone help.
export const WORDHEAD_HINT_COOLDOWN_SECONDS = 10;

export const WORDHEAD_MAX_TEXT_LENGTH = 200;
export const WORDHEAD_MAX_NOTES_LENGTH = 1000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Hint text is intentionally optional - players sitting together in person
// can just say the hint out loud and tap the button purely to log it (and
// start their own cooldown); online-only groups will normally type it so
// everyone sees the same hint text.
export function validateHintPayload(payload: unknown): HintPayload {
  if (payload === null || payload === undefined) return { hintText: null };
  if (typeof payload !== "object") {
    throw new GameActionError("ข้อมูลคำใบ้ไม่ถูกต้อง");
  }
  const { hintText } = payload as Record<string, unknown>;
  if (hintText === undefined || hintText === null || hintText === "") {
    return { hintText: null };
  }
  if (typeof hintText !== "string") {
    throw new GameActionError("ข้อมูลคำใบ้ไม่ถูกต้อง");
  }
  if (hintText.length > WORDHEAD_MAX_TEXT_LENGTH) {
    throw new GameActionError(`คำใบ้ต้องมีความยาวไม่เกิน ${WORDHEAD_MAX_TEXT_LENGTH} ตัวอักษร`);
  }
  return { hintText: hintText.trim() || null };
}

export function validateGuessPayload(payload: unknown): GuessPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("ข้อมูลคำตอบไม่ถูกต้อง");
  }
  const { guessText } = payload as Record<string, unknown>;
  if (!isNonEmptyString(guessText)) {
    throw new GameActionError("กรุณากรอกคำที่จะทาย");
  }
  if (guessText.length > WORDHEAD_MAX_TEXT_LENGTH) {
    throw new GameActionError(`คำที่ทายต้องมีความยาวไม่เกิน ${WORDHEAD_MAX_TEXT_LENGTH} ตัวอักษร`);
  }
  return { guessText: guessText.trim() };
}

export function validateUpdateNotesPayload(payload: unknown): UpdateNotesPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("ข้อมูลโน้ตไม่ถูกต้อง");
  }
  const { notes } = payload as Record<string, unknown>;
  if (typeof notes !== "string") {
    throw new GameActionError("ข้อมูลโน้ตไม่ถูกต้อง");
  }
  if (notes.length > WORDHEAD_MAX_NOTES_LENGTH) {
    throw new GameActionError(`โน้ตต้องมีความยาวไม่เกิน ${WORDHEAD_MAX_NOTES_LENGTH} ตัวอักษร`);
  }
  return { notes };
}

/** Trim, collapse internal whitespace, and lowercase for guess comparison. */
export function normalizeForCompare(value: string): string {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

export function isCorrectGuess(guessText: string, word: string): boolean {
  return normalizeForCompare(guessText) === normalizeForCompare(word);
}
