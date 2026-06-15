"use cache";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";
import { TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSV出力用データの型定義
 */
export type GroupAnalyticsCsvDataItem = {
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
 * 分析データエクスポートの戻り値型定義
 */
export type GroupAnalyticsExportReturn = {
  data: Record<string, GroupAnalyticsCsvDataItem[]>;
  totalPages: number;
  currentPage: number;
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
export async function cachedExportGroupAnalytics(
  groupId: string,
  page = 1,
  onlyFixed = false,
  onlyTaskCompleted = false,
  limit = 200,
): PromiseResult<GroupAnalyticsExportReturn> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータのバリデーション
   */
  if (
    !groupId ||
    page <= 0 ||
    page === undefined ||
    page === null ||
    typeof page !== "number" ||
    typeof onlyFixed !== "boolean" ||
    typeof onlyTaskCompleted !== "boolean" ||
    onlyFixed === undefined ||
    onlyTaskCompleted === undefined ||
    onlyFixed === null ||
    onlyTaskCompleted === null ||
    limit <= 0 ||
    limit === undefined ||
    limit === null ||
    typeof limit !== "number"
  ) {
    throw new Error("パラメータが不正です");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリ条件を構築
   */
  const whereConditions: Prisma.TaskWhereInput = { groupId };

  // FIX済みのみの条件
  if (onlyFixed) {
    whereConditions.status = TaskStatus.POINTS_AWARDED;
  } else if (onlyTaskCompleted) {
    // FIX済み条件がオフで、分析用の場合はTASK_COMPLETEDのみを対象とする
    whereConditions.status = TaskStatus.TASK_COMPLETED;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク数を取得
   */
  const tasksCount = await prisma.task.count({
    where: whereConditions,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページングの計算
   */
  const totalPages = Math.ceil(tasksCount / limit);
  const offset = (page - 1) * limit;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクを取得
   */
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
          settings: {
            select: {
              username: true,
            },
          },
        },
      },
      reporters: {
        select: {
          user: {
            select: {
              id: true,
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
          user: {
            select: {
              id: true,
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
  });

  if (!tasks) {
    throw new Error("タスクが見つかりません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループの詳細情報を取得
   */
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { name: true, goal: true, evaluationMethod: true },
  });

  if (!group) {
    throw new Error("グループが見つかりません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 固定評価者のユーザー情報を一括取得
   */
  const evaluatorIds = tasks.map((task) => task.fixedEvaluatorId).filter((id): id is string => id !== null);

  const evaluators =
    evaluatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: evaluatorIds } },
          select: { id: true, settings: { select: { username: true } } },
        })
      : [];

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価者マップを作成
   */
  const evaluatorMap = new Map(evaluators.map((user) => [user.id, user.settings?.username ?? `未設定_${user.id}`]));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * CSV用データを作成
   * 評価者ごとに、評価者の名前をキーにして、評価した値のデータを配列に入れて、CSV用のデータを作成
   */
  const groupedByEvaluator: GroupAnalyticsExportReturn["data"] = {};

  tasks.forEach((task) => {
    const evaluatorName = task.fixedEvaluatorId
      ? (evaluatorMap.get(task.fixedEvaluatorId) ?? `未設定_${task.fixedEvaluatorId}`)
      : `未設定_${task.fixedEvaluatorId}`;

    // 報告者と実行者の名前を抽出
    const reporterNames = task.reporters
      .map((r) => r.user?.settings?.username ?? `未設定_${r.user?.id}`)
      .filter((name) => name.length > 0)
      .join(", ");

    const executorNames = task.executors
      .map((e) => e.user?.settings?.username ?? `未設定_${e.user?.id}`)
      .filter((name) => name.length > 0)
      .join(", ");

    // CSV用のデータ構造を作成
    const csvData: GroupAnalyticsCsvDataItem = {
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
      タスク作成者: task.creator?.settings?.username ?? "",
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 結果を返却
   */
  return {
    success: true,
    message: "分析データのエクスポートが完了しました",
    data: {
      data: groupedByEvaluator,
      totalPages,
      currentPage: page,
    },
  };
}
