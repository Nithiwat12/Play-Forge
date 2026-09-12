-- Island Betrayal has been removed from the platform (engine + UI deleted
-- from the codebase). Existing rows in `rooms` / `game_sessions` may still
-- reference this game's id, so we deactivate it instead of deleting it -
-- this hides it from the Game Library (GameService.listActiveGames filters
-- on isActive = true) and blocks new rooms (RoomService checks isActive)
-- without breaking foreign keys or any historical data for other games.
UPDATE "games" SET "isActive" = false WHERE "slug" = 'island_betrayal';
