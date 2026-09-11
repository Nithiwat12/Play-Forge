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
  // Why the round is currently REVEALED - "SURRENDER" if the Spy gave up
  // voluntarily, or "VOTE_ESCAPED" if the group's accusation vote just
  // finished without catching the Spy and this is their one bonus chance
  // to guess for 3pt instead of the usual 1pt escape (a timeout here is
  // NOT a loss, unlike SURRENDER). Null outside REVEALED.
  revealedReason: "SURRENDER" | "VOTE_ESCAPED" | null;
  // Set only during a tie-extension "debate round" - the userIds who tied
  // for the most votes last time, and the only legal accusation targets
  // until the round resolves. Null the rest of the time.
  debateCandidateIds: string[] | null;
  // Whose turn it is to pick someone to ask (see SpyfallGame.tsx's
  // AskTargetModal) - a strict relay: one random player starts, picks a
  // target, that target answers and becomes the new asker, and so on.
  // Null once the round leaves IN_PROGRESS.
  askerUserId: string | null;
  // Set the instant askerUserId picks a target - only that target may
  // answer while this is set, and the asker can't pick anyone new until
  // it's cleared (by that target answering, which also hands them the
  // asker turn next).
  pendingQuestion: { toUserId: string; toUsername: string; askedAt: number } | null;
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
