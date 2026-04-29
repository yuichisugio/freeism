/*
  Warnings:

  - You are about to drop the column `is_email_enabled` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `is_push_enabled` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "is_email_enabled",
DROP COLUMN "is_push_enabled";

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "is_email_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_push_enabled" BOOLEAN NOT NULL DEFAULT false;
