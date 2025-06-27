"use server";

import { redirect } from "next/navigation";
import { checkIsPermission } from "@/actions/permission/permission";
import { prisma } from "@/library-setting/prisma";
import { TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 有効なステータスの配列
 */
const validStatuses: TaskStatus[] = [
  "PENDING",
  "POINTS_DEPOSITED",
  "TASK_COMPLETED",
  "FIXED_EVALUATED",
  "POINTS_AWARDED",
  "ARCHIVED",
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスの更新に失敗した場合のデータ型
 */
export type FailedResult = {
  taskId: string;
  status: string;
  error: string;
  [key: string]: unknown;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスの更新に成功した場合のデータ型（簡素化）
 */
export type UpdatedTaskResult = {
  id: string;
  task: string;
  reference: string | null;
  status: string;
  contributionType: string;
  info: string | null;
  fixedContributionPoint: number | null;
  fixedEvaluatorId: string | null;
  fixedEvaluationLogic: string | null;
  fixedEvaluationDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  groupId: string;
  creatorId: string | null;
  userFixedSubmitterId: string | null;
  reporters: { userId: string | null }[];
  executors: { userId: string | null }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスを一括更新する関数
 * @param data タスクIDとステータスを含むデータ配列
 * @returns 処理結果を含むオブジェクト
 */
export async function bulkUpdateTaskStatus(
  data: Array<{
    taskId: string;
    status: string;
    [key: string]: unknown;
  }>,
  userId: string,
) {
  try {
    // ユーザーIDが指定されていない場合はログインページにリダイレクト
    if (!userId) {
      redirect("/auth/login");
    }

    const results: UpdatedTaskResult[] = [];
    const failedResults: FailedResult[] = [];

    // データごとに処理
    for (const item of data) {
      try {
        // 必須フィールドのチェック
        if (!item.taskId) {
          failedResults.push({ ...item, error: "タスクIDが指定されていません" });
          continue;
        }

        if (!item.status) {
          failedResults.push({ ...item, error: "ステータスが指定されていません" });
          continue;
        }

        // ステータスの有効性チェック
        if (!validStatuses.includes(item.status as TaskStatus)) {
          failedResults.push({ ...item, error: `無効なステータスです: ${item.status}` });
          continue;
        }

        // タスクの存在チェック
        const task = await prisma.task.findUnique({
          where: { id: item.taskId },
          select: {
            id: true,
            status: true,
            fixedContributionPoint: true,
            group: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!task) {
          failedResults.push({ ...item, error: "タスクが見つかりません" });
          continue;
        }

        // 権限チェック
        const isOwnerOrRoleCheck = await checkIsPermission(userId, task.group.id, undefined, true);

        // いずれかの権限がある場合のみ変更可能
        if (!isOwnerOrRoleCheck.success) {
          failedResults.push({ ...item, error: "このタスクのステータスを変更する権限がありません" });
          continue;
        }

        // 変更不可のステータスチェック（特定のステータスからは変更不可）
        const immutableStatuses: TaskStatus[] = [
          TaskStatus.FIXED_EVALUATED,
          TaskStatus.POINTS_AWARDED,
          TaskStatus.ARCHIVED,
        ];
        if (immutableStatuses.includes(task.status)) {
          failedResults.push({ ...item, error: `このステータス(${task.status})のタスクは変更できません` });
          continue;
        }

        // ステータス更新
        const updatedTask = await prisma.task.update({
          where: { id: item.taskId },
          data: { status: item.status as TaskStatus },
          select: {
            id: true,
            task: true,
            reference: true,
            status: true,
            contributionType: true,
            info: true,
            fixedContributionPoint: true,
            fixedEvaluatorId: true,
            fixedEvaluationLogic: true,
            fixedEvaluationDate: true,
            createdAt: true,
            updatedAt: true,
            groupId: true,
            creatorId: true,
            userFixedSubmitterId: true,
            reporters: {
              select: { userId: true },
            },
            executors: {
              select: { userId: true },
            },
          },
        });

        // ステータスがPOINTS_AWARDEDに変更されかつfixedContributionPointが設定されている場合、GroupPointを更新
        if (item.status === TaskStatus.POINTS_AWARDED && task.fixedContributionPoint) {
          const contributionPoint = task.fixedContributionPoint;

          // 報告者と実行者のユーザーIDを取得（重複排除）
          const reporterUserIds = updatedTask.reporters.filter((r) => r.userId).map((r) => r.userId!);
          const executorUserIds = updatedTask.executors.filter((e) => e.userId).map((e) => e.userId!);
          const userIds = [...new Set([...reporterUserIds, ...executorUserIds])];

          // 各ユーザーのGroupPointを更新
          for (const userId of userIds) {
            // 既存のGroupPointを検索
            const groupPoint = await prisma.groupPoint.findUnique({
              where: {
                userId_groupId: {
                  userId: userId,
                  groupId: task.group.id,
                },
              },
              select: { id: true },
            });

            // GroupPointが存在しなければ作成、存在すれば更新
            if (groupPoint) {
              await prisma.groupPoint.update({
                where: {
                  userId_groupId: {
                    userId: userId,
                    groupId: task.group.id,
                  },
                },
                data: {
                  balance: { increment: contributionPoint },
                  fixedTotalPoints: { increment: contributionPoint },
                },
              });
            } else {
              await prisma.groupPoint.create({
                data: {
                  userId: userId,
                  groupId: task.group.id,
                  balance: contributionPoint,
                  fixedTotalPoints: contributionPoint,
                },
              });
            }
          }
        }

        results.push(updatedTask);
      } catch (error) {
        console.error("個別タスクのステータス更新エラー:", error);
        failedResults.push({
          ...item,
          error: error instanceof Error ? error.message : "タスクステータスの更新中にエラーが発生しました",
        });
      }
    }

    return {
      success: true,
      updatedCount: results.length,
      failedCount: failedResults.length,
      failedData: failedResults.length > 0 ? failedResults : null,
    };
  } catch (error) {
    console.error("一括タスクステータス更新エラー:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "タスクステータスの一括更新中にエラーが発生しました",
    };
  }
}
