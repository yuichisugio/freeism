-- CreateEnum
CREATE TYPE "contributionType" AS ENUM ('REWARD', 'NON_REWARD');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'POINTS_DEPOSITED', 'TASK_COMPLETED', 'FIXED_EVALUATED', 'POINTS_AWARDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('SYSTEM', 'USER', 'GROUP', 'TASK', 'AUCTION_SELLER', 'AUCTION_BIDDER');

-- CreateEnum
CREATE TYPE "NotificationSendTiming" AS ENUM ('NOW', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "NotificationSendMethod" AS ENUM ('WEB_PUSH', 'APP_PUSH', 'EMAIL', 'IN_APP', 'SMS');

-- CreateEnum
CREATE TYPE "AuctionEventType" AS ENUM ('ITEM_SOLD', 'NO_WINNER', 'ENDED', 'OUTBID', 'QUESTION_RECEIVED', 'AUTO_BID_LIMIT_REACHED', 'AUCTION_WIN', 'AUCTION_LOST', 'POINT_RETURNED', 'AUCTION_CANCELED');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('BIDDING', 'WON', 'LOST', 'INSUFFICIENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email_verified" TIMESTAMP(3),
    "is_app_owner" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "expires_at" INTEGER,
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider_account_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "expires" TIMESTAMP(3) NOT NULL,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_token" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "life_goal" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_push_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "deposit_period" INTEGER NOT NULL DEFAULT 30,
    "max_participants" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "evaluation_method" TEXT NOT NULL,
    "is_black_list" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "is_group_owner" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "reference" TEXT,
    "groupId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "info" TEXT,
    "detail" TEXT,
    "contribution_type" "contributionType" NOT NULL DEFAULT 'NON_REWARD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator_id" TEXT NOT NULL,
    "fixed_contribution_point" INTEGER,
    "fixed_evaluation_date" TIMESTAMP(3),
    "fixed_evaluation_logic" TEXT,
    "fixed_evaluator" TEXT,
    "image_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_fixed_submitter_id" TEXT,
    "delivery_method" TEXT,
    "category" TEXT DEFAULT 'その他',

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL,
    "evaluator" TEXT NOT NULL,
    "contribution_point" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluation_logic" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "action_url" TEXT,
    "expires_at" TIMESTAMP(3),
    "group_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "target_type" "NotificationTargetType" NOT NULL,
    "task_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "send_scheduled_date" TIMESTAMP(3),
    "send_timing_type" "NotificationSendTiming" NOT NULL,
    "auction_event_type" "AuctionEventType",
    "auction_id" TEXT,
    "is_read" JSONB NOT NULL DEFAULT '{}',
    "send_methods" "NotificationSendMethod"[],
    "sender_user_id" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskReporter" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "task_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "TaskReporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskExecutor" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "task_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "TaskExecutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskWatchList" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskWatchList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupPoint" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "fixed_total_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "current_highest_bid" INTEGER NOT NULL DEFAULT 0,
    "current_highest_bidder_id" TEXT,
    "winner_id" TEXT,
    "status" "AuctionStatus" NOT NULL DEFAULT 'PENDING',
    "extension_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidHistory" (
    "id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "is_auto_bid" BOOLEAN NOT NULL DEFAULT false,
    "status" "BidStatus" NOT NULL DEFAULT 'BIDDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deposit_point" INTEGER,

    CONSTRAINT "BidHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoBid" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "max_bid_amount" INTEGER NOT NULL,
    "bid_increment" INTEGER NOT NULL DEFAULT 1,
    "last_bid_time" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionReview" (
    "id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "reviewee_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "completion_proof_url" TEXT,
    "is_seller_review" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionMessage" (
    "id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT,
    "p256dh" TEXT,
    "auth" TEXT,
    "expiration_time" TIMESTAMP(3),
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_user_id_idx" ON "Account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_provider_account_id_key" ON "Account"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "Session_session_token_key" ON "Session"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_user_id_key" ON "UserSettings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE INDEX "Group_created_by_idx" ON "Group"("created_by");

-- CreateIndex
CREATE INDEX "GroupMembership_user_id_idx" ON "GroupMembership"("user_id");

-- CreateIndex
CREATE INDEX "GroupMembership_group_id_idx" ON "GroupMembership"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_user_id_group_id_key" ON "GroupMembership"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "Task_creator_id_idx" ON "Task"("creator_id");

-- CreateIndex
CREATE INDEX "Task_groupId_idx" ON "Task"("groupId");

-- CreateIndex
CREATE INDEX "Analytics_task_id_idx" ON "Analytics"("task_id");

-- CreateIndex
CREATE INDEX "Analytics_group_id_idx" ON "Analytics"("group_id");

-- CreateIndex
CREATE INDEX "Notification_sender_user_id_idx" ON "Notification"("sender_user_id");

-- CreateIndex
CREATE INDEX "Notification_group_id_idx" ON "Notification"("group_id");

-- CreateIndex
CREATE INDEX "Notification_task_id_idx" ON "Notification"("task_id");

-- CreateIndex
CREATE INDEX "Notification_auction_id_idx" ON "Notification"("auction_id");

-- CreateIndex
CREATE INDEX "TaskReporter_user_id_idx" ON "TaskReporter"("user_id");

-- CreateIndex
CREATE INDEX "TaskReporter_task_id_idx" ON "TaskReporter"("task_id");

-- CreateIndex
CREATE INDEX "TaskExecutor_user_id_idx" ON "TaskExecutor"("user_id");

-- CreateIndex
CREATE INDEX "TaskExecutor_task_id_idx" ON "TaskExecutor"("task_id");

-- CreateIndex
CREATE INDEX "TaskWatchList_user_id_idx" ON "TaskWatchList"("user_id");

-- CreateIndex
CREATE INDEX "TaskWatchList_auction_id_idx" ON "TaskWatchList"("auction_id");

-- CreateIndex
CREATE UNIQUE INDEX "TaskWatchList_user_id_auction_id_key" ON "TaskWatchList"("user_id", "auction_id");

-- CreateIndex
CREATE INDEX "GroupPoint_user_id_idx" ON "GroupPoint"("user_id");

-- CreateIndex
CREATE INDEX "GroupPoint_group_id_idx" ON "GroupPoint"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPoint_user_id_group_id_key" ON "GroupPoint"("user_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_task_id_key" ON "Auction"("task_id");

-- CreateIndex
CREATE INDEX "Auction_task_id_idx" ON "Auction"("task_id");

-- CreateIndex
CREATE INDEX "Auction_current_highest_bidder_id_idx" ON "Auction"("current_highest_bidder_id");

-- CreateIndex
CREATE INDEX "Auction_winner_id_idx" ON "Auction"("winner_id");

-- CreateIndex
CREATE INDEX "Auction_group_id_idx" ON "Auction"("group_id");

-- CreateIndex
CREATE INDEX "BidHistory_auction_id_idx" ON "BidHistory"("auction_id");

-- CreateIndex
CREATE INDEX "BidHistory_user_id_idx" ON "BidHistory"("user_id");

-- CreateIndex
CREATE INDEX "AutoBid_user_id_idx" ON "AutoBid"("user_id");

-- CreateIndex
CREATE INDEX "AutoBid_auction_id_idx" ON "AutoBid"("auction_id");

-- CreateIndex
CREATE UNIQUE INDEX "AutoBid_user_id_auction_id_key" ON "AutoBid"("user_id", "auction_id");

-- CreateIndex
CREATE INDEX "AuctionReview_auction_id_idx" ON "AuctionReview"("auction_id");

-- CreateIndex
CREATE INDEX "AuctionReview_reviewer_id_idx" ON "AuctionReview"("reviewer_id");

-- CreateIndex
CREATE INDEX "AuctionReview_reviewee_id_idx" ON "AuctionReview"("reviewee_id");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionReview_auction_id_reviewer_id_reviewee_id_key" ON "AuctionReview"("auction_id", "reviewer_id", "reviewee_id");

-- CreateIndex
CREATE INDEX "AuctionMessage_auction_id_idx" ON "AuctionMessage"("auction_id");

-- CreateIndex
CREATE INDEX "AuctionMessage_sender_id_idx" ON "AuctionMessage"("sender_id");

-- CreateIndex
CREATE INDEX "AuctionMessage_recipient_id_idx" ON "AuctionMessage"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_user_id_idx" ON "PushSubscription"("user_id");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_user_fixed_submitter_id_fkey" FOREIGN KEY ("user_fixed_submitter_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_evaluator_fkey" FOREIGN KEY ("evaluator") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReporter" ADD CONSTRAINT "TaskReporter_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReporter" ADD CONSTRAINT "TaskReporter_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecutor" ADD CONSTRAINT "TaskExecutor_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecutor" ADD CONSTRAINT "TaskExecutor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskWatchList" ADD CONSTRAINT "TaskWatchList_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskWatchList" ADD CONSTRAINT "TaskWatchList_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPoint" ADD CONSTRAINT "GroupPoint_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPoint" ADD CONSTRAINT "GroupPoint_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_current_highest_bidder_id_fkey" FOREIGN KEY ("current_highest_bidder_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidHistory" ADD CONSTRAINT "BidHistory_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidHistory" ADD CONSTRAINT "BidHistory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoBid" ADD CONSTRAINT "AutoBid_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoBid" ADD CONSTRAINT "AutoBid_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionReview" ADD CONSTRAINT "AuctionReview_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionReview" ADD CONSTRAINT "AuctionReview_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionReview" ADD CONSTRAINT "AuctionReview_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionMessage" ADD CONSTRAINT "AuctionMessage_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionMessage" ADD CONSTRAINT "AuctionMessage_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionMessage" ADD CONSTRAINT "AuctionMessage_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

