"use server";

import { prisma } from "@/library-setting/prisma";
import { TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理アクション
 * @param taskId タスクID
 */
export async function completeTaskDelivery(taskId: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // タスクIDが存在しない場合はエラーを返す
    if (!taskId) {
      throw new Error("completeTaskDelivery: タスクIDが存在しません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // タスク完了ステータスに更新
    await prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        status: TaskStatus.TASK_COMPLETED,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      success: true,
      error: null, // エラーがない場合はnullを返す
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("completeTaskDelivery: タスク完了処理アクションに失敗しました", error);
    return {
      success: false,
      error: `completeTaskDelivery: タスク完了処理アクションに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}
