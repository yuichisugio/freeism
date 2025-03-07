/*
  Warnings:

  - You are about to drop the column `userFixedDataSubmitterId` on the `Task` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_userFixedDataSubmitterId_fkey";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "userFixedDataSubmitterId",
ADD COLUMN     "userFixedSubmitterId" TEXT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userFixedSubmitterId_fkey" FOREIGN KEY ("userFixedSubmitterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
