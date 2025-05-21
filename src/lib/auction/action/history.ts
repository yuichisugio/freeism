"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
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
  const userId = await getAuthenticatedSessionUserId();

  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
    },
    select: {
      creatorId: true,
      executors: {
        select: {
          id: true,
        },
      },
      reporters: {
        select: {
          id: true,
        },
      },
      auction: {
        select: {
          winnerId: true,
        },
      },
    },
  });

  if (!task) {
    throw new Error("タスクが見つかりません");
  }

  // 自分が作成者か落札者か確認
  const isCreator = task.creatorId === userId;
  const isExecutor = task.executors.some((executor) => executor.id === userId);
  const isReporter = task.reporters.some((reporter) => reporter.id === userId);
  const isWinner = task.auction?.winnerId === userId;

  if (!isCreator && !isExecutor && !isReporter && !isWinner) {
    return {
      success: false,
      error: "このタスクを完了する権限がありません",
    };
  }

  // タスク完了ステータスに更新
  await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      status: TaskStatus.SUPPLIER_DONE,
    },
  });

  return {
    success: true,
  };
}
