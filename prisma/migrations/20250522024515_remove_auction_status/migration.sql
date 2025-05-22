/*
  Warnings:

  - You are about to drop the column `status` on the `Auction` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskStatus" ADD VALUE 'AUCTION_ACTIVE';
ALTER TYPE "TaskStatus" ADD VALUE 'AUCTION_ENDED';

-- DropIndex
DROP INDEX "Auction_status_idx";

-- DropIndex
DROP INDEX "Auction_winner_id_status_end_time_idx";

-- DropIndex
DROP INDEX "idx_auction_group_status_end";

-- DropIndex
DROP INDEX "idx_auction_group_status_start_desc";

-- AlterTable
ALTER TABLE "Auction" DROP COLUMN "status";

-- DropEnum
DROP TYPE "AuctionStatus";

-- CreateIndex
CREATE INDEX "idx_auction_group_end" ON "Auction"("group_id", "end_time" ASC);

-- CreateIndex
CREATE INDEX "idx_auction_group_start_desc" ON "Auction"("group_id", "start_time" DESC);

-- CreateIndex
CREATE INDEX "Auction_winner_id_end_time_idx" ON "Auction"("winner_id", "end_time" DESC);
