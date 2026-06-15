/*
  Warnings:

  - You are about to drop the column `id` on the `Account` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Account" DROP COLUMN "id",
ALTER COLUMN "expires_at" SET DATA TYPE TEXT;
