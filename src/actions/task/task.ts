"use server";

import { revalidatePath } from "next/cache";
import { checkIsPermission } from "@/actions/permission/permission";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";
import { TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクを削除するサーバーアクション
 * @param taskId 削除するタスクのID
 * @returns 処理結果を含むオブジェクト
 */
export async function deleteTask(taskId: string, userId: string): Promise<{ success: boolean; message: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクIDのチェック
     */
    if (!taskId || !userId) {
      throw new Error("タスクID or ユーザーIDが指定されていません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 権限チェック
     */
    const isOwner = await checkIsPermission(userId, undefined, taskId, true);
    if (!isOwner.success) {
      return { success: false, message: "このタスクを削除する権限がありません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクを取得
     */
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        groupId: true,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクが見つからない場合はエラーを返す
     */
    if (!task) {
      return { success: false, message: "タスクが見つかりません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクを削除
     */
    await prisma.task.delete({
      where: { id: taskId },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * キャッシュを再検証
     */
    revalidatePath(`/groups/${task.groupId}`);
    revalidatePath(`/dashboard/group/${task.groupId}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功を返却
     */
    return { success: true, message: "タスクを削除しました" };
  } catch (error) {
    console.error("タスク削除エラー:", error);
    return {
      success: false,
      message: `タスクの削除中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクのステータスを更新する関数
 * @param taskId - 更新するタスクのID
 * @param newStatus - 新しいステータス
 * @returns 処理結果を含むオブジェクト
 */
export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
): Promise<{ success: boolean; message: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーIDを取得
     */
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクの詳細情報を取得
     */
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        fixedContributionPoint: true,
        groupId: true,
        executors: {
          select: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクが見つからない場合はエラーを返す
     */
    if (!task) {
      throw new Error("Task not found");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 変更不可のステータスチェック
     */
    const immutableStatuses: TaskStatus[] = [TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED];
    if (immutableStatuses.includes(newStatus)) {
      throw new Error("このステータスのタスクは変更できません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 権限チェック
     */
    const isOwner = await checkIsPermission(userId, task.groupId, taskId, true);
    if (!isOwner.success) {
      throw new Error("このタスクのステータスを変更する権限がありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクを更新
     */
    await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ステータスが「POINTS_AWARDED」に変更。かつ「fixedContributionPoint」が設定されている場合、実行者にポイント付与処理を行う。
     */
    if (newStatus === TaskStatus.POINTS_AWARDED && task.fixedContributionPoint) {
      // GroupPointテーブルの残高を更新
      const contributionPoint = task.fixedContributionPoint;

      // 実行者のユーザーIDを取得（重複排除）
      const executorUserIds = task.executors.filter((e) => e.user?.id).map((e) => e.user!.id);
      const userIds = [...new Set(executorUserIds)];

      // 各ユーザーのGroupPointを更新
      for (const userId of userIds) {
        await prisma.groupPoint.upsert({
          where: {
            userId_groupId: {
              userId: userId,
              groupId: task.groupId,
            },
          },
          update: {
            balance: { increment: contributionPoint },
            fixedTotalPoints: { increment: contributionPoint },
          },
          create: {
            userId: userId,
            groupId: task.groupId,
            balance: contributionPoint,
            fixedTotalPoints: contributionPoint,
          },
        });
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功を返却
     */
    return { success: true, message: "タスクのステータスを更新しました" };
  } catch (error) {
    console.error("[UPDATE_TASK_STATUS]", error);
    return { success: false, message: "タスクのステータスの更新中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
