"use server";

import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";
import { TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理アクション
 * @param taskId タスクID
 */
export async function completeTaskDelivery(taskId: string): PromiseResult<null> {
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
      message: "タスク完了処理に成功しました",
      data: null,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("completeTaskDelivery: タスク完了処理アクションに失敗しました", error);
    return {
      success: false,
      message: `completeTaskDelivery: タスク完了処理アクションに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      data: null,
    };
  }
}
