import { GameManager } from "../games/core/GameManager";
import { GAME_ENGINE_EVENTS } from "../games/core/types";
import type { BaseGame } from "../games/core/BaseGame";
import { RoomService } from "../services/RoomService";
import { GameSessionService } from "../services/GameSessionService";
import { ScoreboardService } from "../services/ScoreboardService";
import { withPresence } from "./socketUtils";
import type { AppServer, AppSocket } from "./socketAuth";

type Ack = (response: { ok: true } | { ok: false; error: string }) => void;
const noopAck: Ack = () => {};

interface ActiveSessionInfo {
  sessionId: string;
}

// roomId -> the GameSession row backing the currently active game, so the
// result can be persisted once the engine reports it has ended.
const activeSessions = new Map<string, ActiveSessionInfo>();

// --- Continue-vote system -------------------------------------------------
// Entirely game-agnostic: it only ever looks at Scoreboard.matchComplete
// and the generic room roster, never at any game-specific state, so it
// works the same way for Spyfall or any future game. When a round ends and
// the match isn't complete yet (either more configured rounds remain, or
// the room has no round limit at all), everyone gets asked whether to keep
// going; a majority "yes" auto-starts the next round after a short
// scoreboard-viewing delay (skippable by anyone), a majority "no" (or a
// tie, or nobody answering in time) sends the room back to its lobby.

const CONTINUE_VOTE_TIMEOUT_MS = 30_000;
const NEXT_ROUND_DELAY_MS = 15_000;

interface ContinuePoll {
  votes: Map<string, boolean>; // userId -> wantsContinue
  timeout: NodeJS.Timeout;
}
// roomId -> the in-progress "play again?" poll following a round that just ended.
const continuePolls = new Map<string, ContinuePoll>();

interface PendingRoundStart {
  timeout: NodeJS.Timeout;
  nextRoundAt: number;
}
// roomId -> the scheduled auto-start of the next round after a "yes" result,
// still pending its NEXT_ROUND_DELAY_MS scoreboard-viewing window (or an
// early skip).
const pendingRoundStarts = new Map<string, PendingRoundStart>();

/**
 * Pushes a fresh state snapshot to every socket currently in the room -
 * individually, because each player's private state differs. This is the
 * one place in the whole platform where "never broadcast every player's
 * role to every client" is enforced: getPrivateState(userId) is computed
 * per-socket and sent only to that socket.
 */
function broadcastGameState(io: AppServer, roomId: string, game: BaseGame) {
  const socketIds = io.sockets.adapter.rooms.get(roomId);
  if (!socketIds) return;

  const publicState = game.getPublicState();
  for (const socketId of socketIds) {
    const memberSocket = io.sockets.sockets.get(socketId);
    if (!memberSocket) continue;
    const privateState = game.getPrivateState(memberSocket.data.user.id);
    memberSocket.emit("game:state", { roomId, public: publicState, private: privateState });
  }
}

// Cancels any pending continue-vote poll or scheduled auto-start for a
// room, so a disbanded/aborted room can never have either fire later into
// a room that no longer exists (or has moved on to something else).
function clearContinueState(roomId: string): void {
  const poll = continuePolls.get(roomId);
  if (poll) {
    clearTimeout(poll.timeout);
    continuePolls.delete(roomId);
  }
  const pending = pendingRoundStarts.get(roomId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingRoundStarts.delete(roomId);
  }
}

export function abortRoomGame(roomId: string): void {
  activeSessions.delete(roomId);
  clearContinueState(roomId);
  GameManager.abortGame(roomId);
}

type StartableRoom = Awaited<ReturnType<typeof RoomService.getRoomById>>;

// Actually launches a round for an already-validated room - shared by the
// host-initiated "game:start" handler and the continue-vote system's
// auto-start, which reach it through two different validation paths
// (assertCanStart vs. assertRoomCanStartRound) but converge here once a
// room is confirmed startable.
async function startRoundForRoom(io: AppServer, room: StartableRoom): Promise<void> {
  // Whichever path actually starts a round (the host's manual start, or the
  // continue-vote system's own auto-start) wins outright - clear out any
  // stray poll/pending-timer for this room so the two paths can never race
  // into starting two rounds at once.
  clearContinueState(room.id);

  const players = room.players.map((p) => ({ userId: p.userId, username: p.user.username }));

  const game = GameManager.startGame(room.id, room.game.slug, players, room.settings ?? undefined);

  const session = await GameSessionService.createSession(room.id, room.gameId);
  activeSessions.set(room.id, { sessionId: session.id });

  await RoomService.markPlaying(room.id);

  game.on(GAME_ENGINE_EVENTS.STATE_CHANGED, () => broadcastGameState(io, room.id, game));
  game.on(GAME_ENGINE_EVENTS.ENDED, () => {
    finalizeGame(io, room.id).catch((err) => console.error("Failed to finalize game:", err));
  });

  const updatedRoom = await RoomService.getPublicRoomById(room.id);
  // Broadcast confirmation that the game has begun (spec's generic
  // "game:start" event), then push everyone's first state snapshot.
  io.to(room.id).emit("game:start", { room: withPresence(updatedRoom) });
  broadcastGameState(io, room.id, game);
}

