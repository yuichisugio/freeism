/*
  Warnings:

  - You are about to drop the column `is_read` on the `AuctionNotification` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `AuctionNotification` table. All the data in the column will be lost.
  - Added the required column `auction_event_type` to the `AuctionNotification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `send_timing_type` to the `AuctionNotification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `target_type` to the `AuctionNotification` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NotificationSendMethod" AS ENUM ('WEB_PUSH', 'APP_PUSH', 'EMAIL', 'IN_APP', 'SMS');

-- CreateEnum
CREATE TYPE "AuctionEventType" AS ENUM ('ITEM_SOLD', 'NO_WINNER', 'ENDED', 'OUTBID', 'QUESTION_RECEIVED', 'AUTO_BID_LIMIT_REACHED', 'AUCTION_WIN', 'AUCTION_LOST', 'POINT_RETURNED');

-- AlterTable
ALTER TABLE "AuctionNotification" DROP COLUMN "is_read",
DROP COLUMN "type",
ADD COLUMN     "action_url" TEXT,
ADD COLUMN     "auction_event_type" "AuctionEventType" NOT NULL,
ADD COLUMN     "group_id" TEXT,
ADD COLUMN     "isRead" JSONB DEFAULT '{}',
ADD COLUMN     "priority" DOUBLE PRECISION DEFAULT 1.0,
ADD COLUMN     "send_methods" "NotificationSendMethod"[],
ADD COLUMN     "send_scheduled_date" TIMESTAMP(3),
ADD COLUMN     "send_timing_type" "NotificationSendTiming" NOT NULL,
ADD COLUMN     "sent_at" TIMESTAMP(3),
ADD COLUMN     "target_type" "NotificationTargetType" NOT NULL,
ADD COLUMN     "task_id" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL,
ALTER COLUMN "auction_id" DROP NOT NULL,
ALTER COLUMN "expires_at" DROP NOT NULL;

-- DropEnum
DROP TYPE "AuctionNotificationType";

-- CreateIndex
CREATE INDEX "AuctionNotification_group_id_idx" ON "AuctionNotification"("group_id");

-- CreateIndex
CREATE INDEX "AuctionNotification_task_id_idx" ON "AuctionNotification"("task_id");

-- AddForeignKey
ALTER TABLE "AuctionNotification" ADD CONSTRAINT "AuctionNotification_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionNotification" ADD CONSTRAINT "AuctionNotification_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
