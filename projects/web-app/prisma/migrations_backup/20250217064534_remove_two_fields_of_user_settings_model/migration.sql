/*
  Warnings:

  - You are about to drop the column `lifeGoal` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `referralSource` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `evaluationMethod` on the `UserSettings` table. All the data in the column will be lost.
  - You are about to drop the column `groupName` on the `UserSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "lifeGoal",
DROP COLUMN "referralSource";

-- AlterTable
ALTER TABLE "UserSettings" DROP COLUMN "evaluationMethod",
DROP COLUMN "groupName";
