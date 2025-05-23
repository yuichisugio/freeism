/*
  Warnings:

  - You are about to drop the column `extension_limit_time` on the `Auction` table. All the data in the column will be lost.
  - You are about to drop the column `extension_total_time` on the `Auction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Auction" DROP COLUMN "extension_limit_time",
DROP COLUMN "extension_total_time",
ADD COLUMN     "extension_time" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "remaining_time_for_extension" INTEGER NOT NULL DEFAULT 10,
ALTER COLUMN "extension_limit_count" SET DEFAULT 2;
