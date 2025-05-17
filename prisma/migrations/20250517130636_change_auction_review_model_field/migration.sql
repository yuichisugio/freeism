/*
  Warnings:

  - You are about to drop the column `is_seller_review` on the `AuctionReview` table. All the data in the column will be lost.
  - Added the required column `review_position` to the `AuctionReview` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReviewPosition" AS ENUM ('SELLER_TO_BUYER', 'BUYER_TO_SELLER');

-- DropIndex
DROP INDEX "AuctionReview_is_seller_review_idx";

-- AlterTable
ALTER TABLE "AuctionReview" DROP COLUMN "is_seller_review",
ADD COLUMN     "review_position" "ReviewPosition" NOT NULL;

-- CreateIndex
CREATE INDEX "AuctionReview_review_position_idx" ON "AuctionReview"("review_position");
