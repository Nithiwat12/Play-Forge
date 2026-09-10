const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup(connected = true) {
  const pending = [], joined = [], errors = [], timers = new Map();
  let timerId = 0;
  const socket = Object.assign(new EventEmitter(), { connected });
  const exports = {};
  const source = ts.transpileModule(readFileSync(`${__dirname}/../src/services/roomConnection.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: () => ({ emitWithAck: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) }),
    setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    Error,
  });
  const stop = exports.subscribeToRoom(socket, 'ABC123', (x) => joined.push(x), (x) => errors.push(x));
  return { pending, joined, errors, timers, socket, stop };
}
const flush = () => new Promise(setImmediate);
const response = { ok: true, room: { id: 'room', status: 'PLAYING' }, gameState: { roomId: 'room', public: { phase: 'IN_PROGRESS' }, private: { role: 'doctor' } } };

test('re-entry supplies room and private snapshot together without needing a game event', async () => {
  const s = setup();
  s.pending[0].resolve(response);
  await flush();
  assert.equal(s.joined[0].gameState.private.role, 'doctor');
  assert.equal(s.timers.size, 0);
  s.stop();
});
test('a socket that never connects has a deadline and a visible failure callback', () => {
  const s = setup(false);
  for (const fn of s.timers.values()) fn();
  assert.equal(s.errors.length, 1);
  assert.equal(s.pending.length, 0);
  s.stop();
});
test('disconnect rejects stale acknowledgement and reconnect joins again', async () => {
  const s = setup();
  s.socket.emit('disconnect');
  s.socket.emit('connect');
  s.pending[0].resolve(response);
  await flush();
  assert.equal(s.joined.length, 0);
  s.pending[1].resolve(response);
  await flush();
  assert.equal(s.joined.length, 1);
  s.stop();
});
test('unmount / StrictMode cleanup ignores pending response and removes listeners', async () => {
  const s = setup(); s.stop();
  s.pending[0].resolve(response); await flush();
  assert.equal(s.joined.length, 0);
  assert.equal(s.timers.size, 0);
  assert.equal(s.socket.eventNames().length, 0);
});
test('join refusal and transport failure surface errors instead of waiting forever', async () => {
  const s = setup();
  s.pending[0].resolve({ ok: false, error: 'Room closed' }); await flush();
  assert.equal(s.errors[0], 'Room closed');
  s.socket.emit('connect_error', new Error('offline'));
  assert.equal(s.errors.length, 2);
  s.stop();
});
