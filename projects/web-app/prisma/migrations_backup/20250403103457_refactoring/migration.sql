/*
  Warnings:

  - You are about to drop the column `createdAt` on the `PushSubscription` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `PushSubscription` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `AuctionMessage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `AuctionNotification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `AuctionReview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `GroupMembership` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `PushSubscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `TaskWatchList` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `VerificationToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuctionMessage" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "AuctionNotification" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "AuctionReview" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "GroupMembership" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PushSubscription" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "TaskWatchList" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
