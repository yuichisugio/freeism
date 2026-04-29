/*
  Warnings:

  - You are about to drop the column `evaluationLogic` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `evaluator` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "evaluationLogic",
DROP COLUMN "evaluator",
ADD COLUMN     "fixedEvaluationLogic" TEXT,
ADD COLUMN     "fixedEvaluator" TEXT;
