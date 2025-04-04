-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "send_scheduled_date" TIMESTAMP(3),
ALTER COLUMN "sent_at" DROP NOT NULL,
ALTER COLUMN "sent_at" DROP DEFAULT;
