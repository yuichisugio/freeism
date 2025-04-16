-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "priority" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");
