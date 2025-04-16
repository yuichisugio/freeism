/*
  Warnings:

  - You are about to drop the `NotificationReadStatus` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "NotificationReadStatus" DROP CONSTRAINT "NotificationReadStatus_notificationId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationReadStatus" DROP CONSTRAINT "NotificationReadStatus_userId_fkey";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "isRead" JSONB NOT NULL DEFAULT '{}';

-- DropTable
DROP TABLE "NotificationReadStatus";
