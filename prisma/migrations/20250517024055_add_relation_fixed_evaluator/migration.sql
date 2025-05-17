/*
  Warnings:

  - You are about to drop the column `fixed_evaluator` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "fixed_evaluator",
ADD COLUMN     "fixed_evaluator_id" TEXT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_fixed_evaluator_id_fkey" FOREIGN KEY ("fixed_evaluator_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
