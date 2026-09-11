import { GameActionError } from "../core/types";
import { SPYFALL_LOCATIONS } from "./locations";
import type {
  SpyfallGuessPayload,
  SpyfallQuestionPayload,
  SpyfallAnswerPayload,
  SpyfallVotePayload,
  SpyfallVoteTally,
  SpyfallVoteCallResponsePayload,
} from "./SpyfallState";

export const SPYFALL_MIN_PLAYERS = 3;
export const SPYFALL_MAX_PLAYERS = 8;
export const SPYFALL_TIMER_SECONDS = 8 * 60; // 8 minute round, classic default
export const SPYFALL_MAX_TEXT_LENGTH = 300;

// When a vote ends in a tie, the group gets this many extra seconds to
// keep talking instead of the Spy automatically escaping.
export const SPYFALL_TIE_EXTENSION_SECONDS = 5 * 60;
// Safety cap so a group that keeps tying can't stall the round forever.
export const SPYFALL_MAX_TIE_EXTENSIONS = 2;

// Once voting opens (a majority accepting a call-vote poll, or the
// discussion clock running out), this is how long everyone has to finish -
// the Spy to submit their final answer, the rest of the group to finish
// accusing someone - before the round resolves from whatever's been
// submitted so far. Deliberately the same clock for both: they open at
// the same moment and this one timer is the shared deadline for both.
//
// Also reused as the Spy's own dedicated window after they "surrender"
// (SPYFALL_ACTIONS.SURRENDER) - same length, but uncontested: nobody else
// is racing that clock, since there's no group vote in that path at all.
export const SPYFALL_VOTING_SECONDS = 5 * 60;

// How long a "someone wants to open the accusation vote" poll waits for
// responses before resolving from whatever came in (mirrors the room-level
// continue-play poll's own timeout). Majority accept opens VOTING; a tie,
// nobody responding, or majority decline all default to staying in
// discussion instead.
export const SPYFALL_CALL_VOTE_POLL_SECONDS = 30;

// After a call-vote poll fails to reach a majority "yes", this is how long
// the room has to wait before anyone can request one again - stops the
// button being spammed right back the moment it fails.
export const SPYFALL_CALL_VOTE_COOLDOWN_SECONDS = 2 * 60;

// --- Payload validation -----------------------------------------------
// Every payload arriving over the socket is untyped `unknown` at the
// boundary; these functions are the single place that turns it into a
// trusted, typed value or rejects it. Never skip these before using a
// payload's fields.

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateQuestionPayload(payload: unknown): SpyfallQuestionPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("ข้อมูลคำถามไม่ถูกต้อง");
  }
  const { toUserId, text } = payload as Record<string, unknown>;
  if (!isNonEmptyString(toUserId)) {
    throw new GameActionError("ต้องเลือกผู้เล่นที่จะถามด้วย");
  }
  if (!isNonEmptyString(text)) {
    throw new GameActionError("กรุณากรอกคำถาม");
  }
  if (text.length > SPYFALL_MAX_TEXT_LENGTH) {
    throw new GameActionError(`คำถามต้องมีความยาวไม่เกิน ${SPYFALL_MAX_TEXT_LENGTH} ตัวอักษร`);
  }
  return { toUserId, text: text.trim() };
}

export function validateAnswerPayload(payload: unknown): SpyfallAnswerPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("ข้อมูลคำตอบไม่ถูกต้อง");
  }
  const { text } = payload as Record<string, unknown>;
  if (!isNonEmptyString(text)) {
    throw new GameActionError("กรุณากรอกคำตอบ");
  }
  if (text.length > SPYFALL_MAX_TEXT_LENGTH) {
    throw new GameActionError(`คำตอบต้องมีความยาวไม่เกิน ${SPYFALL_MAX_TEXT_LENGTH} ตัวอักษร`);
  }
  return { text: text.trim() };
}

export function validateVotePayload(payload: unknown): SpyfallVotePayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("ข้อมูลการโหวตไม่ถูกต้อง");
  }
  const { targetUserId } = payload as Record<string, unknown>;
  if (!isNonEmptyString(targetUserId)) {
    throw new GameActionError("ต้องเลือกผู้เล่นที่จะโหวต");
  }
  return { targetUserId };
}

export function validateVoteCallResponsePayload(payload: unknown): SpyfallVoteCallResponsePayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("ข้อมูลไม่ถูกต้อง");
  }
  const { accept } = payload as Record<string, unknown>;
  if (typeof accept !== "boolean") {
    throw new GameActionError("ข้อมูลไม่ถูกต้อง");
  }
  return { accept };
}

const VALID_LOCATION_NAMES = new Set(SPYFALL_LOCATIONS.map((l) => l.name));

export function validateGuessPayload(payload: unknown): SpyfallGuessPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("ข้อมูลการตอบไม่ถูกต้อง");
  }
  const { location } = payload as Record<string, unknown>;
  if (!isNonEmptyString(location)) {
    throw new GameActionError("กรุณาเลือกสถานที่ที่จะตอบ");
  }
  const trimmed = location.trim();
  if (!VALID_LOCATION_NAMES.has(trimmed)) {
    throw new GameActionError("สถานที่ที่เลือกไม่ถูกต้อง");
  }
  return { location: trimmed };
}

// --- Call-vote poll threshold ---------------------------------------------

/**
 * Majority threshold (more than half) used to resolve the "open the
 * accusation vote?" poll early in either direction - the same "more than
 * half" rule the room-level continue-play poll uses. The Spy gets no
 * special-casing: their response counts exactly like anyone else's.
 */
export function requiredPollMajority(totalPlayers: number): number {
  return Math.floor(totalPlayers / 2) + 1;
}

// --- Vote resolution -----------------------------------------------------

export function tallyVotes(
  votes: Map<string, string>,
  usernameByUserId: Map<string, string>
): SpyfallVoteTally[] {
  const counts = new Map<string, number>();
  for (const targetUserId of votes.values()) {
    counts.set(targetUserId, (counts.get(targetUserId) ?? 0) + 1);
  }

  const tally: SpyfallVoteTally[] = Array.from(counts.entries()).map(([targetUserId, count]) => ({
    targetUserId,
    targetUsername: usernameByUserId.get(targetUserId) ?? "ไม่ทราบชื่อ",
    count,
  }));

  tally.sort((a, b) => b.count - a.count);
  return tally;
}

/** Returns the sole top-voted userId, or null if there's a tie for first. */
export function resolveMajority(tally: SpyfallVoteTally[]): string | null {
  if (tally.length === 0) return null;
  const top = tally[0];
  const tiedForFirst = tally.filter((t) => t.count === top.count);
  return tiedForFirst.length === 1 ? top.targetUserId : null;
}
