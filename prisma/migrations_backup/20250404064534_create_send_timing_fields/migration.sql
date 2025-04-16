/*
  Warnings:

  - Added the required column `send_timing` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NotificationSendTiming" AS ENUM ('NOW', 'SCHEDULED');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "send_timing" "NotificationSendTiming" NOT NULL;
