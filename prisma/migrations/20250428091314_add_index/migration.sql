-- DropIndex
DROP INDEX "Account_user_id_idx";

-- CreateIndex
CREATE INDEX "Analytics_id_idx" ON "Analytics"("id");

-- CreateIndex
CREATE INDEX "Auction_id_idx" ON "Auction"("id");

-- CreateIndex
CREATE INDEX "Auction_version_idx" ON "Auction"("version");

-- CreateIndex
CREATE INDEX "Auction_status_idx" ON "Auction"("status");

-- CreateIndex
CREATE INDEX "Auction_start_time_idx" ON "Auction"("start_time");

-- CreateIndex
CREATE INDEX "Auction_end_time_idx" ON "Auction"("end_time");

-- CreateIndex
CREATE INDEX "AutoBid_max_bid_amount_idx" ON "AutoBid"("max_bid_amount");

-- CreateIndex
CREATE INDEX "idx_autoBid_auction_active_maxbid_createdat" ON "AutoBid"("auction_id", "is_active", "max_bid_amount" DESC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_autoBid_auction_user_active_maxbid" ON "AutoBid"("auction_id", "user_id", "is_active", "max_bid_amount");

-- CreateIndex
CREATE INDEX "BidHistory_id_idx" ON "BidHistory"("id");

-- CreateIndex
CREATE INDEX "BidHistory_status_idx" ON "BidHistory"("status");

-- CreateIndex
CREATE INDEX "BidHistory_auction_id_created_at_idx" ON "BidHistory"("auction_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Group_id_idx" ON "Group"("id");

-- CreateIndex
CREATE INDEX "Notification_id_idx" ON "Notification"("id");

-- CreateIndex
CREATE INDEX "Notification_auction_event_type_idx" ON "Notification"("auction_event_type");

-- CreateIndex
CREATE INDEX "Task_id_idx" ON "Task"("id");

-- CreateIndex
CREATE INDEX "Task_contribution_type_idx" ON "Task"("contribution_type");

-- CreateIndex
CREATE INDEX "Task_category_idx" ON "Task"("category");

-- CreateIndex
CREATE INDEX "TaskExecutor_id_idx" ON "TaskExecutor"("id");

-- CreateIndex
CREATE INDEX "TaskReporter_id_idx" ON "TaskReporter"("id");

-- CreateIndex
CREATE INDEX "User_id_idx" ON "User"("id");

-- CreateIndex
CREATE INDEX "User_image_idx" ON "User"("image");

-- CreateIndex
CREATE INDEX "User_is_app_owner_idx" ON "User"("is_app_owner");

-- CreateIndex
CREATE INDEX "UserSettings_id_idx" ON "UserSettings"("id");

-- CreateIndex
CREATE INDEX "UserSettings_user_id_idx" ON "UserSettings"("user_id");
