import { randomUUID } from "crypto";
import { BaseGame } from "../core/BaseGame";
import { GAME_ENGINE_EVENTS, GameActionError, type GameResult } from "../core/types";
import { SPYFALL_LOCATIONS, type SpyfallLocation } from "./locations";
import { assignRoles, shuffle } from "./roles";
import {
  SPYFALL_ACTIONS,
  type SpyfallLogEntry,
  type SpyfallPhase,
  type SpyfallPublicState,
  type SpyfallPrivateState,
  type SpyfallResult,
  type SpyfallRevealedVote,
  type SpyfallVoteCallPoll,
} from "./SpyfallState";
import {
  SPYFALL_MIN_PLAYERS,
  SPYFALL_MAX_PLAYERS,
  SPYFALL_TIMER_SECONDS,
  SPYFALL_MAX_TEXT_LENGTH,
  SPYFALL_TIE_EXTENSION_SECONDS,
  SPYFALL_MAX_TIE_EXTENSIONS,
  SPYFALL_VOTING_SECONDS,
  SPYFALL_CALL_VOTE_POLL_SECONDS,
  SPYFALL_CALL_VOTE_COOLDOWN_SECONDS,
  validateQuestionPayload,
  validateAnswerPayload,
  validateVotePayload,
  validateGuessPayload,
  validateVoteCallResponsePayload,
  tallyVotes,
  resolveMajority,
  requiredPollMajority,
} from "./SpyfallRules";

// A live "open the accusation vote?" poll - tracked internally as the full
// per-user ballot (needed to compute the majority), while getPublicState
// only ever exposes the aggregate shape (SpyfallVoteCallPoll).
interface VoteCallPollState {
  votes: Map<string, boolean>; // userId -> accept/decline
  timeout: NodeJS.Timeout;
  deadline: number;
}

const MAX_LOG_ENTRIES = 200;
const MIN_DISCUSSION_SECONDS = 3 * 60;
const MAX_DISCUSSION_SECONDS = 20 * 60;

// Per-room, host-chosen config (set at room creation, see RoomService /
// CreateRoom page). Everything here is optional - a room with no settings
// gets the classic defaults.
export interface SpyfallConfig {
  discussionSeconds?: number;
}

/**
 * Spyfall engine. Owns all Spyfall-specific state and rules; the platform
 * (Room System, Socket System, GameManager) only ever sees this through
 * the BaseGame contract.
 */
export class SpyfallGame extends BaseGame<SpyfallPublicState, SpyfallPrivateState> {
  readonly slug = "spyfall";

  private config: SpyfallConfig;
  private location: SpyfallLocation | null = null;
  private spyUserId: string | null = null;
  private roleAssignment: Map<string, string> = new Map();
  private log: SpyfallLogEntry[] = [];
  private votes: Map<string, string> = new Map(); // voterUserId -> targetUserId
  // The currently-open "shall we open the accusation vote?" poll, if any -
  // see handleCallVote/handleVoteCallResponse/resolveVotePoll.
  private votePoll: VoteCallPollState | null = null;
  // Set after a poll fails to reach a majority "yes" - blocks a new
  // handleCallVote request until this timestamp passes.
  private voteCallCooldownUntil: number | null = null;
  private tieExtensionsUsed = 0;
  // Set only during a tie-extension "debate round" (see resolveByVotes) -
  // narrows who can legally be accused to just the players who tied for
  // the most votes last time, instead of the whole roster. Null the rest
  // of the time (including the very first, non-extended vote).
  private debateCandidateIds: Set<string> | null = null;
  private disconnected: Set<string> = new Set();
  private phase: SpyfallPhase = "IN_PROGRESS";
  // Set once the Spy surrenders (see handleSurrender) and never unset -
  // this is what getPublicState uses to decide whether to expose spyUserId
  // early, before the round actually concludes.
  private revealed = false;
  private result: SpyfallResult | null = null;
  private discussionSeconds: number = SPYFALL_TIMER_SECONDS;
  private timerEndsAt: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(roomId: string, config?: SpyfallConfig) {
    super(roomId);
    this.config = config ?? {};
  }

