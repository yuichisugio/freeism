/*
  Warnings:

  - The `contributionType` column on the `Task` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "contributionType" AS ENUM ('REWARD', 'NON_REWARD');

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "contributionType",
ADD COLUMN     "contributionType" "contributionType" NOT NULL DEFAULT 'NON_REWARD';
