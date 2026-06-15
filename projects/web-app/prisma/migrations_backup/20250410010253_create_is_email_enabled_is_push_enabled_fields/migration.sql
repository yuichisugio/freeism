-- AlterTable
ALTER TABLE "User" ADD COLUMN     "is_email_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_push_enabled" BOOLEAN NOT NULL DEFAULT false;
