/*
  Warnings:

  - You are about to drop the column `expirationTime` on the `PushSubscription` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `PushSubscription` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[device_id]` on the table `PushSubscription` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "PushSubscription" DROP CONSTRAINT "PushSubscription_userId_fkey";

-- DropIndex
DROP INDEX "PushSubscription_userId_idx";

-- AlterTable
ALTER TABLE "PushSubscription" DROP COLUMN "expirationTime",
DROP COLUMN "userId",
ADD COLUMN     "device_id" TEXT,
ADD COLUMN     "expiration_time" TIMESTAMP(3),
ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "endpoint" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_device_id_key" ON "PushSubscription"("device_id");

-- CreateIndex
CREATE INDEX "PushSubscription_user_id_idx" ON "PushSubscription"("user_id");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
