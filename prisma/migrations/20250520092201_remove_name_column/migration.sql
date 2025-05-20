/*
  Warnings:

  - You are about to drop the column `name` on the `TaskExecutor` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `TaskReporter` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TaskExecutor" DROP COLUMN "name";

-- AlterTable
ALTER TABLE "TaskReporter" DROP COLUMN "name";
