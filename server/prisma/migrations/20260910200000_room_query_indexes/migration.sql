CREATE INDEX "rooms_status_updatedAt_idx" ON "rooms"("status", "updatedAt");
CREATE INDEX "room_players_userId_leftAt_idx" ON "room_players"("userId", "leftAt");
CREATE INDEX "game_sessions_roomId_status_startedAt_idx" ON "game_sessions"("roomId", "status", "startedAt");
