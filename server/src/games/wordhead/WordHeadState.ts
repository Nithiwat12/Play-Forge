export type WordHeadPhase = "TURN" | "ANSWER_WINDOW" | "FINISHED";

export interface WordHeadPublicPlayer {
  userId: string;
  username: string;
  connected: boolean;
  guessedCorrectly: boolean;
  questionsUsed: number;
  score: number;
}

export type WordHeadLogEntryType = "question" | "guess" | "system";

export interface WordHeadLogEntry {
  id: string;
  type: WordHeadLogEntryType;
  userId: string | null; // asker/guesser userId - null for a system message
  username: string | null;
  // Question text (may be null - in-person players can just ask out loud),
  // the guessed word, or a system message body.
  text: string | null;
  // Present once a "question" entry's answer window has resolved.
  answer?: "YES" | "NO" | "UNSURE";
  // Present only on a "guess" entry.
  guessCorrect?: boolean;
  timestamp: number;
}

// Fully public - the whole point of the answer window is that every vote is
// visible to everyone, including the asker, who is trying to work out their
// own word from the pattern of yes/no/unsure answers. No secret-ballot logic
// needed here, unlike Spyfall's accusation vote.
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

export interface WordHeadPrivateState {
  // Every player's word EXCEPT the caller's own - that IS the whole game,
  // so getPrivateState must never let userId's own key leak through here.
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

export interface AskQuestionPayload {
  questionText?: string | null;
}

export interface AnswerQuestionPayload {
  vote: "YES" | "NO" | "UNSURE";
}

export interface GuessPayload {
  guessText: string;
}

export interface UpdateNotesPayload {
  notes: string;
}

// Per-room, host-chosen config (mirrors SpyfallConfig's shape) - see
// RoomService / CreateRoom. PER_ROUND category selection is intentionally
// not supported yet (see gameSocket's Spyfall-specific locationCategory
// coupling in the continue-vote layer) - only RANDOM and FIXED.
export interface WordHeadConfig {
  categoryMode?: "RANDOM" | "FIXED";
  category?: string;
}
