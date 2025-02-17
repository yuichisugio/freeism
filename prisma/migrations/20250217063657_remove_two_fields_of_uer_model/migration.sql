/*
  Warnings:

  - You are about to drop the column `evaluationMethod` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `groupName` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "evaluationMethod",
DROP COLUMN "groupName";
