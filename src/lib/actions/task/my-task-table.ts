"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーのタスクを取得
 * @returns ユーザーのタスク
 */
export async function getMyTaskData() {
  try {
    // ログインしているユーザーの情報を取得
    const userId = await getAuthenticatedSessionUserId();

    // ユーザーのタスクを取得（作成者、報告者、実行者のいずれかが自分のタスク）
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          // 自分が作成者のタスク
          { creatorId: userId },
          // 自分が報告者として含まれるタスク
          {
            reporters: {
              some: {
                userId: userId,
              },
            },
          },
          // 自分が実行者として含まれるタスク
          {
            executors: {
              some: {
                userId: userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        task: true,
        detail: true,
        reference: true,
        info: true,
        imageUrl: true,
        contributionType: true,
        category: true,
        deliveryMethod: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        fixedContributionPoint: true,
        fixedEvaluator: true,
        fixedEvaluationLogic: true,
        creator: {
          select: {
            name: true,
            id: true,
          },
        },
        reporters: {
          select: {
            id: true,
            name: true,
            userId: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        executors: {
          select: {
            id: true,
            name: true,
            userId: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        group: {
          select: {
            name: true,
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return tasks;
  } catch (error) {
    console.error("[GET_MY_TASK_DATA]", error);
    throw new Error("タスク情報の取得中にエラーが発生しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
