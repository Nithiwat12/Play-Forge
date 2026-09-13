-- Retire the catalog entry without deleting existing room/history foreign keys.
UPDATE "games" SET "isActive" = false WHERE "slug" = 'island_betrayal';
