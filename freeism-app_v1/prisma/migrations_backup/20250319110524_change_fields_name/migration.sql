/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `providerAccountId` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `contributionPoint` on the `Analytics` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Analytics` table. All the data in the column will be lost.
  - You are about to drop the column `evaluationLogic` on the `Analytics` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `Analytics` table. All the data in the column will be lost.
  - You are about to drop the column `taskId` on the `Analytics` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Analytics` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `evaluationMethod` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `isBlackList` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `GroupMembership` table. All the data in the column will be lost.
  - You are about to drop the column `isGroupOwner` on the `GroupMembership` table. All the data in the column will be lost.
  - You are about to drop the column `joinedAt` on the `GroupMembership` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `GroupMembership` table. All the data in the column will be lost.
  - You are about to drop the column `actionUrl` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `sentAt` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `targetType` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `taskId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `sessionToken` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `contributionType` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `creatorId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `fixedContributionPoint` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `fixedEvaluationDate` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `fixedEvaluationLogic` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `fixedEvaluator` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `userFixedSubmitterId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `TaskExecutor` table. All the data in the column will be lost.
  - You are about to drop the column `taskId` on the `TaskExecutor` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `TaskExecutor` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `TaskExecutor` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `TaskReporter` table. All the data in the column will be lost.
  - You are about to drop the column `taskId` on the `TaskReporter` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `TaskReporter` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `TaskReporter` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isAppOwner` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `UserSettings` table. All the data in the column will be lost.
  - You are about to drop the column `lifeGoal` on the `UserSettings` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `UserSettings` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `UserSettings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[provider,provider_account_id]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,group_id]` on the table `GroupMembership` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[session_token]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `UserSettings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `provider_account_id` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contribution_point` to the `Analytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `evaluation_logic` to the `Analytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `group_id` to the `Analytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `task_id` to the `Analytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Analytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_by` to the `Group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `evaluation_method` to the `Group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `group_id` to the `GroupMembership` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `GroupMembership` table without a default value. This is not possible if the table is not empty.
  - Added the required column `target_type` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `session_token` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creator_id` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `task_id` to the `TaskExecutor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `TaskExecutor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `task_id` to the `TaskReporter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `TaskReporter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `life_goal` to the `UserSettings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `UserSettings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `UserSettings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Analytics" DROP CONSTRAINT "Analytics_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Analytics" DROP CONSTRAINT "Analytics_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Group" DROP CONSTRAINT "Group_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "GroupMembership" DROP CONSTRAINT "GroupMembership_groupId_fkey";

-- DropForeignKey
ALTER TABLE "GroupMembership" DROP CONSTRAINT "GroupMembership_userId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_userFixedSubmitterId_fkey";

-- DropForeignKey
ALTER TABLE "TaskExecutor" DROP CONSTRAINT "TaskExecutor_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskExecutor" DROP CONSTRAINT "TaskExecutor_userId_fkey";

-- DropForeignKey
ALTER TABLE "TaskReporter" DROP CONSTRAINT "TaskReporter_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskReporter" DROP CONSTRAINT "TaskReporter_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserSettings" DROP CONSTRAINT "UserSettings_userId_fkey";

-- DropIndex
DROP INDEX "Account_provider_providerAccountId_key";

-- DropIndex
DROP INDEX "Account_userId_idx";

-- DropIndex
DROP INDEX "Analytics_groupId_idx";

-- DropIndex
DROP INDEX "Analytics_taskId_idx";

-- DropIndex
DROP INDEX "Group_createdBy_idx";

-- DropIndex
DROP INDEX "GroupMembership_groupId_idx";

-- DropIndex
DROP INDEX "GroupMembership_userId_groupId_key";

-- DropIndex
DROP INDEX "GroupMembership_userId_idx";

-- DropIndex
DROP INDEX "Notification_groupId_idx";

-- DropIndex
DROP INDEX "Notification_taskId_idx";

-- DropIndex
DROP INDEX "Notification_userId_idx";

-- DropIndex
DROP INDEX "Session_sessionToken_key";

-- DropIndex
DROP INDEX "Task_creatorId_idx";

-- DropIndex
DROP INDEX "TaskExecutor_taskId_idx";

-- DropIndex
DROP INDEX "TaskExecutor_userId_idx";

-- DropIndex
DROP INDEX "TaskReporter_taskId_idx";

-- DropIndex
DROP INDEX "TaskReporter_userId_idx";

-- DropIndex
DROP INDEX "UserSettings_userId_key";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "createdAt",
DROP COLUMN "providerAccountId",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "provider_account_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Analytics" DROP COLUMN "contributionPoint",
DROP COLUMN "createdAt",
DROP COLUMN "evaluationLogic",
DROP COLUMN "groupId",
DROP COLUMN "taskId",
DROP COLUMN "updatedAt",
ADD COLUMN     "contribution_point" INTEGER NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "evaluation_logic" TEXT NOT NULL,
ADD COLUMN     "group_id" TEXT NOT NULL,
ADD COLUMN     "task_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "createdAt",
DROP COLUMN "createdBy",
DROP COLUMN "evaluationMethod",
DROP COLUMN "isBlackList",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT NOT NULL,
ADD COLUMN     "evaluation_method" TEXT NOT NULL,
ADD COLUMN     "is_black_list" JSONB,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "GroupMembership" DROP COLUMN "groupId",
DROP COLUMN "isGroupOwner",
DROP COLUMN "joinedAt",
DROP COLUMN "userId",
ADD COLUMN     "group_id" TEXT NOT NULL,
ADD COLUMN     "is_group_owner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "actionUrl",
DROP COLUMN "expiresAt",
DROP COLUMN "groupId",
DROP COLUMN "sentAt",
DROP COLUMN "targetType",
DROP COLUMN "taskId",
DROP COLUMN "userId",
ADD COLUMN     "action_url" TEXT,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "group_id" TEXT,
ADD COLUMN     "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "target_type" "NotificationTargetType" NOT NULL,
ADD COLUMN     "task_id" TEXT,
ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "createdAt",
DROP COLUMN "sessionToken",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "session_token" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "contributionType",
DROP COLUMN "createdAt",
DROP COLUMN "creatorId",
DROP COLUMN "fixedContributionPoint",
DROP COLUMN "fixedEvaluationDate",
DROP COLUMN "fixedEvaluationLogic",
DROP COLUMN "fixedEvaluator",
DROP COLUMN "imageUrl",
DROP COLUMN "updatedAt",
DROP COLUMN "userFixedSubmitterId",
ADD COLUMN     "contribution_type" "contributionType" NOT NULL DEFAULT 'NON_REWARD',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "creator_id" TEXT NOT NULL,
ADD COLUMN     "fixed_contribution_point" INTEGER,
ADD COLUMN     "fixed_evaluation_date" TIMESTAMP(3),
ADD COLUMN     "fixed_evaluation_logic" TEXT,
ADD COLUMN     "fixed_evaluator" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_fixed_submitter_id" TEXT;

-- AlterTable
ALTER TABLE "TaskExecutor" DROP COLUMN "createdAt",
DROP COLUMN "taskId",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "task_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "TaskReporter" DROP COLUMN "createdAt",
DROP COLUMN "taskId",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "task_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt",
DROP COLUMN "emailVerified",
DROP COLUMN "isAppOwner",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email_verified" TIMESTAMP(3),
ADD COLUMN     "is_app_owner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "UserSettings" DROP COLUMN "createdAt",
DROP COLUMN "lifeGoal",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "life_goal" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Account_user_id_idx" ON "Account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_provider_account_id_key" ON "Account"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "Analytics_task_id_idx" ON "Analytics"("task_id");

-- CreateIndex
CREATE INDEX "Analytics_group_id_idx" ON "Analytics"("group_id");

-- CreateIndex
CREATE INDEX "Group_created_by_idx" ON "Group"("created_by");

-- CreateIndex
CREATE INDEX "GroupMembership_user_id_idx" ON "GroupMembership"("user_id");

-- CreateIndex
CREATE INDEX "GroupMembership_group_id_idx" ON "GroupMembership"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_user_id_group_id_key" ON "GroupMembership"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "Notification_user_id_idx" ON "Notification"("user_id");

-- CreateIndex
CREATE INDEX "Notification_group_id_idx" ON "Notification"("group_id");

-- CreateIndex
CREATE INDEX "Notification_task_id_idx" ON "Notification"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "Session_session_token_key" ON "Session"("session_token");

-- CreateIndex
CREATE INDEX "Task_creator_id_idx" ON "Task"("creator_id");

-- CreateIndex
CREATE INDEX "TaskExecutor_user_id_idx" ON "TaskExecutor"("user_id");

-- CreateIndex
CREATE INDEX "TaskExecutor_task_id_idx" ON "TaskExecutor"("task_id");

-- CreateIndex
CREATE INDEX "TaskReporter_user_id_idx" ON "TaskReporter"("user_id");

-- CreateIndex
CREATE INDEX "TaskReporter_task_id_idx" ON "TaskReporter"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_user_id_key" ON "UserSettings"("user_id");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_user_fixed_submitter_id_fkey" FOREIGN KEY ("user_fixed_submitter_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReporter" ADD CONSTRAINT "TaskReporter_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReporter" ADD CONSTRAINT "TaskReporter_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecutor" ADD CONSTRAINT "TaskExecutor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecutor" ADD CONSTRAINT "TaskExecutor_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
