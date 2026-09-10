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
  // The Spy's own honest self-report of whether their spoken guess (made
  // out loud to the other players, in person) was correct - the app never
  // sees or validates the actual guessed location text.
  spyGuessCorrect?: boolean;
}

export interface SpyfallPublicState {
  phase: SpyfallPhase;
  timerDurationSeconds: number;
  timerEndsAt: number | null;
  players: SpyfallPublicPlayer[];
  log: SpyfallLogEntry[];
  result: SpyfallResult | null;
  // Call-to-vote progress: how many players have asked to open the voting
  // screen, and how many are required (a simple majority) before it opens.
  voteCallers: string[];
  requiredVoteCallers: number;
}

// Only ever holds THIS browser's own player - never another player's role.
export interface SpyfallPrivateState {
  isSpy: boolean;
  location: string | null;
  role: string | null;
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

// The Spy self-reports whether their spoken guess was correct - see
// SpyfallResult.spyGuessCorrect above for why there's no location text here.
export interface SpyfallGuessPayload {
  correct: boolean;
}
