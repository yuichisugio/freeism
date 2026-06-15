/*
  Warnings:

  - The `status` column on the `Task` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Supply` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'BIDDED', 'POINTS_DEPOSITED', 'TASK_COMPLETED', 'GROUP_REVIEW_COMPLETED', 'EXTERNAL_REVIEW_COMPLETED', 'POINTS_AWARDED', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "Supply" DROP CONSTRAINT "Supply_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Supply" DROP CONSTRAINT "Supply_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Supply" DROP CONSTRAINT "Supply_userId_fkey";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "status",
ADD COLUMN     "status" "TaskStatus" NOT NULL DEFAULT 'PENDING';

-- DropTable
DROP TABLE "Supply";
