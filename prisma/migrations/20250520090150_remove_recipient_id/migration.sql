/*
  Warnings:

  - You are about to drop the column `recipient_id` on the `AuctionMessage` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuctionMessage" DROP CONSTRAINT "AuctionMessage_recipient_id_fkey";

-- DropIndex
DROP INDEX "AuctionMessage_auction_id_recipient_id_created_at_idx";

-- DropIndex
DROP INDEX "AuctionMessage_recipient_id_idx";

-- AlterTable
ALTER TABLE "AuctionMessage" DROP COLUMN "recipient_id";
