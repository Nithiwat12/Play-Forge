/**
 * Tracks which users currently have a live socket connection in which
 * room, independent of the Socket.IO room mechanism itself. A user can
 * have more than one socket in the same room (multiple tabs/devices), so
 * we refcount by socket id and only treat a user as "disconnected" once
 * their last socket in that room closes.
 */
class RoomPresenceClass {
  private rooms = new Map<string, Map<string, Set<string>>>(); // roomId -> userId -> Set<socketId>

  addConnection(roomId: string, userId: string, socketId: string): void {
    let users = this.rooms.get(roomId);
    if (!users) {
      users = new Map();
      this.rooms.set(roomId, users);
    }
    let sockets = users.get(userId);
    if (!sockets) {
      sockets = new Set();
      users.set(userId, sockets);
    }
    sockets.add(socketId);
  }

  /** Returns true if that was the user's last socket in the room. */
  removeConnection(roomId: string, userId: string, socketId: string): boolean {
    const users = this.rooms.get(roomId);
    if (!users) return true;
    const sockets = users.get(userId);
    if (!sockets) return true;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      users.delete(userId);
      if (users.size === 0) this.rooms.delete(roomId);
      return true;
    }
    return false;
  }

  isConnected(roomId: string, userId: string): boolean {
    return Boolean(this.rooms.get(roomId)?.get(userId)?.size);
  }

  getConnectedUserIds(roomId: string): string[] {
    return Array.from(this.rooms.get(roomId)?.keys() ?? []);
  }

  clearRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}

export const RoomPresence = new RoomPresenceClass();
