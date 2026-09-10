import { GameActionError } from "../core/types";
import type {
  SpyfallGuessPayload,
  SpyfallQuestionPayload,
  SpyfallAnswerPayload,
  SpyfallVotePayload,
  SpyfallVoteTally,
} from "./SpyfallState";

export const SPYFALL_MIN_PLAYERS = 3;
export const SPYFALL_MAX_PLAYERS = 8;
export const SPYFALL_TIMER_SECONDS = 8 * 60; // 8 minute round, classic default
export const SPYFALL_MAX_TEXT_LENGTH = 300;

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
    throw new GameActionError("Invalid question payload");
  }
  const { toUserId, text } = payload as Record<string, unknown>;
  if (!isNonEmptyString(toUserId)) {
    throw new GameActionError("A target player is required to ask a question");
  }
  if (!isNonEmptyString(text)) {
    throw new GameActionError("Question text is required");
  }
  if (text.length > SPYFALL_MAX_TEXT_LENGTH) {
    throw new GameActionError(`Question text must be under ${SPYFALL_MAX_TEXT_LENGTH} characters`);
  }
  return { toUserId, text: text.trim() };
}

export function validateAnswerPayload(payload: unknown): SpyfallAnswerPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("Invalid answer payload");
  }
  const { text } = payload as Record<string, unknown>;
  if (!isNonEmptyString(text)) {
    throw new GameActionError("Answer text is required");
  }
  if (text.length > SPYFALL_MAX_TEXT_LENGTH) {
    throw new GameActionError(`Answer text must be under ${SPYFALL_MAX_TEXT_LENGTH} characters`);
  }
  return { text: text.trim() };
}

export function validateVotePayload(payload: unknown): SpyfallVotePayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("Invalid vote payload");
  }
  const { targetUserId } = payload as Record<string, unknown>;
  if (!isNonEmptyString(targetUserId)) {
    throw new GameActionError("A vote target is required");
  }
  return { targetUserId };
}

export function validateGuessPayload(payload: unknown): SpyfallGuessPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new GameActionError("Invalid guess payload");
  }
  const { location } = payload as Record<string, unknown>;
  if (!isNonEmptyString(location)) {
    throw new GameActionError("A location guess is required");
  }
  return { location };
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
    targetUsername: usernameByUserId.get(targetUserId) ?? "Unknown",
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