async function finalizeGame(io: AppServer, roomId: string) {
  // Guards against running twice for the same game. A host-forced end
  // calls this directly, which calls GameManager.endGame -> game.end(),
  // and if the engine hadn't concluded naturally yet that call itself
  // synchronously emits ENDED - re-entering this function before the
  // first call has gone any further. Claiming (deleting) the session
  // immediately, before awaiting anything, makes the second entry a
  // no-op instead of double-finalizing.
  const session = activeSessions.get(roomId);
  if (!session) return;
  activeSessions.delete(roomId);

  const result = GameManager.endGame(roomId);
  if (!result) return;

  await GameSessionService.finalizeSession(session.sessionId, result);

  await RoomService.markWaiting(roomId);
  await RoomService.resetReadiness(roomId);

  const scoreboard = await ScoreboardService.getScoreboardByRoomId(roomId).catch(() => null);
  io.to(roomId).emit("game:end", { result, scoreboard });

  const room = await RoomService.getPublicRoomById(roomId).catch(() => null);
  if (room) {
    io.to(roomId).emit("room:update", { room: withPresence(room) });
  }

  // The match isn't over (either more configured rounds remain, or the
  // room has no round limit at all) - offer everyone the chance to keep
  // going instead of leaving it to the host alone.
  if (scoreboard && !scoreboard.matchComplete) {
    await openContinuePoll(io, roomId);
  }
}

// --- Continue-vote system: implementation ---------------------------------

async function openContinuePoll(io: AppServer, roomId: string): Promise<void> {
  if (continuePolls.has(roomId)) return; // shouldn't happen, but never stack polls
  const room = await RoomService.getRoomById(roomId).catch(() => null);
  // Nobody left to ask (or the room vanished) - nothing to poll for.
  if (!room || room.players.length === 0) return;

  const timeout = setTimeout(() => {
    resolveContinuePoll(io, roomId).catch((err) => console.error("Failed to resolve continue poll:", err));
  }, CONTINUE_VOTE_TIMEOUT_MS);
  continuePolls.set(roomId, { votes: new Map(), timeout });

  io.to(roomId).emit("game:continuePoll", {
    roomId,
    deadline: Date.now() + CONTINUE_VOTE_TIMEOUT_MS,
    totalPlayers: room.players.length,
  });
}

// Ends the poll and acts on the outcome. The "game:continueVote" handler
// only ever calls this WITHOUT a forcedResult once its own timeout fires -
// a majority reached earlier always resolves right there with an explicit
// forcedResult already computed. So a bare timeout here always defaults to
// NOT continuing, rather than falling back to comparing whatever partial
// yes/no counts happened to come in - which would let a single early "yes"
// count as a majority all by itself the moment nobody else votes in time,
// rather than actually trapping the room in limbo.
async function resolveContinuePoll(io: AppServer, roomId: string, forcedResult?: boolean): Promise<void> {
  const poll = continuePolls.get(roomId);
  if (!poll) return;
  clearTimeout(poll.timeout);
  continuePolls.delete(roomId);

  const willContinue = forcedResult ?? false;

  if (!willContinue) {
    io.to(roomId).emit("game:continueResolved", { roomId, willContinue: false, nextRoundAt: null });
    return;
  }

  const nextRoundAt = Date.now() + NEXT_ROUND_DELAY_MS;
  const timeout = setTimeout(() => {
    pendingRoundStarts.delete(roomId);
    triggerNextRound(io, roomId).catch((err) => console.error("Failed to auto-start next round:", err));
  }, NEXT_ROUND_DELAY_MS);
  pendingRoundStarts.set(roomId, { timeout, nextRoundAt });
  io.to(roomId).emit("game:continueResolved", { roomId, willContinue: true, nextRoundAt });
}

// Actually starts the next round after a "yes" result - either once the
// scoreboard-viewing delay elapses on its own, or immediately when someone
// presses skip. Re-validates from scratch (round limit, min players) since
// time has passed and the room could have changed; a failure here (e.g.
// too many players left in the meantime) is reported so clients stop
// waiting instead of hanging on a round that will never start.
async function triggerNextRound(io: AppServer, roomId: string): Promise<void> {
  try {
    const room = await RoomService.assertRoomCanStartRound(roomId);
    await startRoundForRoom(io, room);
  } catch (err) {
    io.to(roomId).emit("game:continueFailed", {
      roomId,
      error: err instanceof Error ? err.message : "เริ่มรอบต่อไปไม่สำเร็จ",
    });
  }
}

