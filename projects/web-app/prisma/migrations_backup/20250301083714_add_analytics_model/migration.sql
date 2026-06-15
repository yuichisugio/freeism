/*
  Warnings:

  - You are about to drop the column `contributionPoint` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "contributionPoint",
ADD COLUMN     "fixedContributionPoint" INTEGER;

-- CreateTable
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "contributionPoint" INTEGER NOT NULL,
    "evaluationLogic" TEXT NOT NULL,
    "evaluator" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Analytics_taskId_idx" ON "Analytics"("taskId");

-- CreateIndex
CREATE INDEX "Analytics_groupId_idx" ON "Analytics"("groupId");

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
