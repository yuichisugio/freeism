/*
  Warnings:

  - You are about to drop the column `device_id` on the `PushSubscription` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "PushSubscription_device_id_key";

-- AlterTable
ALTER TABLE "PushSubscription" DROP COLUMN "device_id";
