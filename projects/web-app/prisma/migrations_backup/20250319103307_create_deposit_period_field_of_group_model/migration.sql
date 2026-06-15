/*
  Warnings:

  - You are about to drop the column `maxParticipants` on the `Group` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Group" DROP COLUMN "maxParticipants",
ADD COLUMN     "deposit_period" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "max_participants" INTEGER NOT NULL DEFAULT 100;
