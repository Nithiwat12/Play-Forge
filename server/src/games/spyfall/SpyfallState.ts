// REVEALED: the Spy chose to "surrender" (see SPYFALL_ACTIONS.SURRENDER) -
// they're outed to everyone immediately and get a dedicated answer window,
// with no group voting involved at all. Distinct from VOTING, where nobody
// knows who the Spy is yet and the group is accusing someone.
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

// A live "someone wants to open the accusation vote?" poll. Individual
// choices stay secret (a secret ballot, like the room-level continue-play
// poll) - only the running tally is public, plus who has responded at all
// (not what they said) so each client can tell whether it still owes a
// response.
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
  // currently requested one - null the rest of the time. Majority accept
  // opens VOTING; majority decline (or a timeout with no majority either
  // way) keeps discussion going and starts voteCallCooldownUntil.
  votePoll: SpyfallVoteCallPoll | null;
  // Nobody may request a new call-vote poll before this timestamp - set
  // after a poll fails to reach a majority "yes". Null when no cooldown is
  // active.
  voteCallCooldownUntil: number | null;
  // Set only once the Spy has "surrendered" (see SPYFALL_ACTIONS.SURRENDER) -
  // null the rest of the time, including all of IN_PROGRESS/VOTING. Once
  // set it stays set (through REVEALED and into FINISHED) so the reveal
  // banner and result screen can both read it the same way.
  revealedSpyUserId: string | null;
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
  // Requests a fresh call-vote poll (see SpyfallVoteCallPoll). No payload -
  // the requester's own vote is recorded as an automatic "accept".
  CALL_VOTE: "spyfall:callVote",
  // Responds to the currently-open call-vote poll with accept/decline.
  VOTE_CALL_RESPONSE: "spyfall:voteCallResponse",
  VOTE: "spyfall:vote",
  GUESS: "spyfall:guess",
  // The Spy's "surrender / go straight to answering" action - only the Spy
  // may send it, and only during IN_PROGRESS. No payload.
  SURRENDER: "spyfall:surrender",
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

export interface SpyfallVoteCallResponsePayload {
  accept: boolean;
}

// The Spy's final answer - one location name picked from the popup built
// off SpyfallPrivateState.locationOptions. The server checks it against
// the real location itself (see SpyfallGame.handleGuess).
export interface SpyfallGuessPayload {
  location: string;
}
