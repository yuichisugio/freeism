"use server";

import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSV出力用データの型定義
 */
type CsvDataItem = {
  分析ID: string;
  タスクID: string;
  貢献ポイント: number;
  評価ロジック: string;
  評価者ID: string;
  評価者名: string;
  タスク内容: string;
  参照情報: string;
  証拠情報: string;
  ステータス: string;
  貢献タイプ: string;
  タスク報告者: string;
  タスク実行者: string;
  タスク作成者: string;
  グループ目標: string | null;
  評価方法: string | null;
  作成日: string;
  評価日?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループの分析結果をCSV形式でエクスポートする関数
 * @param groupId - グループID
 * @param page - 取得するページ番号（1ページ200件）
 * @param onlyFixed - FIX済みの分析結果のみを取得するフラグ
 * @param onlyTaskCompleted - TASK_COMPLETEDステータスのタスクのみを取得するフラグ（分析用）
 * @returns 評価者ごとに分けられたCSVデータ
 */
export async function exportGroupAnalytics(groupId: string, page = 1, onlyFixed = false, onlyTaskCompleted = false) {
  try {
    // ページごとの件数（要件に合わせて200件に変更）
    const limit = 200;
    const offset = (page - 1) * limit;

    // グループの詳細情報を取得
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true, goal: true, evaluationMethod: true },
    });

    if (!group) {
      return { error: "グループが見つかりません" };
    }

    // クエリ条件を構築
    const whereConditions: {
      groupId: string;
      AND?: {
        status: TaskStatus;
      }[];
    } = { groupId };

    // FIX済みのみの条件
    if (onlyFixed) {
      whereConditions.AND = [{ status: TaskStatus.POINTS_AWARDED }];
    } else if (onlyTaskCompleted) {
      // FIX済み条件がオフで、分析用の場合はTASK_COMPLETEDのみを対象とする
      whereConditions.AND = [{ status: TaskStatus.TASK_COMPLETED }];
    }

    // タスク数を取得
    const tasksCount = await prisma.task.count({
      where: whereConditions,
    });

    const totalPages = Math.ceil(tasksCount / limit);

    // タスクを取得（selectのみ使用）
    const tasks = await prisma.task.findMany({
      where: whereConditions,
      skip: offset,
      take: limit,
      select: {
        id: true,
        task: true,
        reference: true,
        status: true,
        contributionType: true,
        info: true,
        fixedContributionPoint: true,
        fixedEvaluatorId: true,
        fixedEvaluationLogic: true,
        fixedEvaluationDate: true,
        userFixedSubmitterId: true,
        creator: {
          select: {
            id: true,
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
    });

    // 固定評価者のユーザー情報を一括取得
    const evaluatorIds = tasks.map((task) => task.fixedEvaluatorId).filter((id): id is string => id !== null);

    const evaluators =
      evaluatorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: evaluatorIds } },
            select: { id: true, name: true },
          })
        : [];

    // 評価者マップを作成
    const evaluatorMap = new Map(evaluators.map((user) => [user.id, user.name]));

    // CSV用データを作成
    const groupedByEvaluator: Record<string, CsvDataItem[]> = {};

    tasks.forEach((task) => {
      const evaluatorName = task.fixedEvaluatorId ? (evaluatorMap.get(task.fixedEvaluatorId) ?? "未割り当て") : "未割り当て";

      // 報告者と実行者の名前を抽出
      const reporterNames = task.reporters
        .map((r) => r.user?.name ?? r.name ?? "")
        .filter((name) => name.length > 0)
        .join(", ");

      const executorNames = task.executors
        .map((e) => e.user?.name ?? e.name ?? "")
        .filter((name) => name.length > 0)
        .join(", ");

      // CSV用のデータ構造を作成
      const csvData: CsvDataItem = {
        分析ID: task.id,
        タスクID: task.id,
        貢献ポイント: task.fixedContributionPoint ?? 0,
        評価ロジック: task.fixedEvaluationLogic ?? "",
        評価者ID: task.fixedEvaluatorId ?? "",
        評価者名: evaluatorName,
        タスク内容: task.task,
        参照情報: task.reference ?? "",
        証拠情報: task.info ?? "",
        ステータス: task.status,
        貢献タイプ: task.contributionType,
        タスク報告者: reporterNames,
        タスク実行者: executorNames,
        タスク作成者: task.creator?.name ?? "",
        グループ目標: group.goal,
        評価方法: group.evaluationMethod,
        作成日: task.fixedEvaluationDate ? task.fixedEvaluationDate.toISOString().split("T")[0] : "",
      };

      // FIX済みの場合は評価日を追加
      if (onlyFixed && task.fixedEvaluationDate) {
        csvData.評価日 = task.fixedEvaluationDate.toISOString().split("T")[0];
      }

      // 評価者ごとのグループに追加
      if (!groupedByEvaluator[evaluatorName]) {
        groupedByEvaluator[evaluatorName] = [];
      }
      groupedByEvaluator[evaluatorName].push(csvData);
    });

    return {
      data: groupedByEvaluator,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    console.error("[EXPORT_GROUP_ANALYTICS]", error);
    return { error: "分析データのエクスポート中にエラーが発生しました" };
  }
}
