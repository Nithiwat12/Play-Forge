-- AlterTable
ALTER TABLE "game_history" ADD COLUMN "hiddenForUserIds" TEXT[] NOT NULL DEFAULT '{}';
