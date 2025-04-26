/*
  Warnings:

  - You are about to drop the column `extension_count` on the `Auction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Auction" DROP COLUMN "extension_count",
ADD COLUMN     "extension_limit_count" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "extension_limit_time" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "extension_total_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extension_total_time" INTEGER NOT NULL DEFAULT 0;
