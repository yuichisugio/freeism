/*
  Warnings:

  - You are about to drop the column `isRead` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the `AuctionNotification` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updated_at` to the `BidHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationTargetType" ADD VALUE 'AUCTION_SELLER';
ALTER TYPE "NotificationTargetType" ADD VALUE 'AUCTION_BIDDER';

-- DropForeignKey
ALTER TABLE "AuctionNotification" DROP CONSTRAINT "AuctionNotification_auction_id_fkey";

-- DropForeignKey
ALTER TABLE "AuctionNotification" DROP CONSTRAINT "AuctionNotification_group_id_fkey";

-- DropForeignKey
ALTER TABLE "AuctionNotification" DROP CONSTRAINT "AuctionNotification_task_id_fkey";

-- DropForeignKey
ALTER TABLE "AuctionNotification" DROP CONSTRAINT "AuctionNotification_user_id_fkey";

-- AlterTable
ALTER TABLE "BidHistory" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "isRead",
ADD COLUMN     "auction_event_type" "AuctionEventType",
ADD COLUMN     "auction_id" TEXT,
ADD COLUMN     "is_read" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "send_methods" "NotificationSendMethod"[];

-- DropTable
DROP TABLE "AuctionNotification";

-- CreateIndex
CREATE INDEX "Notification_auction_id_idx" ON "Notification"("auction_id");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