export function registerGameSocket(io: AppServer, socket: AppSocket) {
  const userId = socket.data.user.id;

  socket.on("game:start", async ({ roomId }: { roomId: string }, ack: Ack = noopAck) => {
    try {
      const room = await RoomService.assertCanStart(userId, roomId);
      await startRoundForRoom(io, room);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: err instanceof Error ? err.message : "เริ่มเกมไม่สำเร็จ" });
    }
  });

  // Casts (or changes) this player's vote in the "play again?" poll opened
  // after a round ends with the match not yet complete. Resolves early the
  // moment a majority is reached either way, rather than always waiting
  // out the full timeout.
  socket.on(
    "game:continueVote",
    async ({ roomId, wantsContinue }: { roomId: string; wantsContinue: boolean }, ack: Ack = noopAck) => {
      try {
        if (!socket.rooms.has(roomId)) throw new Error("กรุณากลับเข้าห้องก่อนทำรายการ");
        const poll = continuePolls.get(roomId);
        if (!poll) throw new Error("ไม่มีการโหวตเล่นต่อในขณะนี้");

        poll.votes.set(userId, Boolean(wantsContinue));

        const room = await RoomService.getRoomById(roomId).catch(() => null);
        const totalPlayers = room?.players.length ?? poll.votes.size;

        let yes = 0;
        let no = 0;
        for (const v of poll.votes.values()) {
          if (v) yes++;
          else no++;
        }
        const required = Math.floor(totalPlayers / 2) + 1;

        if (yes >= required) {
          await resolveContinuePoll(io, roomId, true);
        } else if (no >= required) {
          await resolveContinuePoll(io, roomId, false);
        } else if (poll.votes.size >= totalPlayers) {
          // Everyone has answered but neither side reached a majority
          // (only possible with an even headcount split down the middle) -
          // resolve now rather than waiting out the rest of the timeout.
          await resolveContinuePoll(io, roomId, yes > no);
        } else {
          io.to(roomId).emit("game:continueUpdate", {
            roomId,
            votedUserIds: Array.from(poll.votes.keys()),
            votesFor: yes,
            votesAgainst: no,
            totalPlayers,
          });
        }
        ack({ ok: true });
      } catch (err) {
        ack({ ok: false, error: err instanceof Error ? err.message : "โหวตไม่สำเร็จ" });
      }
    }
  );

  // Lets anyone cut the post-vote scoreboard delay short once a "yes"
  // result has already been decided - no separate vote needed, since the
  // continue decision itself was already made; this only skips the wait.
  socket.on("game:skipContinueDelay", async ({ roomId }: { roomId: string }, ack: Ack = noopAck) => {
    try {
      if (!socket.rooms.has(roomId)) throw new Error("กรุณากลับเข้าห้องก่อนทำรายการ");
      const pending = pendingRoundStarts.get(roomId);
      if (!pending) {
        ack({ ok: true }); // Nothing pending (already started, or never resolved "yes") - no-op.
        return;
      }
      clearTimeout(pending.timeout);
      pendingRoundStarts.delete(roomId);
      await triggerNextRound(io, roomId);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: err instanceof Error ? err.message : "ข้ามไม่สำเร็จ" });
    }
  });

  // Generic action channel. `actionType` follows the namespaced pattern
  // (e.g. "spyfall:vote") but this file never interprets it - it is
  // forwarded verbatim to whatever game is active for the room, which is
  // the only place that knows what it means. Never trust `payload` here;
  // each game's handleAction is responsible for validating it itself.
  socket.on(
    "game:action",
    (
      { roomId, actionType, payload }: { roomId: string; actionType: string; payload: unknown },
      ack: Ack = noopAck
    ) => {
      try {
        if (!socket.rooms.has(roomId)) throw new Error("กรุณากลับเข้าห้องก่อนทำรายการ");
        GameManager.handleAction(roomId, userId, actionType, payload);
        ack({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "การกระทำในเกมไม่ถูกต้อง";
        socket.emit("game:error", { message });
        ack({ ok: false, error: message });
      }
    }
  );

  // Lets the host abort an in-progress game early; natural conclusions
  // (timer expiry, vote resolution, a correct/incorrect spy guess) are
  // triggered by the engine itself via the ENDED event above.
  socket.on("game:end", async ({ roomId }: { roomId: string }, ack: Ack = noopAck) => {
    try {
      const room = await RoomService.getRoomById(roomId);
      if (room.hostId !== userId) {
        throw new Error("เฉพาะโฮสต์เท่านั้นที่จบเกมได้");
      }
      await finalizeGame(io, roomId);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: err instanceof Error ? err.message : "จบเกมไม่สำเร็จ" });
    }
  });
}
