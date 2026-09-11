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

// A typed guess waiting for someone other than the guesser to judge it -
// see WordHeadGame's MARK_CORRECT/MARK_WRONG handlers. Cleared as soon as
// it's judged (or a new typed guess replaces it, or the turn moves on).
// Everyone in the room can see this (there's nothing secret about a guess
// the up player already typed themselves) so the client can pop up a
// judging prompt for every other player the moment it appears.
export interface WordHeadPendingGuess {
  text: string;
  submittedAt: number;
}

// One entry per player who has cast a ถูก/ผิด vote on the up player's
// CURRENT answer attempt (whichever is more recent: a typed pendingGuess,
// or just something they said out loud - both use the same tally). Voting
// requires unanimous "correct" from everyone eligible (see
// WordHeadGame.eligibleVoterIds) to actually win the turn; a single
// "wrong" vote fails the attempt immediately and clears this map, rather
// than waiting for everyone else to also vote wrong.
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
  // A typed guess currently awaiting another player's ถูก/ผิด judgment -
  // null when nobody's up player has an unjudged typed guess out. The
  // client uses this to pop up a judging prompt for everyone except the
  // guesser themselves.
  pendingGuess: WordHeadPendingGuess | null;
  // Votes cast so far on the current answer attempt - see
  // WordHeadGuessVotes. Reset (to {}) at the start of every turn, whenever
  // a fresh typed guess replaces pendingGuess, and immediately after any
  // single "wrong" vote or after unanimous "correct" resolves the turn.
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
