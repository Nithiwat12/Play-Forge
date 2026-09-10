import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createRequire } from 'node:module';
import { registerRoomSocket } from '../src/socket/roomSocket';
import { RoomService } from '../src/services/RoomService';
import { GAME_ENGINE_EVENTS } from '../src/games/core/types';
import { GameManager } from '../src/games/core/GameManager';
import { GameRegistry } from '../src/games/core/GameRegistry';
import { SpyfallGame } from '../src/games/spyfall/SpyfallGame';
import { RoomPresence } from '../src/socket/roomPresence';
import type { AppServer, AppSocket } from '../src/socket/socketAuth';
const requireClient = createRequire(`${process.cwd()}/../client/package.json`);
const { io: clientIO } = requireClient('socket.io-client');

// Real Socket.IO transport and real engine. Database-facing services are
// stubbed: these tests never read or mutate the user's production database.
test('live socket: pause/rejoin preserves secret, missing engine fails, closed room fails', async () => {
  const room: any = { id: 'test-room', roomCode: 'ABC123', status: 'PLAYING', hostId: 'p1',
    players: ['p1','p2','p3'].map(userId => ({ userId, username: userId })),
    game: { slug: 'spyfall' } };
  const originals = { join: RoomService.joinRoom, get: RoomService.getPublicRoomById, leave: RoomService.leaveRoomById };
  let leaves = 0;
  RoomService.joinRoom = async () => {
    if (room.status === 'FINISHED') throw new Error('Room closed');
    return room;
  };
  RoomService.getPublicRoomById = async () => room;
  RoomService.leaveRoomById = async () => { leaves++; return room; };
  GameRegistry.register('spyfall', (id, config) => new SpyfallGame(id, config as any));
  const game = GameManager.startGame(room.id, 'spyfall', room.players);
  const before = game.getPrivateState('p1');
  const http = createServer();
  const io: AppServer = new Server(http);
  io.on('connection', (s: AppSocket) => {
    s.data.user = { id: 'p1', username: 'p1', email: 'test@example.invalid' };
    registerRoomSocket(io, s);
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const client = clientIO(`http://127.0.0.1:${(http.address() as any).port}`, { transports: ['websocket'], forceNew: true });
  const ack = (event: string, payload: any) => client.timeout(2000).emitWithAck(event, payload);
  try {
    await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    const initial = await ack('room:join', { roomCode: 'ABC123' });
    assert.equal(initial.ok, true);
    assert.deepEqual(initial.gameState.private, before);
    assert.equal(initial.gameState.roomId, room.id);
    assert.equal((await ack('room:pause', { roomId: room.id })).ok, true);
    assert.equal(leaves, 0, 'pause must not delete a seat');
    assert.equal(RoomPresence.isConnected(room.id, 'p1'), false);
    assert.equal((game.getPublicState() as any).players.find((p: any) => p.userId === 'p1').connected, false);
    const rejoined = await ack('room:join', { roomCode: 'ABC123' });
    assert.deepEqual(rejoined.gameState.private, before);
    assert.equal((game.getPublicState() as any).players.find((p: any) => p.userId === 'p1').connected, true);
    GameManager.abortGame(room.id);
    const missing = await ack('room:join', { roomCode: 'ABC123' });
    assert.equal(missing.ok, false);
    room.status = 'WAITING';
    const lobby = await ack('room:join', { roomCode: 'ABC123' });
    assert.equal(lobby.ok, true);
    assert.equal(lobby.gameState, null);
    room.status = 'FINISHED';
    assert.equal((await ack('room:join', { roomCode: 'ABC123' })).ok, false);
  } finally {
    client.disconnect();
    await new Promise<void>(resolve => io.close(() => resolve()));
    GameManager.abortGame(room.id);
    RoomPresence.clearRoom(room.id);
    RoomService.joinRoom = originals.join;
    RoomService.getPublicRoomById = originals.get;
    RoomService.leaveRoomById = originals.leave;
  }
});

test('legacy leave can restore only an original player; newcomers cannot join mid-round', async () => {
  const { prisma } = await import('../src/config/prisma');
  const roster = ['legacy1', 'legacy2', 'legacy3'].map(userId => ({ userId, username: userId }));
  const game = GameManager.startGame('legacy-room', 'spyfall', roster);
  const privateBefore = game.getPrivateState('legacy1');
  let restored = false;
  const row: any = {
    id: 'legacy-room', roomCode: 'OLD123', status: 'PLAYING', hostId: 'legacy2',
    roomName: 'Legacy', maxPlayers: 3, settings: null, createdAt: new Date(),
    game: { id: 'g', slug: 'spyfall', name: 'Spy', minPlayers: 3, maxPlayers: 12, isActive: true },
    players: roster.slice(1).map(p => ({ ...p, user: p, isHost: p.userId === 'legacy2', isReady: false, joinedAt: new Date() })),
  };
  const originalFind = prisma.room.findUnique, originalUpdate = prisma.roomPlayer.update;
  prisma.room.findUnique = (async () => row) as any;
  prisma.roomPlayer.update = (async ({ where, data }: any) => {
    assert.equal(where.roomId_userId.userId, 'legacy1');
    assert.equal(data.leftAt, null);
    assert.equal(data.isHost, false);
    restored = true;
    row.players.push({ ...roster[0], user: roster[0], isHost: false, isReady: false, joinedAt: new Date() });
    return {};
  }) as any;
  try {
    await assert.rejects(() => RoomService.joinRoom('outsider', { roomCode: 'OLD123' }));
    assert.equal(restored, false);
    const room = await RoomService.joinRoom('legacy1', { roomCode: 'OLD123' });
    assert.equal(room.players.length, 3);
    assert.deepEqual(game.getPrivateState('legacy1'), privateBefore);
    row.status = 'FINISHED';
    await assert.rejects(() => RoomService.joinRoom('legacy2', { roomCode: 'OLD123' }));
  } finally {
    prisma.room.findUnique = originalFind;
    prisma.roomPlayer.update = originalUpdate;
    GameManager.abortGame('legacy-room');
  }
});

test('aborting a room clears its engine without triggering completion awards', () => {
  const game = GameManager.startGame('abort-room', 'spyfall', ['a','b','c'].map(userId => ({ userId, username: userId })));
  let awards = 0;
  game.on(GAME_ENGINE_EVENTS.ENDED, () => awards++);
  GameManager.abortGame('abort-room');
  assert.equal(GameManager.getGame('abort-room'), undefined);
  assert.equal(game.isFinished(), true);
  assert.equal(game.eventNames().length, 0);
  assert.equal(awards, 0);
});