  start(): void {
    if (this.players.size < SPYFALL_MIN_PLAYERS) {
      throw new Error(`Spy Hunt ต้องมีผู้เล่นอย่างน้อย ${SPYFALL_MIN_PLAYERS} คน`);
    }
    if (this.players.size > SPYFALL_MAX_PLAYERS) {
      throw new Error(`Spy Hunt รองรับผู้เล่นได้สูงสุด ${SPYFALL_MAX_PLAYERS} คน`);
    }

    this.discussionSeconds = this.resolveDiscussionSeconds();
    this.location = shuffle(SPYFALL_LOCATIONS)[0];

    const playerIds = this.getPlayers().map((p) => p.userId);
    this.spyUserId = playerIds[Math.floor(Math.random() * playerIds.length)];
    const nonSpyIds = playerIds.filter((id) => id !== this.spyUserId);
    this.roleAssignment = assignRoles(this.location, nonSpyIds);

    this.phase = "IN_PROGRESS";
    this.started = true;
    this.beginTimer(this.discussionSeconds);

    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  private resolveDiscussionSeconds(): number {
    const configured = this.config.discussionSeconds;
    if (typeof configured !== "number" || !Number.isFinite(configured)) {
      return SPYFALL_TIMER_SECONDS;
    }
    return Math.min(MAX_DISCUSSION_SECONDS, Math.max(MIN_DISCUSSION_SECONDS, Math.round(configured)));
  }

  private beginTimer(seconds: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timerEndsAt = Date.now() + seconds * 1000;
    this.timer = setTimeout(() => this.forceEndByTimer(), seconds * 1000);
  }

  // Players who leave mid-round keep their role/spy assignment intact
  // (win conditions still need to reference them) - we just mark them
  // disconnected instead of deleting them from the roster.
  removePlayer(userId: string): void {
    if (!this.started) {
      super.removePlayer(userId);
      return;
    }
    this.disconnected.add(userId);
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  reconnectPlayer(userId: string): void {
    super.reconnectPlayer(userId);
    if (this.disconnected.delete(userId)) this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  handleAction(userId: string, actionType: string, payload: unknown): void {
    if (!this.players.has(userId)) {
      throw new GameActionError("คุณไม่ได้อยู่ในเกมนี้");
    }
    if (this.finished) {
      throw new GameActionError("เกมนี้จบไปแล้ว");
    }

    switch (actionType) {
      case SPYFALL_ACTIONS.QUESTION:
        this.handleQuestion(userId, validateQuestionPayload(payload));
        break;
      case SPYFALL_ACTIONS.ANSWER:
        this.handleAnswer(userId, validateAnswerPayload(payload));
        break;
      case SPYFALL_ACTIONS.CALL_VOTE:
        this.handleCallVote(userId);
        break;
      case SPYFALL_ACTIONS.VOTE_CALL_RESPONSE:
        this.handleVoteCallResponse(userId, validateVoteCallResponsePayload(payload).accept);
        break;
      case SPYFALL_ACTIONS.VOTE:
        this.handleVote(userId, validateVotePayload(payload).targetUserId);
        break;
      case SPYFALL_ACTIONS.GUESS:
        this.handleGuess(userId, validateGuessPayload(payload).location);
        break;
      case SPYFALL_ACTIONS.SURRENDER:
        this.handleSurrender(userId);
        break;
      default:
        throw new GameActionError(`ไม่รู้จักการกระทำนี้: ${actionType}`);
    }
  }

  private handleQuestion(fromUserId: string, payload: { toUserId: string; text: string }): void {
    if (payload.toUserId === fromUserId) {
      throw new GameActionError("คุณถามตัวเองไม่ได้");
    }
    const target = this.players.get(payload.toUserId);
    if (!target) {
      throw new GameActionError("ผู้เล่นที่เลือกไม่ได้อยู่ในเกมนี้");
    }
    const from = this.players.get(fromUserId)!;

    this.appendLog({
      id: randomUUID(),
      type: "question",
      fromUserId,
      fromUsername: from.username,
      toUserId: target.userId,
      toUsername: target.username,
      text: payload.text.slice(0, SPYFALL_MAX_TEXT_LENGTH),
      timestamp: Date.now(),
    });
  }

  private handleAnswer(fromUserId: string, payload: { text: string }): void {
    const from = this.players.get(fromUserId)!;
    this.appendLog({
      id: randomUUID(),
      type: "answer",
      fromUserId,
      fromUsername: from.username,
      text: payload.text.slice(0, SPYFALL_MAX_TEXT_LENGTH),
      timestamp: Date.now(),
    });
  }

  // Anyone - the Spy included, with no special-casing - can request a call-
  // vote poll, which then asks the whole room to accept or decline (see
  // handleVoteCallResponse). The requester's own vote counts as an
  // automatic "accept". Blocked while a poll is already running, or during
  // the post-failure cooldown (see resolveVotePoll).
  private handleCallVote(userId: string): void {
    if (this.phase !== "IN_PROGRESS") {
      throw new GameActionError("ตอนนี้ไม่ได้อยู่ในช่วงพูดคุย เปิดโหวตไม่ได้");
    }
    if (this.votePoll) {
      throw new GameActionError("มีคนขอเปิดโหวตอยู่แล้ว รอผลก่อน");
    }
    if (this.voteCallCooldownUntil && Date.now() < this.voteCallCooldownUntil) {
      throw new GameActionError("เพิ่งขอเปิดโหวตไปแล้วแต่เสียงส่วนมากไม่เห็นด้วย ต้องรอสักครู่ก่อนขอใหม่");
    }

    const votes = new Map<string, boolean>([[userId, true]]);
    const deadline = Date.now() + SPYFALL_CALL_VOTE_POLL_SECONDS * 1000;
    const timeout = setTimeout(() => this.resolveVotePoll(), SPYFALL_CALL_VOTE_POLL_SECONDS * 1000);
    this.votePoll = { votes, timeout, deadline };

    const caller = this.players.get(userId)?.username ?? "ไม่ทราบชื่อ";
    this.appendSystemLog(`${caller} ขอเปิดโหวตหาสปาย! รอเสียงส่วนมากตอบรับ`); // also emits STATE_CHANGED
  }

  // Anyone currently in the round (the Spy included) can accept or decline
  // the open call-vote poll - resolves early the instant a majority is
  // reached either way, exactly like the room-level continue-play poll.
  private handleVoteCallResponse(userId: string, accept: boolean): void {
    if (!this.votePoll) {
      throw new GameActionError("ไม่มีการขอเปิดโหวตในขณะนี้");
    }
    this.votePoll.votes.set(userId, accept);

    let yes = 0;
    let no = 0;
    for (const v of this.votePoll.votes.values()) (v ? yes++ : no++);
    const required = requiredPollMajority(this.players.size);

    if (yes >= required) {
      this.resolveVotePoll(true);
    } else if (no >= required) {
      this.resolveVotePoll(false);
    } else if (this.votePoll.votes.size >= this.players.size) {
      // Defensive fallback only - with required set to "at least half"
      // (see requiredPollMajority), whichever side the last vote pushes
      // to totalPlayers/2 already triggers one of the two branches above
      // before everyone could possibly have answered, so this shouldn't
      // actually be reachable. Kept as a safety net rather than relying on
      // that invariant never changing.
      this.resolveVotePoll(yes > no);
    } else {
      this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
    }
  }

  // Ends the currently-open call-vote poll and acts on the outcome.
  // handleVoteCallResponse only ever calls this WITHOUT a forcedResult once
  // its own timeout fires - and by then a genuine majority was never
  // reached either way (a majority reached earlier always resolves right
  // there, with an explicit forcedResult). So a bare timeout here always
  // defaults to NOT opening, exactly as the poll UI promises ("ถ้าไม่ตอบ
  // ภายใน X วินาที จะถือว่าเล่นต่อ") - it must never fall back to comparing
  // partial yes/no counts, since the lone requester's own auto-accept vote
  // would then count as a "majority" all by itself the moment nobody else
  // responds in time.
  private resolveVotePoll(forcedResult?: boolean): void {
    if (!this.votePoll) return;
    clearTimeout(this.votePoll.timeout);

    const willOpen = forcedResult ?? false;
    this.votePoll = null;

    if (willOpen) {
      this.openVoting("เสียงส่วนมากเห็นด้วย! เปิดโหมดโหวตแล้ว เลือกผู้เล่นที่คุณคิดว่าเป็นสปาย");
    } else {
      this.voteCallCooldownUntil = Date.now() + SPYFALL_CALL_VOTE_COOLDOWN_SECONDS * 1000;
      this.appendSystemLog(
        `เสียงส่วนมากไม่เห็นด้วย เล่นต่อ! ขอเปิดโหวตใหม่ได้อีกครั้งใน ${SPYFALL_CALL_VOTE_COOLDOWN_SECONDS / 60} นาที`
      ); // also emits STATE_CHANGED
    }
  }

  // Cancels any in-flight call-vote poll without resolving it either way -
  // used whenever the round moves on to something else (voting opens some
  // other way, the Spy surrenders, or the round concludes) so a stray
  // timeout can never fire into a phase it no longer applies to.
  private clearVotePoll(): void {
    if (this.votePoll) {
      clearTimeout(this.votePoll.timeout);
      this.votePoll = null;
    }
  }

  // Replaces the discussion clock with a fresh SPYFALL_VOTING_SECONDS
  // countdown the moment voting opens - the same deadline serves both the
  // Spy (to submit their final answer) and the rest of the group (to
  // finish accusing someone; the Spy may also cast their own decoy vote
  // like anyone else - see handleVote). If it runs out before either
  // happens, forceEndByTimer resolves the round from whatever was
  // submitted so far, exactly like a discussion-phase timeout does.
  private openVoting(systemMessage: string): void {
    this.clearVotePoll();
    this.phase = "VOTING";
    this.beginTimer(SPYFALL_VOTING_SECONDS);
    this.appendSystemLog(systemMessage); // also emits STATE_CHANGED
  }

  // Anyone currently in the round can cast (or freely change - re-voting
  // just overwrites the previous target, no cooldown of any kind here)
  // an accusation vote. The Spy can vote too, typically as a decoy since
  // they already know who they are - and their vote is required for the
  // round to auto-resolve just like everyone else's, so the round never
  // ends without genuinely giving the Spy a chance to have voted (the only
  // way it ends without that is the SPYFALL_VOTING_SECONDS clock running
  // out - see forceEndByTimer).
  private handleVote(voterId: string, targetUserId: string): void {
    if (this.phase !== "VOTING") {
      throw new GameActionError("ต้องเปิดโหมดโหวตก่อนถึงจะโหวตได้ - กด \"ขอเปิดโหวต\" ก่อน");
    }
    if (targetUserId === voterId) {
      throw new GameActionError("คุณโหวตตัวเองไม่ได้");
    }
    if (!this.players.has(targetUserId)) {
      throw new GameActionError("ผู้เล่นที่จะโหวตไม่ได้อยู่ในเกมนี้");
    }
    // During a tie-extension "debate round", only the players who tied for
    // the most votes last time are legal targets - everyone else has
    // already been cleared.
    if (this.debateCandidateIds && !this.debateCandidateIds.has(targetUserId)) {
      throw new GameActionError("รอบนี้เป็นรอบดีเบท โหวตได้เฉพาะคนที่คะแนนเท่ากันเท่านั้น");
    }

    this.votes.set(voterId, targetUserId);
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);

    if (this.votes.size >= this.players.size || this.hasLockedInMajority()) {
      this.resolveByVotes("เสียงส่วนมากโหวตครบแล้ว");
    }
  }

  // True once a single target already holds strictly more than half of all
  // players' votes - at that point no combination of however anyone still
  // undecided ends up voting could change who has the most votes, so
  // there's no reason to keep the round open waiting for full turnout.
  private hasLockedInMajority(): boolean {
    const counts = new Map<string, number>();
    for (const targetUserId of this.votes.values()) {
      counts.set(targetUserId, (counts.get(targetUserId) ?? 0) + 1);
    }
    const required = requiredPollMajority(this.players.size);
    for (const count of counts.values()) {
      if (count >= required) return true;
    }
    return false;
  }

  // The Spy's own "surrender" - a separate, Spy-only escape hatch from the
  // shared call-vote poll. Pressing it immediately outs them to the whole
  // table (no more hiding) but hands them an uncontested
  // SPYFALL_VOTING_SECONDS window to answer alone, instead of sharing the
  // clock with a group vote. There's no going back to IN_PROGRESS from
  // here, and no group vote happens at all in this path - see handleGuess
  // and resolveRevealedTimeout for how REVEALED always resolves.
  private handleSurrender(userId: string): void {
    if (userId !== this.spyUserId) {
      throw new GameActionError("เฉพาะสปายเท่านั้นที่กดปุ่มนี้ได้");
    }
    if (this.phase !== "IN_PROGRESS") {
      throw new GameActionError("ใช้ปุ่มนี้ได้เฉพาะตอนพูดคุยเท่านั้น");
    }

    this.clearVotePoll();
    this.revealed = true;
    this.phase = "REVEALED";
    this.beginTimer(SPYFALL_VOTING_SECONDS);
    const spyUsername = this.players.get(userId)?.username ?? "ไม่ทราบชื่อ";
    this.appendSystemLog(
      `${spyUsername} เปิดเผยตัวว่าเป็นสปาย! ขอเวลา ${SPYFALL_VOTING_SECONDS / 60} นาทีในการทายสถานที่`
    ); // also emits STATE_CHANGED
  }

  // The Spy picks their final answer from the real location list - the
  // server itself checks it against the actual location, so there's no
  // more honor-system self-report of "correct/wrong". Reachable from either
  // VOTING (answering alongside the group's accusation vote) or REVEALED
  // (answering alone, having already surrendered).
  private handleGuess(userId: string, guessedLocation: string): void {
    if (userId !== this.spyUserId) {
      throw new GameActionError("เฉพาะสปายเท่านั้นที่ตอบได้");
    }
    if (this.phase !== "VOTING" && this.phase !== "REVEALED") {
      throw new GameActionError(
        "ต้องเปิดโหมดโหวต หรือกดยอมแพ้ขอทายก่อนถึงจะตอบได้"
      );
    }

    const correct = guessedLocation === this.location!.name;
    this.conclude({
      winner: correct ? "SPY" : "NON_SPY",
      reason: correct
        ? `สปายทายสถานที่ถูกต้อง! คำตอบคือ "${guessedLocation}"`
        : `สปายทายผิด! ทายว่า "${guessedLocation}" แต่สถานที่จริงคือ "${this.location!.name}"`,
      spyUserId: this.spyUserId!,
      spyUsername: this.players.get(this.spyUserId!)?.username ?? "ไม่ทราบชื่อ",
      location: this.location!.name,
      spyGuessedLocation: guessedLocation,
      spyGuessCorrect: correct,
    });
  }

  // Fires from whichever timer is currently running - the discussion
  // clock, a tie-extension, the voting/answer deadline, or the Spy's own
  // post-surrender answer window - so the reason text (and resolution path)
  // matches whatever phase was actually active when it expired.
  private forceEndByTimer(): void {
    if (this.finished) return;
    if (this.phase === "REVEALED") {
      this.resolveRevealedTimeout();
      return;
    }
    this.resolveByVotes(this.phase === "VOTING" ? "หมดเวลาโหวต/ตอบ!" : "หมดเวลาแล้ว");
  }

  // The Spy surrendered (outing themselves) but never actually submitted an
  // answer within their window. Unlike a discussion/voting timeout - where
  // an unaccused Spy quietly escapes by default - here everyone already
  // knows who they are, so failing to answer in time is a straightforward
  // loss for the Spy rather than an escape.
  private resolveRevealedTimeout(): void {
    const spyUsername = this.players.get(this.spyUserId!)?.username ?? "ไม่ทราบชื่อ";
    this.conclude({
      winner: "NON_SPY",
      reason: `หมดเวลาทาย! ${spyUsername} เปิดเผยตัวไปแล้วแต่ทายไม่ทันเวลา`,
      spyUserId: this.spyUserId!,
      spyUsername,
      location: this.location!.name,
    });
  }

  private resolveByVotes(reasonPrefix: string): void {
    const usernameByUserId = new Map(this.getPlayers().map((p) => [p.userId, p.username]));
    const tally = tallyVotes(this.votes, usernameByUserId);
    const majority = resolveMajority(tally);

    // A genuine tie among 2+ people (not simply "nobody voted") gives the
    // group a second chance instead of letting the Spy escape by default -
    // a "debate round" narrowed to just the tied suspects (see
    // debateCandidateIds and handleVote), announced with a popup client-side
    // (see SpyfallPublicState.debateCandidateIds) rather than only a log line.
    if (majority === null && this.votes.size > 0 && this.tieExtensionsUsed < SPYFALL_MAX_TIE_EXTENSIONS) {
      this.tieExtensionsUsed += 1;
      const topCount = tally[0].count;
      const tiedCandidates = tally.filter((t) => t.count === topCount);
      this.debateCandidateIds = new Set(tiedCandidates.map((t) => t.targetUserId));
      this.votes.clear();
      this.phase = "IN_PROGRESS";
      this.beginTimer(SPYFALL_TIE_EXTENSION_SECONDS);
      const tiedNames = tiedCandidates.map((t) => t.targetUsername).join(", ");
      this.appendSystemLog(
        `โหวตเสมอกันระหว่าง ${tiedNames}! เข้าสู่รอบดีเบท ต่อเวลาพิเศษให้อีก ${SPYFALL_TIE_EXTENSION_SECONDS / 60} นาที`
      );
      return;
    }

    const spyCaught = majority !== null && majority === this.spyUserId;

    const votes: SpyfallRevealedVote[] = Array.from(this.votes.entries()).map(
      ([voterUserId, targetUserId]) => ({
        voterUserId,
        voterUsername: usernameByUserId.get(voterUserId) ?? "ไม่ทราบชื่อ",
        targetUserId,
        targetUsername: usernameByUserId.get(targetUserId) ?? "ไม่ทราบชื่อ",
      })
    );

    let reason: string;
    if (this.votes.size === 0) {
      reason = `${reasonPrefix} ไม่มีใครโหวตเลย สปายจึงรอดตัวไป`;
    } else if (majority === null) {
      reason = `${reasonPrefix} โหวตเสมอกัน สปายจึงรอดตัวไป`;
    } else if (spyCaught) {
      reason = `${reasonPrefix} กลุ่มโหวตถูกคน! ${usernameByUserId.get(majority)} คือสปาย`;
    } else {
      reason = `${reasonPrefix} กลุ่มโหวตผิดคน ${usernameByUserId.get(majority)} ไม่ใช่สปาย`;
    }

    this.conclude({
      winner: spyCaught ? "NON_SPY" : "SPY",
      reason,
      spyUserId: this.spyUserId!,
      spyUsername: usernameByUserId.get(this.spyUserId!) ?? "ไม่ทราบชื่อ",
      location: this.location!.name,
      voteTally: tally,
      votes,
    });
  }

  private conclude(result: Omit<SpyfallResult, "scores">): void {
    this.clearVotePoll();
    this.debateCandidateIds = null;
    this.result = { ...result, scores: this.computeScores(result) };
    this.phase = "FINISHED";
    this.finished = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
    this.emit(GAME_ENGINE_EVENTS.ENDED);
  }

  // Scoring: the Spy escaping unnoticed (time runs out, a tie, or the group
  // votes the wrong person) is worth less than the Spy pulling off a
  // correct location guess, which takes real nerve. On the other side,
  // only the specific players whose own vote actually named the real Spy
  // get credit for the catch - not the whole non-Spy team by default.
  private computeScores(result: Omit<SpyfallResult, "scores">): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p.userId] = 0;
    }

