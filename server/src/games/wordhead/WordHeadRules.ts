import { GameActionError } from "../core/types";
import type { AskQuestionPayload, AnswerQuestionPayload, GuessPayload, UpdateNotesPayload } from "./WordHeadState";

export const WORDHEAD_MIN_PLAYERS = 3;
export const WORDHEAD_MAX_PLAYERS = 8;

// How long a player has to ask a question or make a guess before their turn
// auto-passes to the next player. Generous, since in-person groups may be
// talking out loud rather than typing.
export const WORDHEAD_TURN_SECONDS = 30;

// Once a question is asked, this is how long the rest of the group has to
// vote yes/no/unsure before it resolves from whatever votes came in.
export const WORDHEAD_ANSWER_WINDOW_SECONDS = 12;

// Hard stop for the whole round, regardless of how many turns have passed.
export const WORDHEAD_ROUND_SECONDS = 5 * 60;

export const WORDHEAD_MAX_TEXT_LENGTH = 200;
export const WORDHEAD_MAX_NOTES_LENGTH = 1000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Question text is intentionally optional - players sitting together in
// person can just ask out loud, so the server never requires it. Online-only
// groups will normally send it so everyone sees the same question text.
export function validateAskQuestionPayload(payload: unknown): AskQuestionPayload {
  if (payload === null || payload === undefined) return { questionText: null };
  if (typeof payload !== "object") {
    throw new GameActionError("ข้อมูลคำถามไม่ถูกต้อง");
  }
  const { questionText } = payload as Record<string, unknown>;
  if (questionText === undefined || questionText === null || questionText === "") {
    return { questionText: null };
  }
  if (typeof questionText !== "string") {
    throw new GameActionError("ข้อมูลคำถามไม่ถูกต้อง");
  }
  if (questionText.length > WORDHEAD_MAX_TEXT_LENGTH) {
    throw new GameActionError(`คำถามต้องมีความยาวไม่เกิน ${WORDHEAD_MAX_TEXT_LENGTH} ตัวอักษร`);
  }
  return { questionText: questionText.trim() || null };
}

export function validateAnswerPayload(payload: unknown): AnswerQuestionPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("ข้อมูลการโหวตไม่ถูกต้อง");
  }
  const { vote } = payload as Record<string, unknown>;
  if (vote !== "YES" && vote !== "NO" && vote !== "UNSURE") {
    throw new GameActionError("ต้องโหวต ใช่ / ไม่ใช่ / ไม่แน่ใจ");
  }
  return { vote };
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

/** Fewer questions used before a correct guess is worth more. */
export function scoreForQuestionsUsed(questionsUsed: number): number {
  if (questionsUsed <= 3) return 3;
  if (questionsUsed <= 6) return 2;
  return 1;
}

export function resolveMajorityAnswer(
  votes: Record<string, "YES" | "NO" | "UNSURE">
): "YES" | "NO" | "UNSURE" {
  const counts = { YES: 0, NO: 0, UNSURE: 0 };
  for (const v of Object.values(votes)) counts[v] += 1;
  if (counts.YES === 0 && counts.NO === 0 && counts.UNSURE === 0) return "UNSURE";
  if (counts.YES > counts.NO && counts.YES >= counts.UNSURE) return "YES";
  if (counts.NO > counts.YES && counts.NO >= counts.UNSURE) return "NO";
  if (counts.YES === counts.NO && counts.YES > 0) return "UNSURE";
  return "UNSURE";
}
