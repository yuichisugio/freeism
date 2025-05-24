"use server";

import type { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
    // クエリ条件を構築
    const whereConditions: {
      groupId: string;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
      status?: TaskStatus;
    } = { groupId };

    // 日付範囲が指定されている場合、条件に追加
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

    // 分析用の場合はTASK_COMPLETEDのタスクのみ対象にする
    if (onlyTaskCompleted) {
      whereConditions.status = "TASK_COMPLETED" as TaskStatus;
    }

    // Prismaの返却型に合わせた型定義
    type PrismaTaskWithIncludes = {
      id: string;
      task: string;
      reference: string | null;
      status: string;
      contributionType: string;
      info: string | null;
      fixedContributionPoint: number | null;
      fixedEvaluatorId: string | null;
      createdAt: Date;
      updatedAt: Date;
      creator: {
        name: string | null;
      } | null;
      reporters: {
        user: {
          name: string | null;
        } | null;
        name: string | null;
      }[];
      executors: {
        user: {
          name: string | null;
        } | null;
        name: string | null;
      }[];
      group: {
        name: string | null;
      } | null;
    };

    const tasks = (await prisma.task.findMany({
      where: whereConditions,
      include: {
        creator: {
          select: {
            name: true,
          },
        },
        reporters: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        executors: {
          include: {
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
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })) as unknown as PrismaTaskWithIncludes[];

    if (!tasks || tasks.length === 0) {
      throw new Error("タスクが見つかりません");
    }

    // タスクのユーザー名を取得
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

    return formattedTasks;
  } catch (error) {
    console.error("[EXPORT_GROUP_TASK]", error);
    throw new Error("グループのTask情報のエクスポート中にエラーが発生しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクとその関連データの型定義
 */
type TaskWithRelations = {
  id: string;
  task: string;
  reference: string | null;
  status: string;
  contributionType: string;
  info: string | null;
  fixedContributionPoint: number | null;
  fixedEvaluatorId: string | null;
  fixedEvaluationLogic: string | null;
  fixedEvaluationDate: Date | null;
  userFixedSubmitterId: string | null;
  executors: TaskUserRelation[];
  reporters: TaskUserRelation[];
  creator: {
    id: string;
    name: string | null;
  } | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクとユーザーの関連の型定義
 */
type TaskUserRelation = {
  user?: {
    id?: string;
    name?: string | null;
  } | null;
  name?: string | null;
  userId?: string;
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
      whereConditions.AND = [
        { status: "POINTS_AWARDED" as TaskStatus }, // ステータスがPOINTS_AWARDEDのもののみに限定
      ];
    } else if (onlyTaskCompleted) {
      // FIX済み条件がオフで、分析用の場合はTASK_COMPLETEDのみを対象とする
      whereConditions.AND = [{ status: "TASK_COMPLETED" as TaskStatus }];
    }

    // タスク数を取得
    const tasksCount = await prisma.task.count({
      where: whereConditions,
    });

    const totalPages = Math.ceil(tasksCount / limit);

    // タスクを取得
    const tasks = (await prisma.task.findMany({
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
        // 作成者情報
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        // 報告者情報
        reporters: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        // 実行者情報
        executors: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })) as unknown as TaskWithRelations[];

    // 関連するユーザーIDを収集
    const userIds: string[] = [];

    // 固定評価者と固定提出者のIDを追加（nullでないものだけ）
    tasks.forEach((task) => {
      if (task.fixedEvaluatorId) {
        userIds.push(task.fixedEvaluatorId);
      }

      if (task.userFixedSubmitterId) {
        userIds.push(task.userFixedSubmitterId);
      }
    });

    // 評価者情報を一括取得 - 空の配列の場合は検索しない
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: {
              id: { in: userIds.filter(Boolean) }, // null値を除外
            },
            select: {
              id: true,
              name: true,
            },
          })
        : [];

    // 取得したデータをマッピングするためのマップを作成
    const tasksMap: Record<string, TaskWithRelations> = {};

    // マップを作成
    tasks.forEach((task) => {
      tasksMap[task.id] = {
        id: task.id,
        task: task.task,
        reference: task.reference,
        status: task.status,
        contributionType: task.contributionType,
        info: task.info,
        fixedContributionPoint: task.fixedContributionPoint,
        fixedEvaluatorId: task.fixedEvaluatorId,
        fixedEvaluationLogic: task.fixedEvaluationLogic,
        fixedEvaluationDate: task.fixedEvaluationDate,
        userFixedSubmitterId: task.userFixedSubmitterId,
        executors: task.executors,
        reporters: task.reporters,
        creator: task.creator,
      };
    });

    type UserMapItem = {
      id: string;
      name: string | null;
    };

    const usersMap: Record<string, UserMapItem> = {};

    // ユーザーマップを作成
    users.forEach((user) => {
      usersMap[user.id] = user;
    });

    // 最終的なデータを組み立てる
    type AnalyticsItem = {
      id: string;
      executors: TaskUserRelation[];
      reporters: TaskUserRelation[];
      creator: {
        id: string;
        name: string | null;
      } | null;
      group: typeof group;
    };

    const analytics: AnalyticsItem[] = tasks.map((task) => {
      return {
        id: task.id,
        executors: task.executors,
        reporters: task.reporters,
        creator: task.creator,
        group: group,
      };
    });

    // 評価者ごとにグループ化
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

    const groupedByEvaluator: Record<string, CsvDataItem[]> = {};

    analytics.forEach((item) => {
      const task = tasksMap[item.id];
      const evaluatorId = task.fixedEvaluatorId;

      // nullの安全な処理
      const evaluator = evaluatorId && typeof evaluatorId === "string" && usersMap[evaluatorId] ? usersMap[evaluatorId] : undefined;
      const evaluatorName = evaluator ? evaluator.name : "未割り当て";
      const taskContent = task.task ?? "";
      const referenceContent = task.reference ?? "";
      const infoContent = task.info ?? "";

      // 報告者と実行者の名前を抽出
      const reporterNames = task.reporters
        .map((r) => (r.user ? r.user.name : r.name) ?? "")
        .filter((name) => name.length > 0)
        .join(", ");

      const executorNames = task.executors
        .map((e) => (e.user ? e.user.name : e.name) ?? "")
        .filter((name) => name.length > 0)
        .join(", ");

      // CSV用のデータ構造を作成
      const csvData: CsvDataItem = {
        分析ID: task.id,
        タスクID: task.id,
        貢献ポイント: task.fixedContributionPoint ?? 0,
        評価ロジック: task.fixedEvaluationLogic ?? "",
        評価者ID: task.fixedEvaluatorId ?? "",
        評価者名: evaluatorName ?? "",
        タスク内容: taskContent,
        参照情報: referenceContent,
        証拠情報: infoContent,
        ステータス: task.status,
        貢献タイプ: task.contributionType,
        タスク報告者: reporterNames,
        タスク実行者: executorNames,
        タスク作成者: task.creator ? (task.creator.name ?? "") : "",
        グループ目標: group.goal,
        評価方法: group.evaluationMethod,
        作成日: task.fixedEvaluationDate ? new Date(task.fixedEvaluationDate).toISOString().split("T")[0] : "",
      };

      // FIX済みの場合は追加情報を含める
      if (onlyFixed && task.fixedEvaluationDate) {
        csvData.評価日 = task.fixedEvaluationDate.toISOString().split("T")[0];
      }

      // 評価者ごとのグループに追加
      if (!groupedByEvaluator[evaluatorName ?? ""]) {
        groupedByEvaluator[evaluatorName ?? ""] = [];
      }
      groupedByEvaluator[evaluatorName ?? ""].push(csvData);
    });

    // 全体のページ数も返す
    return {
      data: groupedByEvaluator,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    console.error("[EXPORT_GROUP_ANALYTICS]", error);
    // エラーメッセージを含めて返す
    return { error: "分析データのエクスポート中にエラーが発生しました" };
  }
}
