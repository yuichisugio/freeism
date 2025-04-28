-- CreateIndex
CREATE INDEX "Analytics_created_at_idx" ON "Analytics"("created_at");

-- CreateIndex
CREATE INDEX "AuctionReview_rating_idx" ON "AuctionReview"("rating");

-- CreateIndex
CREATE INDEX "AuctionReview_is_seller_review_idx" ON "AuctionReview"("is_seller_review");

-- CreateIndex
CREATE INDEX "Group_created_at_idx" ON "Group"("created_at");

-- CreateIndex
CREATE INDEX "GroupPoint_balance_idx" ON "GroupPoint"("balance");

-- CreateIndex
CREATE INDEX "Notification_created_at_idx" ON "Notification"("created_at");

-- CreateIndex
CREATE INDEX "Notification_expires_at_idx" ON "Notification"("expires_at");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE INDEX "Task_created_at_idx" ON "Task"("created_at");

-- CreateIndex
CREATE INDEX "User_created_at_idx" ON "User"("created_at");

-- CreateIndex
CREATE INDEX "UserSettings_username_idx" ON "UserSettings"("username");

-- CreateIndex
CREATE INDEX "UserSettings_is_email_enabled_idx" ON "UserSettings"("is_email_enabled");

-- CreateIndex
CREATE INDEX "UserSettings_is_push_enabled_idx" ON "UserSettings"("is_push_enabled");
