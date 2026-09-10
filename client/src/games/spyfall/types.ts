export type SpyfallPhase = "IN_PROGRESS" | "VOTING" | "FINISHED";

export interface SpyfallPublicPlayer {
  userId: string;
  username: string;
  hasVoted: boolean;
  connected: boolean;
}

export interface SpyfallLogEntry {
  id: string;
  type: "question" | "answer";
  fromUserId: string;
  fromUsername: string;
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
  spyGuess?: string;
}

export interface SpyfallPublicState {
  phase: SpyfallPhase;
  timerDurationSeconds: number;
  timerEndsAt: number | null;
  players: SpyfallPublicPlayer[];
  log: SpyfallLogEntry[];
  result: SpyfallResult | null;
}

// Only ever holds THIS browser's own player - never another player's role.
export interface SpyfallPrivateState {
  isSpy: boolean;
  location: string | null;
  role: string | null;
}

export const SPYFALL_ACTIONS = {
  QUESTION: "spyfall:question",
  ANSWER: "spyfall:answer",
  VOTE: "spyfall:vote",
  GUESS: "spyfall:guess",
} as const;
