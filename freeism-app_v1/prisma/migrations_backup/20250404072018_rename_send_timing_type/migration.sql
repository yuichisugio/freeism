/*
  Warnings:

  - You are about to drop the column `send_timing` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `send_timing_type` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "send_timing",
ADD COLUMN     "send_timing_type" "NotificationSendTiming" NOT NULL;
