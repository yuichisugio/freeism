"use server";

import { prisma } from "@/library-setting/prisma";
import { type TaskStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのタスク情報をCSV形式でエクスポートする関数
 * @param groupId - グループID
 * @param startDate - 開始日
 * @param endDate - 終了日
 * @param onlyTaskCompleted - TASK_COMPLETEDステータスのタスクのみを取得するフラグ（分析用）
 * @returns CSV形式のタスク情報
 */
export async function exportGroupTask(groupId: string, startDate?: Date, endDate?: Date, onlyTaskCompleted = false) {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリ条件を構築
     */
    const whereConditions: {
      groupId: string;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
      status?: TaskStatus;
    } = { groupId };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 日付範囲が指定されている場合、条件に追加
     */
    if (startDate) {
      whereConditions.createdAt = {
        ...whereConditions.createdAt,
        gte: startOfDay(startDate),
      };
    }

    if (endDate) {
      whereConditions.createdAt = {
        ...whereConditions.createdAt,
        lte: endOfDay(endDate),
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 分析用の場合はTASK_COMPLETEDのタスクのみ対象にする
     */
    if (onlyTaskCompleted) {
      whereConditions.status = "TASK_COMPLETED" as TaskStatus;
    }

    // タスクを取得（selectのみ使用）
    const tasks = await prisma.task.findMany({
      where: whereConditions,
      select: {
        id: true,
        task: true,
        reference: true,
        status: true,
        contributionType: true,
        info: true,
        fixedContributionPoint: true,
        fixedEvaluatorId: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: {
            name: true,
          },
        },
        reporters: {
          select: {
            name: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        executors: {
          select: {
            name: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクが見つからない場合はエラーを返す
     */
    if (!tasks || tasks.length === 0) {
      throw new Error("タスクが見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクのユーザー名を取得
     */
    const formattedTasks = tasks.map((task) => {
      // 報告者と実行者の名前をカンマ区切りで連結
      const reporterNames = task.reporters.map((r) => r.user?.name ?? r.name ?? "不明").join(", ");
      const executorNames = task.executors.map((e) => e.user?.name ?? e.name ?? "不明").join(", ");

      return {
        タスクID: task.id,
        タスク内容: task.task,
        参照: task.reference ?? "",
        証拠情報: task.info ?? "",
        ステータス: task.status,
        貢献ポイント: task.fixedContributionPoint ?? 0,
        評価者: task.fixedEvaluatorId ?? "",
        貢献タイプ: task.contributionType,
        作成者: task.creator?.name ?? "不明",
        報告者: reporterNames,
        実行者: executorNames,
        作成日: task.createdAt.toISOString().split("T")[0],
        更新日: task.updatedAt.toISOString().split("T")[0],
      };
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスク情報を返す
     */
    return formattedTasks;
  } catch (error) {
    console.error("[EXPORT_GROUP_TASK]", error);
    throw new Error("グループのTask情報のエクスポート中にエラーが発生しました");
  }
}
