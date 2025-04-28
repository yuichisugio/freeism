/*
  Warnings:

  - You are about to drop the column `groupId` on the `Task` table. All the data in the column will be lost.
  - Added the required column `group_id` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_groupId_fkey";

-- DropIndex
DROP INDEX "Analytics_id_idx";

-- DropIndex
DROP INDEX "Auction_id_idx";

-- DropIndex
DROP INDEX "Auction_task_id_idx";

-- DropIndex
DROP INDEX "AuctionReview_auction_id_idx";

-- DropIndex
DROP INDEX "AutoBid_auction_id_idx";

-- DropIndex
DROP INDEX "AutoBid_user_id_idx";

-- DropIndex
DROP INDEX "BidHistory_id_idx";

-- DropIndex
DROP INDEX "Group_id_idx";

-- DropIndex
DROP INDEX "GroupPoint_group_id_idx";

-- DropIndex
DROP INDEX "GroupPoint_user_id_idx";

-- DropIndex
DROP INDEX "Notification_id_idx";

-- DropIndex
DROP INDEX "idx_notification_sender_isread";

-- DropIndex
DROP INDEX "Task_groupId_idx";

-- DropIndex
DROP INDEX "Task_id_idx";

-- DropIndex
DROP INDEX "idx_task_groupId_contributionType_category";

-- DropIndex
DROP INDEX "idx_task_groupId_status_createdAt_desc";

-- DropIndex
DROP INDEX "TaskExecutor_id_idx";

-- DropIndex
DROP INDEX "TaskExecutor_task_id_idx";

-- DropIndex
DROP INDEX "TaskReporter_id_idx";

-- DropIndex
DROP INDEX "TaskReporter_task_id_idx";

-- DropIndex
DROP INDEX "User_id_idx";

-- DropIndex
DROP INDEX "UserSettings_id_idx";

-- DropIndex
DROP INDEX "UserSettings_user_id_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "groupId",
ADD COLUMN     "group_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Analytics_group_id_task_id_idx" ON "Analytics"("group_id", "task_id");

-- CreateIndex
CREATE INDEX "Analytics_group_id_evaluator_idx" ON "Analytics"("group_id", "evaluator");

-- CreateIndex
CREATE INDEX "Auction_id_version_idx" ON "Auction"("id", "version");

-- CreateIndex
CREATE INDEX "Auction_winner_id_status_end_time_idx" ON "Auction"("winner_id", "status", "end_time" DESC);

-- CreateIndex
CREATE INDEX "Auction_task_id_created_at_idx" ON "Auction"("task_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Auction_created_at_idx" ON "Auction"("created_at" DESC);

-- CreateIndex
CREATE INDEX "AuctionMessage_auction_id_created_at_idx" ON "AuctionMessage"("auction_id", "created_at");

-- CreateIndex
CREATE INDEX "AuctionMessage_auction_id_sender_id_created_at_idx" ON "AuctionMessage"("auction_id", "sender_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "AuctionMessage_auction_id_recipient_id_created_at_idx" ON "AuctionMessage"("auction_id", "recipient_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "AuctionReview_auction_id_reviewer_id_idx" ON "AuctionReview"("auction_id", "reviewer_id");

-- CreateIndex
CREATE INDEX "GroupMembership_is_group_owner_idx" ON "GroupMembership"("is_group_owner");

-- CreateIndex
CREATE INDEX "Notification_send_timing_type_sent_at_idx" ON "Notification"("send_timing_type", "sent_at");

-- CreateIndex
CREATE INDEX "Task_group_id_idx" ON "Task"("group_id");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_id_creator_id_idx" ON "Task"("id", "creator_id");

-- CreateIndex
CREATE INDEX "idx_task_groupId_status_createdAt_desc" ON "Task"("group_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_task_groupId_contributionType_category" ON "Task"("group_id", "contribution_type", "category");

-- CreateIndex
CREATE INDEX "TaskExecutor_task_id_user_id_idx" ON "TaskExecutor"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "TaskReporter_task_id_user_id_idx" ON "TaskReporter"("task_id", "user_id");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
