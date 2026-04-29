/*
  Warnings:

  - You are about to drop the column `priority` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `Notification` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_user_id_fkey";

-- DropIndex
DROP INDEX "Notification_user_id_idx";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "priority",
DROP COLUMN "type",
DROP COLUMN "user_id",
ADD COLUMN     "sender_user_id" TEXT;

-- DropEnum
DROP TYPE "NotificationType";

-- CreateIndex
CREATE INDEX "Notification_sender_user_id_idx" ON "Notification"("sender_user_id");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
