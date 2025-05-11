"use server";

import type { TaskFormValuesAndGroupId, TaskParticipant } from "@/hooks/form/use-task-input-form";
import type { TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { checkAppOwner, checkGroupOwner } from "@/lib/actions/group";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { contributionType } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクを作成する関数
 * @param data - タスクのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function createTask(data: TaskFormValuesAndGroupId) {
  try {
    // groupIdの存在確認
    if (!data.groupId) {
      return { error: "グループIDが指定されていません" };
    }

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: data.groupId },
    });

    if (!group) {
      return { error: "指定されたグループが見つかりません" };
    }

    // 認証セッションを取得
    const userId = await getAuthenticatedSessionUserId();

    // バリデーション
    if (!data || !data.groupId) {
      return { error: "必須項目が入力されていません" };
    }

    // タスクを作成
    const newTask = await prisma.task.create({
      data: {
        task: data.task,
        detail: data.detail,
        reference: data.reference,
        info: data.info,
        imageUrl: data.imageUrl,
        contributionType: data.contributionType,
        category: data.category, // カテゴリを追加
        creatorId: userId,
        groupId: data.groupId,
        // 提供方法を追加
        deliveryMethod: data.deliveryMethod,
        // 報告者の設定
        reporters: {
          create:
            data.reporters && data.reporters.length > 0
              ? // 報告者が指定されている場合
                data.reporters.map((reporter: TaskParticipant) => ({
                  name: reporter.name,
                  userId: reporter.userId,
                }))
              : // 報告者が指定されていない場合、作成者を報告者として追加
                [{ userId: userId }],
        },
        // 実行者の設定
        executors: {
          create:
            data.executors && data.executors.length > 0
              ? // 実行者が指定されている場合
                data.executors.map((executor: TaskParticipant) => ({
                  name: executor.name,
                  userId: executor.userId,
                }))
              : // 実行者が指定されていない場合、作成者を実行者として追加
                [{ userId: userId }],
        },
      },
    });

    // 作成したタスクを関連データを含めて再取得
    const taskWithRelations = await prisma.task.findUnique({
      where: { id: newTask.id },
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
      },
    });

    // 報酬タイプがREWARDの場合はオークションを作成
    if (data.contributionType === contributionType.REWARD) {
      // デフォルトの日時を設定
      const startTime = data.auctionStartTime ?? new Date();
      const endTime = data.auctionEndTime ?? new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000); // デフォルトは1週間後

      await prisma.auction.create({
        data: {
          taskId: newTask.id,
          startTime,
          endTime,
          status: "PENDING",
          currentHighestBid: 0,
          extensionTotalCount: 0,
          extensionLimitCount: 3,
          extensionTotalTime: 0,
          extensionLimitTime: 10,
          groupId: data.groupId,
        },
      });
    }

    revalidatePath(`/dashboard/group/${data.groupId}`);
    return { success: true, task: taskWithRelations ?? newTask };
  } catch (error) {
    console.error("[CREATE_TASK]", error);
    return { error: "タスクの作成中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
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
      fixedEvaluator: string | null;
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
        評価者: task.fixedEvaluator ?? "",
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

// タスクとその関連データの型定義
type TaskWithRelations = {
  id: string;
  task: string;
  reference: string | null;
  status: string;
  contributionType: string;
  info: string | null;
  fixedContributionPoint: number | null;
  fixedEvaluator: string | null;
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

// タスクとユーザーの関連の型定義
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
        fixedEvaluator: true,
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
      if (task.fixedEvaluator) {
        userIds.push(task.fixedEvaluator);
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
        fixedEvaluator: task.fixedEvaluator,
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
      const evaluatorId = task.fixedEvaluator;

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
        評価者ID: task.fixedEvaluator ?? "",
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSVからタスクを一括登録する関数
 * @param data - CSVから読み込んだタスクデータ
 * @param groupId - グループID
 * @param userId - ユーザーID
 * @returns 処理結果を含むオブジェクト
 */
export async function bulkCreateTasks(
  data: Array<{
    task: string;
    detail?: string | null;
    reference?: string | null;
    info?: string | null;
    contributionType?: string | null;
    deliveryMethod?: string | null;
    auctionStartTime?: string | Date;
    auctionEndTime?: string | Date;
  }>,
  groupId: string,
) {
  try {
    // groupIdの存在確認
    if (!groupId) {
      return { error: "グループIDが指定されていません" };
    }

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return { error: "指定されたグループが見つかりません" };
    }

    // 認証セッションを取得
    const userId = await getAuthenticatedSessionUserId();

    // トランザクションを使用してデータを一括登録
    const result = await prisma.$transaction(async (tx) => {
      // タスクを作成
      const tasks = await Promise.all(
        data.map(async (row) => {
          // タスクを作成
          const task = await tx.task.create({
            data: {
              task: row.task,
              detail: row.detail ?? null,
              reference: row.reference ?? null,
              info: row.info ?? null,
              contributionType: (row.contributionType as contributionType) ?? contributionType.NON_REWARD,
              creatorId: userId,
              groupId: groupId,
              // 提供方法を追加
              deliveryMethod: row.deliveryMethod ?? null,
              // 作成者を報告者としても登録
              reporters: {
                create: [
                  {
                    userId: userId,
                  },
                ],
              },
              // 作成者を実行者としても登録
              executors: {
                create: [
                  {
                    userId: userId,
                  },
                ],
              },
            },
          });

          // 報酬タイプがREWARDの場合はオークションを作成
          if (row.contributionType === contributionType.REWARD) {
            // 日時文字列をDate型に変換
            let startTime = new Date();
            let endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000); // デフォルトは1週間後

            if (row.auctionStartTime) {
              try {
                startTime = new Date(row.auctionStartTime);
              } catch (e) {
                console.error("開始日時の解析エラー:", e);
              }
            }

            if (row.auctionEndTime) {
              try {
                endTime = new Date(row.auctionEndTime);
              } catch (e) {
                console.error("終了日時の解析エラー:", e);
              }
            }

            await tx.auction.create({
              data: {
                taskId: task.id,
                startTime,
                endTime,
                status: "PENDING",
                currentHighestBid: 0,
                extensionTotalCount: 0,
                extensionLimitCount: 3,
                extensionTotalTime: 0,
                extensionLimitTime: 10,
                groupId: groupId,
              },
            });
          }

          return task;
        }),
      );

      return tasks;
    });

    revalidatePath(`/dashboard/group/${groupId}`);
    return { success: true, tasks: result };
  } catch (error) {
    console.error("[BULK_CREATE_TASKS]", error);
    return { error: "タスクの一括登録中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクを削除するサーバーアクション
 * @param taskId 削除するタスクのID
 * @returns 処理結果を含むオブジェクト
 */
export async function deleteTask(taskId: string) {
  console.log("src/lib/actions/task.ts_deleteTask_start", taskId);
  try {
    // 現在のユーザーを取得
    const userId = await getAuthenticatedSessionUserId();

    const isAppOwner = await checkAppOwner(userId);

    console.log("src/lib/actions/task.ts_deleteTask_userId", userId);

    // タスクを取得（関連エンティティも含む）
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        reporters: true,
        executors: true,
        group: {
          include: {
            members: {
              where: {
                userId: userId,
                isGroupOwner: true,
              },
            },
          },
        },
        auction: true,
      },
    });

    console.log("src/lib/actions/task.ts_deleteTask_task", task);

    if (!task) {
      return { success: false, error: "タスクが見つかりません" };
    }

    console.log("src/lib/actions/task.ts_deleteTask_task_group", task.group);

    // 権限チェック（グループオーナー、タスク報告者、タスク実行者のいずれかであること）
    const isGroupOwner = task.group.members.length > 0;
    const isReporter = task.reporters.some((reporter) => reporter.userId === userId);
    const isExecutor = task.executors.some((executor) => executor.userId === userId);

    console.log("src/lib/actions/task.ts_deleteTask_task_isGroupOwner", isGroupOwner);
    console.log("src/lib/actions/task.ts_deleteTask_task_isReporter", isReporter);
    console.log("src/lib/actions/task.ts_deleteTask_task_isExecutor", isExecutor);

    if (!isAppOwner && !isGroupOwner && !isReporter && !isExecutor) {
      return { success: false, error: "このタスクを削除する権限がありません" };
    }

    console.log("src/lib/actions/task.ts_deleteTask_task_auction", task.auction);

    // タスク状態のチェック
    if (task.contributionType === contributionType.REWARD) {
      // 報酬タスクの場合、オークションがPENDINGの場合のみ削除可能
      if (!task.auction || task.auction.status !== "PENDING") {
        return { success: false, error: "オークションが開始されているタスクは削除できません" };
      }
    } else {
      // 非報酬タスクの場合、ステータスがPENDINGの場合のみ削除可能
      if (task.status !== "PENDING") {
        return { success: false, error: "進行中または完了したタスクは削除できません" };
      }
    }
    console.log("src/lib/actions/task.ts_deleteTask_beforeDelete", taskId);

    // タスクを削除（カスケード削除により関連エンティティも削除される）
    await prisma.task.delete({
      where: { id: taskId },
    });
    console.log("src/lib/actions/task.ts_deleteTask_afterDelete", taskId);
    // キャッシュを再検証
    revalidatePath(`/groups/${task.groupId}`);
    revalidatePath(`/dashboard/group/${task.groupId}`);

    return { success: true };
  } catch (error) {
    console.error("タスク削除エラー:", error);
    return { success: false, error: "タスクの削除中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクのステータスを更新する関数
 * @param taskId - 更新するタスクのID
 * @param status - 新しいステータス
 * @returns 処理結果を含むオブジェクト
 */
export async function updateTaskStatus(taskId: string, status: string) {
  try {
    const userId = await getAuthenticatedSessionUserId();

    // タスクの詳細情報を取得
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        group: true, // グループ情報を取得
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        reporters: {
          include: {
            user: true,
          },
        },
        executors: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    // 変更不可のステータスチェック
    const immutableStatuses: TaskStatus[] = ["FIXED_EVALUATED", "POINTS_AWARDED", "ARCHIVED"];
    if (immutableStatuses.includes(task.status)) {
      return { error: "このステータスのタスクは変更できません" };
    }

    // 権限チェック
    const isCreator = task.creator.id === userId;
    const isReporter = task.reporters.some((reporter) => reporter.user?.id === userId);
    const isExecutor = task.executors.some((executor) => executor.user?.id === userId);

    // アプリオーナーとグループオーナーの確認
    const isAppOwner = await checkAppOwner(userId);
    const isGroupOwner = await checkGroupOwner(userId, task.group.id);

    // いずれかの権限がある場合のみ変更可能
    if (!(isCreator || isReporter || isExecutor || isAppOwner || isGroupOwner)) {
      return { error: "このタスクのステータスを変更する権限がありません" };
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: status as TaskStatus },
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
      },
    });

    // ステータスがPOINTS_AWARDEDに変更されたかつfixedContributionPointが設定されている場合
    if (status === "POINTS_AWARDED" && task.fixedContributionPoint) {
      // GroupPointテーブルの残高を更新
      const contributionPoint = task.fixedContributionPoint;

      // 報告者と実行者のユーザーIDを取得（重複排除）
      const reporterUserIds = task.reporters.filter((r) => r.user?.id).map((r) => r.user!.id);

      const executorUserIds = task.executors.filter((e) => e.user?.id).map((e) => e.user!.id);

      const userIds = [...new Set([...reporterUserIds, ...executorUserIds])];

      // 各ユーザーのGroupPointを更新
      for (const userId of userIds) {
        // 既存のGroupPointを検索
        const groupPoint = await prisma.groupPoint.findUnique({
          where: {
            userId_groupId: {
              userId: userId,
              groupId: task.group.id,
            },
          },
        });

        // GroupPointが存在しなければ作成、存在すれば更新
        if (groupPoint) {
          await prisma.groupPoint.update({
            where: {
              userId_groupId: {
                userId: userId,
                groupId: task.group.id,
              },
            },
            data: {
              balance: { increment: contributionPoint },
              fixedTotalPoints: { increment: contributionPoint },
            },
          });
        } else {
          await prisma.groupPoint.create({
            data: {
              userId: userId,
              groupId: task.group.id,
              balance: contributionPoint,
              fixedTotalPoints: contributionPoint,
            },
          });
        }
      }
    }

    revalidatePath(`/dashboard/group/${updatedTask.groupId}`);
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("[UPDATE_TASK_STATUS]", error);
    return { error: "タスクのステータスの更新中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクを更新する関数
 * @param taskId - 更新するタスクのID
 * @param data - 更新するタスクのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateTask(taskId: string, data: Omit<TaskFormValuesAndGroupId, "groupId">) {
  try {
    // 認証セッションを取得
    const userId = await getAuthenticatedSessionUserId();

    // 既存のタスクを取得
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        group: true,
        reporters: true,
        executors: true,
      },
    });

    if (!existingTask) {
      return { error: "更新対象のタスクが見つかりません" };
    }

    // グループ所有者またはアプリ所有者か確認
    const isGroupOwner = await checkGroupOwner(userId, existingTask.groupId);
    const isAppOwner = await checkAppOwner(userId);
    const isTaskCreator = existingTask.creatorId === userId;

    // 権限チェック（タスク作成者、グループ所有者、またはアプリ所有者のみ更新可能）
    if (!isTaskCreator && !isGroupOwner && !isAppOwner) {
      return { error: "このタスクを更新する権限がありません" };
    }

    // タスクと関連データの更新をトランザクションで行う
    const updatedTask = await prisma.$transaction(async (prismaClient) => {
      // 1. 既存の報告者と実行者を削除
      if (data.reporters || data.executors) {
        if (data.reporters) {
          await prismaClient.taskReporter.deleteMany({
            where: { taskId: taskId },
          });
        }

        if (data.executors) {
          await prismaClient.taskExecutor.deleteMany({
            where: { taskId: taskId },
          });
        }
      }

      // 2. タスクの基本情報を更新
      const result = await prismaClient.task.update({
        where: { id: taskId },
        data: {
          task: data.task,
          detail: data.detail,
          reference: data.reference,
          info: data.info,
          imageUrl: data.imageUrl,
          contributionType: data.contributionType,
          category: data.category,
          // 3. 新しい報告者を登録
          reporters: data.reporters
            ? {
                create: data.reporters.map((reporter: TaskParticipant) => ({
                  name: reporter.name,
                  userId: reporter.userId,
                })),
              }
            : undefined,
          // 4. 新しい実行者を登録
          executors: data.executors
            ? {
                create: data.executors.map((executor: TaskParticipant) => ({
                  name: executor.name,
                  userId: executor.userId,
                })),
              }
            : undefined,
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
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
      });

      // オークションの情報更新またはオークション作成
      const existingAuction = await prismaClient.auction.findUnique({
        where: { taskId: taskId },
      });

      // 貢献タイプがREWARDに変更され、オークションが存在しない場合は新規作成
      if (data.contributionType === contributionType.REWARD && !existingAuction) {
        // タスクのgroupIdを使用してオークションを作成
        await prismaClient.auction.create({
          data: {
            taskId: taskId,
            startTime: new Date(),
            endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // デフォルト1週間後
            status: "PENDING",
            currentHighestBid: 0,
            extensionTotalCount: 0,
            extensionLimitCount: 3,
            extensionTotalTime: 0,
            extensionLimitTime: 10,
            groupId: existingTask.groupId, // タスクに関連付けられたグループIDを使用
          },
        });
      }
      // 貢献タイプがNON_REWARDに変更され、オークションが存在する場合は削除
      else if (data.contributionType === contributionType.NON_REWARD && existingAuction) {
        // オークションに入札がある場合は削除しない
        const hasBids = await prismaClient.bidHistory.findFirst({
          where: { auctionId: existingAuction.id },
        });

        if (!hasBids) {
          await prismaClient.auction.delete({
            where: { id: existingAuction.id },
          });
        } else {
          // 入札がある場合は警告を追加（タスクの更新自体は行う）
          console.warn(`タスク ${taskId} は入札があるため、オークションは削除されませんでした`);
        }
      }

      return result;
    });

    revalidatePath(`/dashboard/group/${existingTask.groupId}`);
    // revalidatePath('/dashboard/my-tasks');

    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("[UPDATE_TASK]", error);
    return { error: "タスクの更新中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type FixedEvaluationData = {
  id: string;
  fixedContributionPoint: string | number;
  fixedEvaluator: string;
  fixedEvaluationLogic: string;
  fixedEvaluationDate?: string | Date;
  失敗理由?: string;
  [key: string]: unknown;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * FIXした分析結果データをCSVからアップロードして、タスクを更新する関数
 * @param data - CSVから読み込んだ評価データ
 * @param groupId - グループID
 * @returns 処理結果と成功・失敗データを含むオブジェクト
 */
export async function bulkUpdateFixedEvaluations(data: FixedEvaluationData[], groupId: string) {
  try {
    const userId = await getAuthenticatedSessionUserId();

    // グループオーナーまたはアプリオーナーかどうかをチェック
    const isAppOwner = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAppOwner: true },
    });

    const isGroupOwner = await prisma.groupMembership.findFirst({
      where: {
        userId: userId,
        groupId: groupId,
        isGroupOwner: true,
      },
    });

    // 権限がない場合はエラーを返す
    if (!isAppOwner?.isAppOwner && !isGroupOwner) {
      return {
        success: false,
        error: "この操作を行う権限がありません",
        successData: [],
        failedData: data.map((item) => ({ ...item, 失敗理由: "アクセス権限エラー" })),
      };
    }

    // 成功したデータと失敗したデータを保存する配列
    const successData: FixedEvaluationData[] = [];
    const failedData: FixedEvaluationData[] = [];

    // トランザクションを使用してデータを一括更新
    await prisma.$transaction(async (tx) => {
      for (const row of data) {
        // 必須項目のチェック
        if (!row.id) {
          failedData.push({ ...row, 失敗理由: "タスクIDが指定されていません" });
          continue;
        }

        // タスクの存在確認
        const task = await tx.task.findFirst({
          where: {
            id: row.id,
            groupId: groupId,
          },
        });

        if (!task) {
          failedData.push({ ...row, 失敗理由: "指定されたタスクが見つかりません" });
          continue;
        }

        // タスクのステータスが TASK_COMPLETED かどうかチェック
        if (task.status !== "TASK_COMPLETED") {
          failedData.push({ ...row, 失敗理由: "タスクのステータスが「タスク完了」でないため更新できません" });
          continue;
        }

        try {
          // 評価ポイントが数値かをチェック
          const contributionPoint = parseInt(row.fixedContributionPoint.toString());
          if (isNaN(contributionPoint)) {
            failedData.push({ ...row, 失敗理由: "固定貢献ポイントが数値ではありません" });
            continue;
          }

          // 評価者と評価ロジックのチェック
          if (!row.fixedEvaluator) {
            failedData.push({ ...row, 失敗理由: "固定評価者が指定されていません" });
            continue;
          }

          if (!row.fixedEvaluationLogic) {
            failedData.push({ ...row, 失敗理由: "固定評価ロジックが指定されていません" });
            continue;
          }

          // 評価日の確認（指定がなければ現在の日時）
          let evaluationDate: Date;
          if (row.fixedEvaluationDate) {
            const dateValue = new Date(row.fixedEvaluationDate);
            evaluationDate = isNaN(dateValue.getTime()) ? new Date() : dateValue;
          } else {
            evaluationDate = new Date();
          }

          // セッションのユーザーIDチェック
          if (!userId) {
            failedData.push({ ...row, 失敗理由: "認証情報が不正です" });
            continue;
          }

          // タスクを更新
          const updatedTask = await tx.task.update({
            where: { id: row.id },
            data: {
              fixedContributionPoint: contributionPoint,
              fixedEvaluator: row.fixedEvaluator,
              fixedEvaluationLogic: row.fixedEvaluationLogic,
              fixedEvaluationDate: evaluationDate,
              userFixedSubmitterId: userId,
              status: "POINTS_AWARDED",
            },
          });

          // GroupPointテーブルの残高を更新
          // 1. 報告者と実行者のユーザーIDを取得
          const taskWithUsers = await tx.task.findUnique({
            where: { id: row.id },
            include: {
              reporters: {
                select: { userId: true },
                where: { userId: { not: null } }, // 登録済みユーザーのみ
              },
              executors: {
                select: { userId: true },
                where: { userId: { not: null } }, // 登録済みユーザーのみ
              },
            },
          });

          if (taskWithUsers) {
            // 重複を排除したユーザーIDリストを作成
            const userIds = [...new Set([...taskWithUsers.reporters.map((r) => r.userId!), ...taskWithUsers.executors.map((e) => e.userId!)])];

            // 各ユーザーのGroupPointを更新
            for (const userId of userIds) {
              // 既存のGroupPointを検索
              const groupPoint = await tx.groupPoint.findUnique({
                where: {
                  userId_groupId: {
                    userId: userId,
                    groupId: groupId,
                  },
                },
              });

              // GroupPointが存在しなければ作成、存在すれば更新
              if (groupPoint) {
                await tx.groupPoint.update({
                  where: {
                    userId_groupId: {
                      userId: userId,
                      groupId: groupId,
                    },
                  },
                  data: {
                    balance: { increment: contributionPoint },
                    fixedTotalPoints: { increment: contributionPoint },
                  },
                });
              } else {
                await tx.groupPoint.create({
                  data: {
                    userId: userId,
                    groupId: groupId,
                    balance: contributionPoint,
                    fixedTotalPoints: contributionPoint,
                  },
                });
              }
            }
          }

          successData.push({ ...row, status: updatedTask.status });
        } catch (error) {
          console.error(`タスク更新エラー (ID: ${row.id}):`, error);
          failedData.push({ ...row, 失敗理由: `エラー: ${error instanceof Error ? error.message : "不明なエラー"}` });
        }
      }
    });

    revalidatePath(`/dashboard/group/${groupId}`);

    return {
      success: true,
      successData,
      failedData,
      message: `${successData.length}件のタスクが正常に更新されました。${failedData.length > 0 ? `${failedData.length}件の更新に失敗しました。` : ""}`,
    };
  } catch (error) {
    console.error("[BULK_UPDATE_FIXED_EVALUATIONS]", error);
    return {
      success: false,
      error: "タスクの一括更新中にエラーが発生しました",
      successData: [],
      failedData: data.map((item) => ({ ...item, 失敗理由: "システムエラー" })),
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスを一括更新する関数
 * @param data タスクIDとステータスを含むデータ配列
 * @returns 処理結果を含むオブジェクト
 */
export async function bulkUpdateTaskStatuses(
  data: Array<{
    taskId: string;
    status: string;
    [key: string]: unknown;
  }>,
) {
  try {
    const userId = await getAuthenticatedSessionUserId();

    const isAppOwner = await checkAppOwner(userId);

    // 有効なステータスの配列
    const validStatuses: TaskStatus[] = [
      "PENDING",
      "POINTS_DEPOSITED",
      "TASK_COMPLETED",
      "FIXED_EVALUATED",
      "POINTS_AWARDED",
      "ARCHIVED",
    ] as TaskStatus[];

    type FailedResult = {
      taskId: string;
      status: string;
      error: string;
      [key: string]: unknown;
    };

    type UpdatedTaskResult = {
      reporters: {
        user: {
          id: string;
          name: string | null;
          email: string;
          emailVerified: Date | null;
          image: string | null;
          isAppOwner: boolean;
          createdAt: Date;
          updatedAt: Date;
        } | null;
      }[];
      executors: {
        user: {
          id: string;
          name: string | null;
          email: string;
          emailVerified: Date | null;
          image: string | null;
          isAppOwner: boolean;
          createdAt: Date;
          updatedAt: Date;
        } | null;
      }[];
      id: string;
      task: string;
      reference: string | null;
      status: string;
      contributionType: string;
      info: string | null;
      fixedContributionPoint: number | null;
      fixedEvaluator: string | null;
      fixedEvaluationLogic: string | null;
      fixedEvaluationDate: Date | null;
      createdAt: Date;
      updatedAt: Date;
      groupId: string;
      creatorId: string | null;
      userFixedSubmitterId: string | null;
    };

    const results: UpdatedTaskResult[] = [];
    const failedResults: FailedResult[] = [];

    // データごとに処理
    for (const item of data) {
      try {
        // 必須フィールドのチェック
        if (!item.taskId) {
          failedResults.push({ ...item, error: "タスクIDが指定されていません" });
          continue;
        }

        if (!item.status) {
          failedResults.push({ ...item, error: "ステータスが指定されていません" });
          continue;
        }

        // ステータスの有効性チェック
        if (!validStatuses.includes(item.status as TaskStatus)) {
          failedResults.push({ ...item, error: `無効なステータスです: ${item.status}` });
          continue;
        }

        // タスクの存在チェック
        const task = await prisma.task.findUnique({
          where: { id: item.taskId },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
              },
            },
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
            group: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!task) {
          failedResults.push({ ...item, error: "タスクが見つかりません" });
          continue;
        }

        // 権限チェック
        const isCreator = task.creator.id === userId;
        const isReporter = task.reporters.some((reporter) => reporter.user?.id === userId);
        const isExecutor = task.executors.some((executor) => executor.user?.id === userId);
        const isGroupOwner = await checkGroupOwner(userId, task.group.id);

        // いずれかの権限がある場合のみ変更可能
        if (!(isCreator || isReporter || isExecutor || isAppOwner || isGroupOwner)) {
          failedResults.push({ ...item, error: "このタスクのステータスを変更する権限がありません" });
          continue;
        }

        // 変更不可のステータスチェック（特定のステータスからは変更不可）
        const immutableStatuses: TaskStatus[] = ["FIXED_EVALUATED", "POINTS_AWARDED", "ARCHIVED"];
        if (immutableStatuses.includes(task.status)) {
          failedResults.push({ ...item, error: `このステータス(${task.status})のタスクは変更できません` });
          continue;
        }

        // ステータス更新
        const updatedTask = await prisma.task.update({
          where: { id: item.taskId },
          data: { status: item.status as TaskStatus },
          include: {
            reporters: {
              include: {
                user: true,
              },
            },
            executors: {
              include: {
                user: true,
              },
            },
          },
        });

        // ステータスがPOINTS_AWARDEDに変更されかつfixedContributionPointが設定されている場合、GroupPointを更新
        if (item.status === "POINTS_AWARDED" && task.fixedContributionPoint) {
          const contributionPoint = task.fixedContributionPoint;

          // 報告者と実行者のユーザーIDを取得（重複排除）
          const reporterUserIds = updatedTask.reporters.filter((r) => r.user?.id).map((r) => r.user!.id);

          const executorUserIds = updatedTask.executors.filter((e) => e.user?.id).map((e) => e.user!.id);

          const userIds = [...new Set([...reporterUserIds, ...executorUserIds])];

          // 各ユーザーのGroupPointを更新
          for (const userId of userIds) {
            // 既存のGroupPointを検索
            const groupPoint = await prisma.groupPoint.findUnique({
              where: {
                userId_groupId: {
                  userId: userId,
                  groupId: task.group.id,
                },
              },
            });

            // GroupPointが存在しなければ作成、存在すれば更新
            if (groupPoint) {
              await prisma.groupPoint.update({
                where: {
                  userId_groupId: {
                    userId: userId,
                    groupId: task.group.id,
                  },
                },
                data: {
                  balance: { increment: contributionPoint },
                  fixedTotalPoints: { increment: contributionPoint },
                },
              });
            } else {
              await prisma.groupPoint.create({
                data: {
                  userId: userId,
                  groupId: task.group.id,
                  balance: contributionPoint,
                  fixedTotalPoints: contributionPoint,
                },
              });
            }
          }
        }

        results.push(updatedTask);
      } catch (error) {
        console.error("個別タスクのステータス更新エラー:", error);
        failedResults.push({
          ...item,
          error: error instanceof Error ? error.message : "タスクステータスの更新中にエラーが発生しました",
        });
      }
    }

    return {
      success: true,
      updatedCount: results.length,
      failedCount: failedResults.length,
      failedData: failedResults.length > 0 ? failedResults : null,
    };
  } catch (error) {
    console.error("一括タスクステータス更新エラー:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "タスクステータスの一括更新中にエラーが発生しました",
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
