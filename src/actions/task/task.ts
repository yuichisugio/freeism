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
     * タスクIDとユーザーIDの基本検証
     */
    if (
      !taskId ||
      typeof taskId !== "string" ||
      taskId.trim() === "" ||
      !userId ||
      typeof userId !== "string" ||
      userId.trim() === ""
    ) {
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
     * ステータスが有効かどうかをチェック
     */
    if (newStatus === null || newStatus === undefined || !Object.values(TaskStatus).includes(newStatus)) {
      throw new Error("無効なステータスです");
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
      throw new Error("タスクが見つかりません");
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
     * 成功を返却
     */
    return { success: true, message: "タスクのステータスを更新しました" };
  } catch (error) {
    console.error("[UPDATE_TASK_STATUS]", error);
    return {
      success: false,
      message: `${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