    if (result.winner === "SPY") {
      const points = result.spyGuessCorrect ? 3 : 1;
      scores[result.spyUserId] = (scores[result.spyUserId] ?? 0) + points;
    } else {
      for (const vote of result.votes ?? []) {
        if (vote.targetUserId === result.spyUserId) {
          scores[vote.voterUserId] = (scores[vote.voterUserId] ?? 0) + 1;
        }
      }
    }

    return scores;
  }

  private appendLog(entry: SpyfallLogEntry): void {
    this.log.push(entry);
    if (this.log.length > MAX_LOG_ENTRIES) {
      this.log.splice(0, this.log.length - MAX_LOG_ENTRIES);
    }
    this.emit(GAME_ENGINE_EVENTS.STATE_CHANGED);
  }

  private appendSystemLog(text: string): void {
    this.appendLog({ id: randomUUID(), type: "system", text, timestamp: Date.now() });
  }

  getPublicState(): SpyfallPublicState {
    return {
      phase: this.phase,
      timerDurationSeconds:
        this.phase === "VOTING" || this.phase === "REVEALED" ? SPYFALL_VOTING_SECONDS : this.discussionSeconds,
      timerEndsAt: this.timerEndsAt,
      players: this.getPlayers().map((p) => ({
        userId: p.userId,
        username: p.username,
        hasVoted: this.votes.has(p.userId),
        connected: !this.disconnected.has(p.userId),
      })),
      log: this.log,
      result: this.finished ? this.result : null,
      votePoll: this.publicVotePoll(),
      voteCallCooldownUntil: this.voteCallCooldownUntil,
      revealedSpyUserId: this.revealed ? this.spyUserId : null,
      debateCandidateIds: this.debateCandidateIds ? Array.from(this.debateCandidateIds) : null,
    };
  }

  // Aggregate-only view of the internal poll ballot: who has responded is
  // public (so a client can tell whether it still owes a response), but
  // what any individual player chose stays a secret ballot - only the
  // running tally is exposed.
  private publicVotePoll(): SpyfallVoteCallPoll | null {
    if (!this.votePoll) return null;
    let votesFor = 0;
    let votesAgainst = 0;
    for (const v of this.votePoll.votes.values()) (v ? votesFor++ : votesAgainst++);
    return {
      deadline: this.votePoll.deadline,
      votesFor,
      votesAgainst,
      totalPlayers: this.players.size,
      responderIds: Array.from(this.votePoll.votes.keys()),
    };
  }

  getPrivateState(userId: string): SpyfallPrivateState {
    if (!this.location || !this.spyUserId) {
      return { isSpy: false, location: null, role: null, locationOptions: null };
    }
    if (userId === this.spyUserId) {
      // The Spy gets the full location list - same reference sheet the
      // physical game hands the spy - to cross options off as they listen,
      // and to pick their final answer from at guess time.
      return {
        isSpy: true,
        location: null,
        role: null,
        locationOptions: SPYFALL_LOCATIONS.map((l) => l.name),
      };
    }
    return {
      isSpy: false,
      location: this.location.name,
      role: this.roleAssignment.get(userId) ?? null,
      locationOptions: null,
    };
  }

  end(): GameResult {
    if (!this.result) {
      // Ended abnormally (e.g. host/room force-stop) before a natural
      // conclusion was reached - record it without declaring a winner.
      this.conclude({
        winner: "SPY",
        reason: "เกมถูกจบก่อนที่จะได้ผลลัพธ์",
        spyUserId: this.spyUserId ?? "unknown",
        spyUsername: this.spyUserId
          ? this.players.get(this.spyUserId)?.username ?? "ไม่ทราบชื่อ"
          : "ไม่ทราบชื่อ",
        location: this.location?.name ?? "ไม่ทราบชื่อ",
      });
    }

    const result = this.result!;
    const winnerUserIds =
      result.winner === "SPY"
        ? [result.spyUserId]
        : this.getPlayers().filter((p) => p.userId !== result.spyUserId).map((p) => p.userId);

    return {
      summary: result.reason,
      winnerUserIds,
      details: result as unknown as Record<string, unknown>,
    };
  }
}
