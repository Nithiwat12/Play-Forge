// REVEALED: the Spy "surrendered" - outed to everyone immediately, with a
// dedicated answer window and no group voting involved at all.
export type SpyfallPhase = "IN_PROGRESS" | "VOTING" | "REVEALED" | "FINISHED";

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
  spyGuessedLocation?: string;
  spyGuessCorrect?: boolean;
  scores: Record<string, number>;
}

// A live "open the accusation vote?" poll. Individual choices stay a
// secret ballot - only the running tally, plus who has already responded
// (not what they said), are public.
export interface SpyfallVoteCallPoll {
  deadline: number;
  votesFor: number;
  votesAgainst: number;
  totalPlayers: number;
  responderIds: string[];
}

export interface SpyfallPublicState {
  phase: SpyfallPhase;
  timerDurationSeconds: number;
  timerEndsAt: number | null;
  players: SpyfallPublicPlayer[];
  log: SpyfallLogEntry[];
  result: SpyfallResult | null;
  // The in-progress "open the accusation vote?" poll, if anyone has
  // currently requested one - null the rest of the time.
  votePoll: SpyfallVoteCallPoll | null;
  // Nobody may request a new call-vote poll before this timestamp - null
  // when no cooldown is active.
  voteCallCooldownUntil: number | null;
  // Set once the Spy has surrendered - null the rest of the time.
  revealedSpyUserId: string | null;
}

// Only ever holds THIS browser's own player - never another player's role.
export interface SpyfallPrivateState {
  isSpy: boolean;
  location: string | null;
  role: string | null;
  // Full location deck, sent only to the Spy - used for the elimination
  // checklist and the final-answer popup. Null for everyone else.
  locationOptions: string[] | null;
}

export const SPYFALL_ACTIONS = {
  QUESTION: "spyfall:question",
  ANSWER: "spyfall:answer",
  CALL_VOTE: "spyfall:callVote",
  VOTE_CALL_RESPONSE: "spyfall:voteCallResponse",
  VOTE: "spyfall:vote",
  GUESS: "spyfall:guess",
  SURRENDER: "spyfall:surrender",
} as const;
