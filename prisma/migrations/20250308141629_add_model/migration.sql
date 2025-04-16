/*
  Warnings:

  - You are about to drop the column `userId` on the `Task` table. All the data in the column will be lost.
  - Added the required column `creatorId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_userId_fkey') THEN
    ALTER TABLE "Task" DROP CONSTRAINT "Task_userId_fkey";
  END IF;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "Task_userId_idx";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "creatorId" TEXT;

-- 既存のTaskレコードのuserIdをcreatorIdにコピー
UPDATE "Task" SET "creatorId" = "userId" WHERE "userId" IS NOT NULL;

-- creatorIdをNOT NULLに設定
ALTER TABLE "Task" ALTER COLUMN "creatorId" SET NOT NULL;

-- 最後にuserIdを削除
ALTER TABLE "Task" DROP COLUMN IF EXISTS "userId";

-- CreateTable
CREATE TABLE "TaskReporter" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskReporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskExecutor" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskExecutor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskReporter_userId_idx" ON "TaskReporter"("userId");

-- CreateIndex
CREATE INDEX "TaskReporter_taskId_idx" ON "TaskReporter"("taskId");

-- CreateIndex
CREATE INDEX "TaskExecutor_userId_idx" ON "TaskExecutor"("userId");

-- CreateIndex
CREATE INDEX "TaskExecutor_taskId_idx" ON "TaskExecutor"("taskId");

-- CreateIndex
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReporter" ADD CONSTRAINT "TaskReporter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReporter" ADD CONSTRAINT "TaskReporter_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecutor" ADD CONSTRAINT "TaskExecutor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecutor" ADD CONSTRAINT "TaskExecutor_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
