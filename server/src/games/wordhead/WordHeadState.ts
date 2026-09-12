// Hot-seat design: one player at a time is "up" - a word is picked for
// them that only they can't see, everyone else in the room can see it and
// help by pressing the hint button (their own text is optional - an
// in-person group can just say hints out loud). The up player keeps
// guessing until they get it right (or gives up) - a stopwatch tracks how
// long it took them, which is the whole scoring system now (see
// WordHeadResult.scores - lower is better, unlike every other game's
// points-where-more-is-better convention; GameResult.tsx and
// ScoreboardService both need to know this is a wordhead result to invert
// their usual "highest wins" assumption).
export type WordHeadPhase = "TURN" | "FINISHED";

export interface WordHeadPublicPlayer {
  userId: string;
  username: string;
  connected: boolean;
  // Undefined/false until this player has taken their turn.
  hasGone: boolean;
  guessedCorrectly: boolean;
  // Seconds taken, once hasGone is true - null if they gave up before
  // guessing correctly (see PASS_TURN).
  timeUsedSeconds: number | null;
}

export type WordHeadLogEntryType = "hint" | "guess" | "system";

export interface WordHeadLogEntry {
  id: string;
  type: WordHeadLogEntryType;
  userId: string | null; // hinter/guesser userId - null for a system message
  username: string | null;
  // Hint text (may be null - in-person players can just say it out loud),
  // the guessed word, or a system message body.
  text: string | null;
  // Unused for "guess" entries now that correctness is always decided by
  // another player pressing ตอบถูก/ตอบผิด (see PendingGuess below) rather
  // than an automatic text match - kept optional so old entries/clients
  // that still set it don't break.
  guessCorrect?: boolean;
  timestamp: number;
}

// A typed or spoken answer awaiting all other players. Its id binds votes to this attempt.
export interface WordHeadPendingGuess {
  id: string;
  text: string;
  submittedAt: number;
}

// Each non-guesser votes once. Wait for all votes, then use a strict majority.
// A tie rejects the attempt and lets the same player guess again.
export type WordHeadGuessVotes = Record<string, "correct" | "wrong">;

export interface WordHeadResult {
  summary: string;
  // userId -> seconds taken (LOWER is better - see the file-level note
  // above). A player who gave up before guessing gets their elapsed time
  // up to that point, same as anyone else - see WordHeadGame.handlePassTurn.
  scores: Record<string, number>;
  // userIds who genuinely guessed correctly, as opposed to giving up (a
  // give-up still gets a score entry - see PASS_TURN - but isn't in here).
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
  // When the current player's turn started - null once finished. The
  // client derives "elapsed so far" itself (Date.now() - this), same
  // pattern as Timer's countdown but counting up with no end.
  turnStartedAt: number | null;
  log: WordHeadLogEntry[];
  wordCategory: string | null;
  result: WordHeadResult | null;
  // A submitted answer currently awaiting every other player's judgment -
  // null when nobody's up player has an unjudged typed guess out. The
  // client uses this to pop up a judging prompt for everyone except the
  // guesser themselves.
  pendingGuess: WordHeadPendingGuess | null;
  // Votes for this attempt; cleared only after all votes resolve or the game ends.
  guessVotes: WordHeadGuessVotes;
}

// Only ever holds THIS browser's own view.
export interface WordHeadPrivateState {
  // The current hot-seat player's word - present for everyone EXCEPT that
  // player themselves (and null once the round is finished). That's the
  // whole game, so getPrivateState must never let the up player see this
  // when it's their own turn.
  currentWord: string | null;
  // This viewer's own hint-button cooldown, or null if they can press it
  // right now. Never another player's cooldown - nobody else's UI needs it.
  hintCooldownEndsAt: number | null;
  notes: string;
}

export const WORDHEAD_ACTIONS = {
  HINT: "wordhead:hint",
  GUESS: "wordhead:guess",
  ANSWER: "wordhead:answer",
  PASS_TURN: "wordhead:passTurn",
  UPDATE_NOTES: "wordhead:updateNotes",
  // Pressed by anyone EXCEPT the current up player to judge whether the up
  // player's answer (typed as a pending guess, or just said out loud) is
  // right - this is now the ONLY way a turn is scored as correct, there's
  // no more automatic text-matching. See WordHeadGame's handleMarkCorrect.
  MARK_CORRECT: "wordhead:markCorrect",
  // Same as above but for "not right yet" - doesn't end the turn or cost
  // anything, the stopwatch just keeps running and the up player keeps
  // guessing.
  MARK_WRONG: "wordhead:markWrong",
} as const;

export interface HintPayload {
  hintText?: string | null;
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
