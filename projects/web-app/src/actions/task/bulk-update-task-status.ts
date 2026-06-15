"use server";

import { redirect } from "next/navigation";
import { checkIsPermission } from "@/actions/permission/permission";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";
import { TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスの更新に失敗した場合のデータ型
 */
export type FailedResult = {
  taskId: string;
  status: TaskStatus;
  error: string;
};

/**
 * 一括タスクステータス更新の返却値の型
 */
type BulkUpdateTaskStatusReturn = {
  updatedCount: number;
  failedCount: number;
  failedData: FailedResult[] | null;
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
    status: TaskStatus;
  }>,
  userId: string,
): PromiseResult<BulkUpdateTaskStatusReturn> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDが指定されていない場合はログインページにリダイレクト
   */
  if (!userId) {
    redirect("/auth/login");
  }

  /**
   * データが指定されていない場合はエラーを返却
   */
  if (data.length === 0) {
    throw new Error("データが指定されていません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 結果を返却
   */
  // 成功した場合
  const results: { id: string }[] = [];

  // 失敗した場合
  const failedResults: FailedResult[] = [];

  // データごとに処理
  for (const item of data) {
    try {
      const { taskId, status } = item;

      // 必須フィールドのチェック
      if (!taskId) {
        failedResults.push({ ...item, error: "タスクIDが指定されていません" });
        continue;
      }

      if (!status) {
        failedResults.push({ ...item, error: "ステータスが指定されていません" });
        continue;
      }

      // ステータスの有効性チェック
      if (!Object.values(TaskStatus).includes(status)) {
        failedResults.push({ ...item, error: `無効なステータスです: ${status}` });
        continue;
      }

      // タスクの存在チェック
      const task = await prisma.task.findUnique({
        where: { id: taskId },
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
      const isOwnerOrRoleCheck = await checkIsPermission(userId, task.group.id, taskId, true);

      // いずれかの権限がある場合のみ変更可能
      if (!isOwnerOrRoleCheck.success) {
        failedResults.push({ ...item, error: "このタスクのステータスを変更する権限がありません" });
        continue;
      }

      // 変更不可のステータスチェック（特定のステータスからは変更不可）
      const immutableStatuses: TaskStatus[] = [TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED];
      if (immutableStatuses.includes(task.status)) {
        failedResults.push({ ...item, error: `このステータス(${task.status})のタスクは変更できません` });
        continue;
      }

      // ステータス更新
      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: { status },
        select: {
          id: true,
        },
      });

      results.push(updatedTask);
    } catch (error) {
      console.error("個別タスクのステータス更新エラー:", error);
      failedResults.push({
        ...item,
        error: error instanceof Error ? error.message : "タスクステータスの更新中にエラーが発生しました",
      });
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 結果を返却
   */
  return {
    success: failedResults.length === 0,
    message: "タスクステータスの一括更新が完了しました",
    data: {
      updatedCount: results.length,
      failedCount: failedResults.length,
      failedData: failedResults.length > 0 ? failedResults : null,
    },
  };
}
