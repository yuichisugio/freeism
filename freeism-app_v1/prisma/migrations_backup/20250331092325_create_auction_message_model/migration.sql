-- CreateTable
CREATE TABLE "AuctionMessage" (
    "id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuctionMessage_auction_id_idx" ON "AuctionMessage"("auction_id");

-- CreateIndex
CREATE INDEX "AuctionMessage_sender_id_idx" ON "AuctionMessage"("sender_id");

-- CreateIndex
CREATE INDEX "AuctionMessage_recipient_id_idx" ON "AuctionMessage"("recipient_id");

-- AddForeignKey
ALTER TABLE "AuctionMessage" ADD CONSTRAINT "AuctionMessage_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionMessage" ADD CONSTRAINT "AuctionMessage_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionMessage" ADD CONSTRAINT "AuctionMessage_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
