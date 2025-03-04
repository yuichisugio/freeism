/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `isRead` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `readAt` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Notification` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Notification_isRead_idx";

-- DropIndex
DROP INDEX "Notification_priority_idx";

-- DropIndex
DROP INDEX "Notification_sentAt_idx";

-- AlterTable
ALTER TABLE "GroupMembership" ADD COLUMN     "isGroupOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "createdAt",
DROP COLUMN "isRead",
DROP COLUMN "readAt",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAppOwner" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NotificationReadStatus" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NotificationReadStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationReadStatus_userId_idx" ON "NotificationReadStatus"("userId");

-- CreateIndex
CREATE INDEX "NotificationReadStatus_notificationId_idx" ON "NotificationReadStatus"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationReadStatus_notificationId_userId_key" ON "NotificationReadStatus"("notificationId", "userId");

-- AddForeignKey
ALTER TABLE "NotificationReadStatus" ADD CONSTRAINT "NotificationReadStatus_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationReadStatus" ADD CONSTRAINT "NotificationReadStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
