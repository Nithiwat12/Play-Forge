// Mirrors server/src/games/wordhead/WordHeadState.ts - kept in sync by hand
// (no shared package between client/server), same as Spyfall's types.ts.

export type WordHeadPhase = "TURN" | "ANSWER_WINDOW" | "FINISHED";

export interface WordHeadPublicPlayer {
  userId: string;
  username: string;
  connected: boolean;
  guessedCorrectly: boolean;
  questionsUsed: number;
  score: number;
}

export interface WordHeadLogEntry {
  id: string;
  type: "question" | "guess" | "system";
  userId: string | null;
  username: string | null;
  text: string | null;
  answer?: "YES" | "NO" | "UNSURE";
  guessCorrect?: boolean;
  timestamp: number;
}

export interface WordHeadAnswerPoll {
  id: string;
  askerUserId: string;
  questionText: string | null;
  votes: Record<string, "YES" | "NO" | "UNSURE">;
  endsAt: number;
}

export interface WordHeadResult {
  summary: string;
  scores: Record<string, number>;
  correctCount: number;
  totalPlayers: number;
  wordCategory: string | null;
}

export interface WordHeadPublicState {
  phase: WordHeadPhase;
  players: WordHeadPublicPlayer[];
  turnOrder: string[];
  currentTurnUserId: string | null;
  turnEndsAt: number | null;
  pendingPoll: WordHeadAnswerPoll | null;
  log: WordHeadLogEntry[];
  roundEndsAt: number | null;
  wordCategory: string | null;
  result: WordHeadResult | null;
}

// Only ever holds THIS browser's own view - every other player's word, and
// this player's own private notes. Never this player's own word - that's
// the whole game.
export interface WordHeadPrivateState {
  wordsByUserId: Record<string, string>;
  notes: string;
}

export const WORDHEAD_ACTIONS = {
  ASK_QUESTION: "wordhead:askQuestion",
  ANSWER_QUESTION: "wordhead:answerQuestion",
  GUESS: "wordhead:guess",
  PASS_TURN: "wordhead:passTurn",
  UPDATE_NOTES: "wordhead:updateNotes",
} as const;
