"use server";

import type { TaskFormValuesAndGroupId } from "@/components/task/task-input-form";
import type { TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * タスクを作成する関数
 * @param data - タスクのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function createTask(data: TaskFormValuesAndGroupId) {
  try {
    // 認証セッションを取得
    const session = await auth();

    // 認証セッションが取得できない場合
    if (!session?.user?.id) {
      return { error: "認証エラーが発生しました" };
    }

    // バリデーション
    if (!data || !data.groupId) {
      return { error: "必須項目が入力されていません" };
    }

    // タスクを作成
    const newTask = await prisma.task.create({
      data: {
        task: data.task,
        reference: data.reference,
        info: data.info,
        contributionType: data.contributionType,
        userId: session.user.id,
        groupId: data.groupId,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    revalidatePath(`/dashboard/group/${data.groupId}`);
    return { success: true, task: newTask };
  } catch (error) {
    console.error("[CREATE_TASK]", error);
    return { error: "タスクの作成中にエラーが発生しました" };
  }
}

/**
 * グループの詳細情報を取得する関数
 * @param groupId - グループID
 * @returns グループの詳細情報
 */
export async function getTasksByGroupId(groupId: string) {
  try {
    const tasks = await prisma.task.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            maxParticipants: true,
            goal: true,
            evaluationMethod: true,
            members: {
              select: {
                id: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!tasks) {
      throw new Error("タスクが見つかりません");
    }

    return tasks;
  } catch (error) {
    console.error("[GET_TASKS_BY_GROUP_ID]", error);
    throw new Error("タスク情報の取得中にエラーが発生しました");
  }
}

/**
 * グループのTask情報をCSV形式でエクスポートする関数
 * @param groupId - グループID
 * @param startDate - 開始日（オプション）
 * @param endDate - 終了日（オプション）
 * @returns CSVデータ
 */
export async function exportGroupTask(groupId: string, startDate?: Date, endDate?: Date) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証エラーが発生しました");
    }

    // 期間条件の構築
    const dateCondition = {};
    if (startDate && endDate) {
      Object.assign(dateCondition, {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      });
    }

    const tasks = await prisma.task.findMany({
      where: {
        groupId,
        ...dateCondition,
      },
      include: {
        user: {
          select: {
            name: true,
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
    });

    if (!tasks) {
      throw new Error("タスクが見つかりません");
    }

    // タスクのユーザー名を取得。taskひとつが要素の配列なので、全部を.mapで繰り返して加工している
    const formattedTasks = tasks.map((task) => ({
      タスクID: task.id,
      タスク内容: task.task,
      参照: task.reference || "",
      証拠情報: task.info || "",
      ステータス: task.status,
      貢献ポイント: task.fixedContributionPoint || 0,
      評価者: task.fixedEvaluator || "",
      貢献タイプ: task.contributionType,
      作成者: task.user.name || "不明",
      作成日: task.createdAt.toISOString().split("T")[0],
      更新日: task.updatedAt.toISOString().split("T")[0],
    }));

    return formattedTasks;
  } catch (error) {
    console.error("[EXPORT_GROUP_TASK]", error);
    throw new Error("グループのTask情報のエクスポート中にエラーが発生しました");
  }
}

/**
 * グループの分析結果をCSV形式でエクスポートする関数
 * @param groupId - グループID
 * @param page - 取得するページ番号（1ページ200件）
 * @param onlyFixed - FIX済みの分析結果のみを取得するフラグ
 * @returns 評価者ごとに分けられたCSVデータ
 */
export async function exportGroupAnalytics(groupId: string, page: number = 1, onlyFixed: boolean = false) {
  try {
    // 指定グループのデータの有無を確認
    const group = await prisma.analytics.findFirst({
      where: { groupId },
    });

    if (!group) {
      throw new Error("グループの分析結果が存在しません");
    }

    // FIX済み分析結果のみを取得する条件
    const fixedCondition = onlyFixed
      ? {
          task: {
            fixedEvaluator: { not: null },
            fixedContributionPoint: { not: null },
            fixedEvaluationLogic: { not: null },
          },
        }
      : {};

    // ページネーション用のskipとtake
    const itemsPerPage = 200;
    const skip = (page - 1) * itemsPerPage;

    const analyticsWhere = {
      groupId,
      ...fixedCondition,
    };

    // 分析結果データを取得するために、2段階のクエリに分割
    // 1. まず基本のAnalyticsデータを取得
    const analyticsBase = await prisma.analytics.findMany({
      where: analyticsWhere,
      orderBy: { createdAt: "asc" },
      skip: skip,
      take: itemsPerPage,
    });

    if (!analyticsBase || analyticsBase.length === 0) {
      throw new Error(`${page}ページ目にエクスポート可能な分析結果がありません`);
    }

    // 2. 関連データを個別に取得
    // 必要なIDのリストを作成
    const taskIds = analyticsBase.map((item) => item.taskId);
    const evaluatorIds = analyticsBase.map((item) => item.evaluator);

    // タスク情報を一括取得
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
      },
      select: {
        id: true,
        task: true,
        reference: true,
        status: true,
        contributionType: true,
        info: true,
        userId: true,
      },
    });

    // 評価者情報を一括取得
    const users = await prisma.user.findMany({
      where: {
        id: { in: evaluatorIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    // タスク作成者のIDリストを作成
    const taskCreatorIds = tasks.map((task) => task.userId).filter(Boolean) as string[];

    // タスク作成者情報を一括取得
    const taskCreators = await prisma.user.findMany({
      where: {
        id: { in: taskCreatorIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    // グループ情報を取得
    const groupInfo = await prisma.group.findUnique({
      where: {
        id: groupId,
      },
      select: {
        goal: true,
        evaluationMethod: true,
      },
    });

    // 取得したデータをマッピングするためのマップを作成
    const tasksMap: Record<string, (typeof tasks)[0]> = tasks.reduce(
      (acc, task) => {
        acc[task.id] = task;
        return acc;
      },
      {} as Record<string, (typeof tasks)[0]>,
    );

    const usersMap: Record<string, (typeof users)[0]> = users.reduce(
      (acc, user) => {
        acc[user.id] = user;
        return acc;
      },
      {} as Record<string, (typeof users)[0]>,
    );

    const taskCreatorsMap: Record<string, (typeof taskCreators)[0]> = taskCreators.reduce(
      (acc, creator) => {
        acc[creator.id] = creator;
        return acc;
      },
      {} as Record<string, (typeof taskCreators)[0]>,
    );

    // 最終的なデータを組み立てる
    const analytics = analyticsBase.map((item) => {
      const task = tasksMap[item.taskId] || {};
      const evaluator = usersMap[item.evaluator] || {};
      const taskCreator = task.userId ? taskCreatorsMap[task.userId] : null;

      return {
        ...item,
        user: evaluator,
        task: {
          ...task,
          user: taskCreator,
        },
        group: groupInfo,
      };
    });

    // 評価者ごとにデータを分類
    const evaluatorData: { [key: string]: any[] } = {};

    for (const item of analytics) {
      // 評価者情報 (マップから取得したデータでnullチェック)
      const evaluatorName = item.user?.name || "不明な評価者";
      const evaluatorId = item.user?.id || "unknown";

      if (!evaluatorData[evaluatorName]) {
        evaluatorData[evaluatorName] = [];
      }

      // タスク関連情報 (マップから取得したデータでnullチェック)
      const taskContent = item.task?.task || "";
      const taskReference = item.task?.reference || "";
      const taskInfo = item.task?.info || "";
      const taskStatus = item.task?.status || "";
      const taskContributionType = item.task?.contributionType || "";
      const taskCreatorName = item.task?.user?.name || "不明";

      // グループ情報 (直接取得したデータでnullチェック)
      const groupGoal = item.group?.goal || "";
      const evaluationMethod = item.group?.evaluationMethod || "";

      // CSVに適した形式に変換
      evaluatorData[evaluatorName].push({
        分析ID: item.id,
        タスクID: item.taskId,
        貢献ポイント: item.contributionPoint,
        評価ロジック: item.evaluationLogic,
        評価者ID: evaluatorId,
        評価者名: evaluatorName,
        タスク内容: taskContent,
        参照情報: taskReference,
        証拠情報: taskInfo,
        ステータス: taskStatus,
        貢献タイプ: taskContributionType,
        タスク作成者: taskCreatorName,
        グループ目標: groupGoal,
        評価方法: evaluationMethod,
        作成日: item.createdAt.toISOString().split("T")[0],
      });
    }

    return evaluatorData;
  } catch (error) {
    console.error("[EXPORT_GROUP_ANALYTICS]", error);
    // throw new Errorしたエラーがあれば、それを表示
    throw new Error(error instanceof Error ? error.message : "グループの分析結果のエクスポート中にエラーが発生しました");
  }
}

/**
 * CSVからタスクを一括登録する関数
 * @param data - CSVから読み込んだタスクデータ
 * @param groupId - グループID
 * @param userId - ユーザーID
 * @returns 処理結果を含むオブジェクト
 */
export async function bulkCreateTasks(data: any[], groupId: string) {
  try {
    // 認証セッションを取得
    const session = await auth();

    // 認証セッションが取得できない場合
    if (!session?.user?.id) {
      throw new Error("認証エラーが発生しました");
    }

    // トランザクションを使用してデータを一括登録
    const result = await prisma.$transaction(async (tx) => {
      // タスクを作成
      const tasks = await Promise.all(
        data.map(async (row) => {
          // タスクを作成
          const task = await tx.task.create({
            data: {
              task: row.task,
              reference: row.reference || null,
              info: row.info || null,
              contributionType: row.contributionType || "NON_REWARD",
              userId: session.user?.id || "",
              groupId: groupId,
            },
            // 、関連するuserオブジェクトから、ユーザーのnameのみを選択して取得しています。これにより、後続の処理でタスク作成後にユーザー名を利用したい場合に、余分なデータを省いて効率的にアクセスすることができます。
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          });
          return task;
        }),
      );
      return tasks;
    });

    return { success: true, tasks: result };
  } catch (error) {
    console.error("[BULK_CREATE_TASKS]", error);
    return { error: "タスクの一括登録中にエラーが発生しました" };
  }
}

/**
 * タスクのステータスを更新する関数
 * @param taskId - 更新するタスクのID
 * @param status - 新しいステータス
 * @returns 処理結果を含むオブジェクト
 */
export async function updateTaskStatus(taskId: string, status: string) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証エラーが発生しました");
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: status as TaskStatus },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    revalidatePath(`/dashboard/group/${updatedTask.groupId}`);
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("[UPDATE_TASK_STATUS]", error);
    return { error: "タスクのステータスの更新中にエラーが発生しました" };
  }
}
