"use server";

import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理アクション
 * @param taskId タスクID
 */
export async function completeTaskDelivery(taskId: string): Promise<{
  success: boolean;
  error?: string;
}> {
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
  };
}
