/*
  Warnings:

  - The values [GROUP_REVIEW_COMPLETED,EXTERNAL_REVIEW_COMPLETED] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- まず、削除対象のENUM値を使用しているレコードを別の状態に更新
UPDATE "Task"
SET "status" = 'TASK_COMPLETED'
WHERE "status" IN ('GROUP_REVIEW_COMPLETED', 'EXTERNAL_REVIEW_COMPLETED');

-- BIDDEDステータスのタスクもPENDINGに更新（現在のスキーマにBIDDEDがないため）
UPDATE "Task"
SET "status" = 'PENDING'
WHERE "status" = 'BIDDED';

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('PENDING', 'POINTS_DEPOSITED', 'TASK_COMPLETED', 'FIXED_EVALUATED', 'POINTS_AWARDED', 'ARCHIVED');
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "TaskStatus_old";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
