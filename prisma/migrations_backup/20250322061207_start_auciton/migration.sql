-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('BIDDING', 'WON', 'LOST', 'INSUFFICIENT');

-- CreateEnum
CREATE TYPE "AuctionNotificationType" AS ENUM ('BID_PLACED', 'OUTBID', 'QUESTION_RECEIVED', 'MAX_BID_REACHED', 'AUCTION_ENDED', 'WON_AUCTION', 'LOST_AUCTION', 'POINT_RETURNED');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "auction_end_time" TIMESTAMP(3),
ADD COLUMN     "auction_start_time" TIMESTAMP(3),
ADD COLUMN     "delivery_method" TEXT;

-- CreateTable
CREATE TABLE "TaskWatchList" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
CREATE TABLE "AuctionNotification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "AuctionNotificationType" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionNotification_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "AuctionReview_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "AuctionNotification_user_id_idx" ON "AuctionNotification"("user_id");

-- CreateIndex
CREATE INDEX "AuctionNotification_auction_id_idx" ON "AuctionNotification"("auction_id");

-- CreateIndex
CREATE INDEX "AuctionReview_auction_id_idx" ON "AuctionReview"("auction_id");

-- CreateIndex
CREATE INDEX "AuctionReview_reviewer_id_idx" ON "AuctionReview"("reviewer_id");

-- CreateIndex
CREATE INDEX "AuctionReview_reviewee_id_idx" ON "AuctionReview"("reviewee_id");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionReview_auction_id_reviewer_id_reviewee_id_key" ON "AuctionReview"("auction_id", "reviewer_id", "reviewee_id");

-- AddForeignKey
ALTER TABLE "TaskWatchList" ADD CONSTRAINT "TaskWatchList_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskWatchList" ADD CONSTRAINT "TaskWatchList_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPoint" ADD CONSTRAINT "GroupPoint_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPoint" ADD CONSTRAINT "GroupPoint_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_current_highest_bidder_id_fkey" FOREIGN KEY ("current_highest_bidder_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidHistory" ADD CONSTRAINT "BidHistory_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidHistory" ADD CONSTRAINT "BidHistory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoBid" ADD CONSTRAINT "AutoBid_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoBid" ADD CONSTRAINT "AutoBid_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionNotification" ADD CONSTRAINT "AuctionNotification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionNotification" ADD CONSTRAINT "AuctionNotification_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionReview" ADD CONSTRAINT "AuctionReview_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionReview" ADD CONSTRAINT "AuctionReview_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionReview" ADD CONSTRAINT "AuctionReview_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
