"use cache";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/library-setting/prisma";
import { TaskStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSV出力用データの型定義
 */
export type GroupTaskCsvDataItem = {
  タスクID: string;
  タスク内容: string;
  参照: string;
  証拠情報: string;
  ステータス: string;
  貢献ポイント: number;
  評価者: string;
  貢献タイプ: string;
  作成者: string;
  報告者: string;
  実行者: string;
  作成日: string;
  更新日: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのタスク情報をCSV形式でエクスポートする関数
 * @param groupId - グループID
 * @param startDate - 開始日
 * @param endDate - 終了日
 * @param onlyTaskCompleted - TASK_COMPLETEDステータスのタスクのみを取得するフラグ（分析用）
 * @returns CSV形式のタスク情報
 */
export async function cachedExportGroupTask(
  groupId: string,
  startDate?: Date,
  endDate?: Date,
  onlyTaskCompleted = false,
): Promise<GroupTaskCsvDataItem[]> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループIDが指定されているか確認
     */
    if (!groupId) {
      throw new Error("グループIDが指定されていません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリ条件を構築
     */
    const whereConditions: Prisma.TaskWhereInput = { groupId: groupId };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 日付範囲が指定されている場合、条件に追加
     */
    if (startDate || endDate) {
      whereConditions.createdAt = {};

      if (startDate) {
        whereConditions.createdAt.gte = startOfDay(startDate);
      }

      if (endDate) {
        whereConditions.createdAt.lte = endOfDay(endDate);
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 分析用の場合はTASK_COMPLETEDのタスクのみ対象にする
     */
    if (onlyTaskCompleted) {
      whereConditions.status = TaskStatus.TASK_COMPLETED;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクの並び順
     */
    const orderByConditions: Prisma.TaskOrderByWithRelationInput = {
      createdAt: "desc",
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクの取得
     */
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
            settings: {
              select: {
                username: true,
              },
            },
          },
        },
        reporters: {
          select: {
            name: true,
            user: {
              select: {
                settings: {
                  select: {
                    username: true,
                  },
                },
              },
            },
          },
        },
        executors: {
          select: {
            name: true,
            user: {
              select: {
                settings: {
                  select: {
                    username: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: orderByConditions,
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
    const formattedTasks: GroupTaskCsvDataItem[] = tasks.map((task) => ({
      タスクID: task.id,
      タスク内容: task.task,
      参照: task.reference ?? "",
      証拠情報: task.info ?? "",
      ステータス: task.status,
      貢献ポイント: task.fixedContributionPoint ?? 0,
      評価者: task.fixedEvaluatorId ?? "",
      貢献タイプ: task.contributionType,
      作成者: task.creator?.settings?.username ?? "未設定",
      報告者: task.reporters.map((r) => r.user?.settings?.username ?? r.name ?? "未設定").join(", "),
      実行者: task.executors.map((e) => e.user?.settings?.username ?? e.name ?? "未設定").join(", "),
      作成日: task.createdAt.toISOString().split("T")[0],
      更新日: task.updatedAt.toISOString().split("T")[0],
    }));

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスク情報を返す
     */
    return formattedTasks;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("[EXPORT_GROUP_TASK]", error);
    throw new Error(
      `グループのTask情報のエクスポート中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
  }
}
