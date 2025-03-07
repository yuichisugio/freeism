-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "fixedEvaluationDate" TIMESTAMP(3),
ADD COLUMN     "userFixedDataSubmitterId" TEXT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userFixedDataSubmitterId_fkey" FOREIGN KEY ("userFixedDataSubmitterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
