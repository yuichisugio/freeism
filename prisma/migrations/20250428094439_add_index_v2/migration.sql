-- AlterTable
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("token");

-- CreateIndex
CREATE INDEX "Account_user_id_idx" ON "Account"("user_id");

-- CreateIndex
CREATE INDEX "Analytics_evaluator_idx" ON "Analytics"("evaluator");

-- CreateIndex
CREATE INDEX "idx_auction_group_status_end" ON "Auction"("group_id", "status", "end_time" ASC);

-- CreateIndex
CREATE INDEX "idx_auction_group_status_start_desc" ON "Auction"("group_id", "status", "start_time" DESC);

-- CreateIndex
CREATE INDEX "idx_auction_group_highestBid_desc" ON "Auction"("group_id", "current_highest_bid" DESC);

-- CreateIndex
CREATE INDEX "idx_bidhistory_auctionId_userId_createdAt_desc" ON "BidHistory"("auction_id", "user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_bidhistory_userId_createdAt_desc" ON "BidHistory"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notification_sender_isread" ON "Notification"("sender_user_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_notification_scheduled" ON "Notification"("send_scheduled_date" ASC);

-- CreateIndex
CREATE INDEX "idx_notification_target_event" ON "Notification"("target_type", "auction_event_type");

-- CreateIndex
CREATE INDEX "idx_notification_isread_gin" ON "Notification" USING GIN ("is_read");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Task_user_fixed_submitter_id_idx" ON "Task"("user_fixed_submitter_id");

-- CreateIndex
CREATE INDEX "idx_task_groupId_status_createdAt_desc" ON "Task"("groupId", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_task_groupId_contributionType_category" ON "Task"("groupId", "contribution_type", "category");

-- RenameIndex
ALTER INDEX "BidHistory_auction_id_created_at_idx" RENAME TO "idx_bidhistory_auctionId_createdAt_desc";
