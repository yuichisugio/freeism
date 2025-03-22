/*
  Warnings:

  - You are about to drop the column `auction_end_time` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `auction_start_time` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "auction_end_time",
DROP COLUMN "auction_start_time";
