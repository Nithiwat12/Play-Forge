// Serialize host role edits and game:start across asynchronous DB calls.
const pending = new Map<string, Promise<unknown>>();
export async function withRoomSetupLock<T>(roomId: string, work: () => Promise<T>): Promise<T> {
  const previous = pending.get(roomId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  pending.set(roomId, next);
  try { return await next; } finally { if (pending.get(roomId) === next) pending.delete(roomId); }
}
