export type SpyfallPhase = "IN_PROGRESS" | "VOTING" | "FINISHED";

export interface SpyfallPublicPlayer {
  userId: string;
  username: string;
  hasVoted: boolean;
  connected: boolean;
}

export interface SpyfallLogEntry {
  id: string;
  type: "question" | "answer" | "system";
  fromUserId?: string;
  fromUsername?: string;
  toUserId?: string;
  toUsername?: string;
  text: string;
  timestamp: number;
}

export interface SpyfallVoteTally {
  targetUserId: string;
  targetUsername: string;
  count: number;
}

export interface SpyfallRevealedVote {
  voterUserId: string;
  voterUsername: string;
  targetUserId: string;
  targetUsername: string;
}

export interface SpyfallResult {
  winner: "SPY" | "NON_SPY";
  reason: string;
  spyUserId: string;
  spyUsername: string;
  location: string;
  voteTally?: SpyfallVoteTally[];
  votes?: SpyfallRevealedVote[];
  // The location the Spy actually picked from the popup at guess time (set
  // only when the round ended via a guess, not a vote/timeout), and whether
  // it matched - the server checks this itself now, no more honor system.
  spyGuessedLocation?: string;
  spyGuessCorrect?: boolean;
  // Points earned this round, userId -> points. Spy escaping (not guessing)
  // = 1pt, Spy guessing the location correctly = 3pt, each non-Spy player
  // whose own vote correctly named the Spy = 1pt. Rolled up across rounds
  // by ScoreboardService for the match-wide score table.
  scores: Record<string, number>;
}

export interface SpyfallPublicState {
  phase: SpyfallPhase;
  timerDurationSeconds: number;
  timerEndsAt: number | null;
  players: SpyfallPublicPlayer[];
  log: SpyfallLogEntry[];
  result: SpyfallResult | null;
  // Call-to-vote progress: how many players have asked to open the voting
  // screen, and how many are required (everyone - unanimous) before it
  // opens. (The Spy has a separate unilateral bypass that skips this
  // requirement entirely - see SpyfallGame.handleCallVote.)
  voteCallers: string[];
  requiredVoteCallers: number;
}

// Only ever holds THIS browser's own player - never another player's role.
export interface SpyfallPrivateState {
  isSpy: boolean;
  location: string | null;
  role: string | null;
  // The full location deck, sent only to the Spy - the reference list they
  // use to cross off options during discussion and to pick their final
  // answer from. Always null for non-Spy players (they already know the
  // real location via `location` above).
  locationOptions: string[] | null;
}

// Action type strings used as the `actionType` field of the generic
// `game:action` socket event. This is the "namespace pattern" the spec
// calls for: the socket layer forwards these opaquely to whatever game is
// active without knowing what they mean, so no Spyfall logic leaks into
// the generic room/socket systems.
export const SPYFALL_ACTIONS = {
  QUESTION: "spyfall:question",
  ANSWER: "spyfall:answer",
  CALL_VOTE: "spyfall:callVote",
  VOTE: "spyfall:vote",
  GUESS: "spyfall:guess",
} as const;

export interface SpyfallQuestionPayload {
  toUserId: string;
  text: string;
}

export interface SpyfallAnswerPayload {
  text: string;
}

export interface SpyfallVotePayload {
  targetUserId: string;
}

// The Spy's final answer - one location name picked from the popup built
// off SpyfallPrivateState.locationOptions. The server checks it against
// the real location itself (see SpyfallGame.handleGuess).
export interface SpyfallGuessPayload {
  location: string;
}
