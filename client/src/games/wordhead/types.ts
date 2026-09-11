// Mirrors server/src/games/wordhead/WordHeadState.ts - kept in sync by hand
// (no shared package between client/server), same as Spyfall's types.ts.
//
// Hot-seat design: one player at a time is "up" with a word only they
// can't see; everyone else can help via a rate-limited hint button. A
// stopwatch measures how long each player took - LOWER is better here,
// the opposite of every other game's points convention (see WordHeadResult).

export type WordHeadPhase = "TURN" | "FINISHED";

export interface WordHeadPublicPlayer {
  userId: string;
  username: string;
  connected: boolean;
  hasGone: boolean;
  guessedCorrectly: boolean;
  timeUsedSeconds: number | null;
}

export interface WordHeadLogEntry {
  id: string;
  type: "hint" | "guess" | "system";
  userId: string | null;
  username: string | null;
  text: string | null;
  guessCorrect?: boolean;
  timestamp: number;
}

export interface WordHeadResult {
  summary: string;
  // userId -> seconds taken. LOWER is better (opposite of every other
  // game's points-where-more-is-better convention) - anything ranking or
  // picking a "winner" from this must sort ascending / take the minimum.
  scores: Record<string, number>;
  correctUserIds: string[];
  fastestUserId: string | null;
  slowestUserId: string | null;
  wordCategory: string | null;
}

export interface WordHeadPublicState {
  phase: WordHeadPhase;
  players: WordHeadPublicPlayer[];
  turnOrder: string[];
  currentTurnUserId: string | null;
  turnStartedAt: number | null;
  log: WordHeadLogEntry[];
  wordCategory: string | null;
  result: WordHeadResult | null;
}

export interface WordHeadPrivateState {
  currentWord: string | null;
  hintCooldownEndsAt: number | null;
  notes: string;
}

export const WORDHEAD_ACTIONS = {
  HINT: "wordhead:hint",
  GUESS: "wordhead:guess",
  PASS_TURN: "wordhead:passTurn",
  UPDATE_NOTES: "wordhead:updateNotes",
} as const;
