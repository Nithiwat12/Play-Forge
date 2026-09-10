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

// Never broadcast to anyone but the owning player - this is the whole
// point of Spyfall. A normal player gets {isSpy:false, location, role};
// the spy gets {isSpy:true, location:null, role:null}.
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

export interface SpyfallGuessPayload {
  location: string;
}
