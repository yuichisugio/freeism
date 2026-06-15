/*
  Warnings:

  - Added the required column `group_id` to the `Auction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "group_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BidHistory" ADD COLUMN     "deposit_point" INTEGER;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
