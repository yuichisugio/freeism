-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'AUCTION_CANCELED';

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "is_extension" BOOLEAN NOT NULL DEFAULT false;
