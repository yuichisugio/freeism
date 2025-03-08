"use server";

import type { TaskFormValuesAndGroupId } from "@/components/task/task-input-form";
import type { TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "date-fns";

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
        creatorId: session.user.id,
        groupId: data.groupId,
        // 報告者の設定
        reporters: {
          create:
            data.reporters && data.reporters.length > 0
              ? // 報告者が指定されている場合
                data.reporters.map((reporter) => ({
                  name: reporter.name,
                  userId: reporter.userId,
                }))
              : // 報告者が指定されていない場合、作成者を報告者として追加
                [{ userId: session.user.id }],
        },
        // 実行者の設定
        executors: {
          create:
            data.executors && data.executors.length > 0
              ? // 実行者が指定されている場合
                data.executors.map((executor) => ({
                  name: executor.name,
                  userId: executor.userId,
                }))
              : // 実行者が指定されていない場合、作成者を実行者として追加
                [{ userId: session.user.id }],
        },
      },
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

/**
 * グループのタスク情報をCSV形式でエクスポートする関数
 * @param groupId - グループID
 * @param startDate - 開始日
 * @param endDate - 終了日
 * @param onlyTaskCompleted - TASK_COMPLETEDステータスのタスクのみを取得するフラグ（分析用）
 * @returns CSV形式のタスク情報
 */
export async function exportGroupTask(groupId: string, startDate?: Date, endDate?: Date, onlyTaskCompleted: boolean = false) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証エラーが発生しました");
    }

    // クエリ条件を構築
    let whereConditions: any = { groupId };

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
      whereConditions.status = "TASK_COMPLETED";
    }

    const tasks = await prisma.task.findMany({
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
    });

    if (!tasks) {
      throw new Error("タスクが見つかりません");
    }

    // タスクのユーザー名を取得。taskひとつが要素の配列なので、全部を.mapで繰り返して加工している
    const formattedTasks = tasks.map((task) => {
      // 報告者と実行者の名前をカンマ区切りで連結
      const reporterNames = task.reporters.map((r) => r.user?.name || r.name || "不明").join(", ");
      const executorNames = task.executors.map((e) => e.user?.name || e.name || "不明").join(", ");

      return {
        タスクID: task.id,
        タスク内容: task.task,
        参照: task.reference || "",
        証拠情報: task.info || "",
        ステータス: task.status,
        貢献ポイント: task.fixedContributionPoint || 0,
        評価者: task.fixedEvaluator || "",
        貢献タイプ: task.contributionType,
        作成者: task.creator.name || "不明",
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

/**
 * グループの分析結果をCSV形式でエクスポートする関数
 * @param groupId - グループID
 * @param page - 取得するページ番号（1ページ200件）
 * @param onlyFixed - FIX済みの分析結果のみを取得するフラグ
 * @param onlyTaskCompleted - TASK_COMPLETEDステータスのタスクのみを取得するフラグ（分析用）
 * @returns 評価者ごとに分けられたCSVデータ
 */
export async function exportGroupAnalytics(groupId: string, page: number = 1, onlyFixed: boolean = false, onlyTaskCompleted: boolean = false) {
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
    let whereConditions: any = { groupId };

    // FIX済みのみの条件
    if (onlyFixed) {
      whereConditions.AND = [
        { status: "POINTS_AWARDED" }, // ステータスがPOINTS_AWARDEDのもののみに限定
      ];
    } else if (onlyTaskCompleted) {
      // FIX済み条件がオフで、分析用の場合はTASK_COMPLETEDのみを対象とする
      whereConditions.AND = [{ status: "TASK_COMPLETED" }];
    }

    // タスク数を取得
    const tasksCount = await prisma.task.count({
      where: whereConditions,
    });

    const totalPages = Math.ceil(tasksCount / limit);

    // タスクを取得
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
    });

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
              id: { in: userIds },
            },
            select: {
              id: true,
              name: true,
            },
          })
        : [];

    // 取得したデータをマッピングするためのマップを作成
    const tasksMap = tasks.reduce<Record<string, any>>((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {});

    const usersMap = users.reduce<Record<string, any>>((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});

    // 最終的なデータを組み立てる
    const analytics = tasks.map((task) => {
      // 使用されない変数をコメントアウト
      // const evaluator = task.fixedEvaluator && usersMap[task.fixedEvaluator] ? usersMap[task.fixedEvaluator] : undefined;

      return {
        id: task.id,
        task: {
          id: task.id,
          task: task.task,
          reference: task.reference,
          status: task.status,
          contributionType: task.contributionType,
          info: task.info,
          executors: task.executors,
          reporters: task.reporters,
          creator: task.creator,
        },
        group: group,
      };
    });

    // 評価者ごとにグループ化
    const groupedByEvaluator: Record<string, any[]> = {};

    analytics.forEach((item) => {
      const task = tasksMap[item.id];
      const evaluatorId = task.fixedEvaluator;

      // nullの安全な処理
      const evaluator = evaluatorId && usersMap[evaluatorId] ? usersMap[evaluatorId] : undefined;
      const evaluatorName = evaluator ? evaluator.name : "未割り当て";
      const taskContent = task.task || "";
      const referenceContent = task.reference || "";
      const infoContent = task.info || "";

      // 報告者と実行者の名前を抽出
      const reporterNames = task.reporters
        .map((r: any) => (r.user ? r.user.name : r.name) || "")
        .filter((name: string) => name.length > 0)
        .join(", ");

      const executorNames = task.executors
        .map((e: any) => (e.user ? e.user.name : e.name) || "")
        .filter((name: string) => name.length > 0)
        .join(", ");

      // CSV用のデータ構造を作成
      const csvData: any = {
        分析ID: task.id,
        タスクID: task.id,
        貢献ポイント: task.fixedContributionPoint || 0,
        評価ロジック: task.fixedEvaluationLogic || "",
        評価者ID: task.fixedEvaluator || "",
        評価者名: evaluatorName,
        タスク内容: taskContent,
        参照情報: referenceContent,
        証拠情報: infoContent,
        ステータス: task.status,
        貢献タイプ: task.contributionType,
        タスク報告者: reporterNames,
        タスク実行者: executorNames,
        タスク作成者: task.creator ? task.creator.name : "",
        グループ目標: group.goal,
        評価方法: group.evaluationMethod,
        作成日: task.fixedEvaluationDate ? new Date(task.fixedEvaluationDate).toISOString().split("T")[0] : "",
      };

      // FIX済みの場合は追加情報を含める
      if (onlyFixed) {
        Object.assign(csvData, {
          評価日: task.fixedEvaluationDate ? task.fixedEvaluationDate.toISOString().split("T")[0] : "",
        });
      }

      // 評価者ごとのグループに追加
      if (!groupedByEvaluator[evaluatorName]) {
        groupedByEvaluator[evaluatorName] = [];
      }
      groupedByEvaluator[evaluatorName].push(csvData);
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
              creatorId: session.user?.id || "",
              groupId: groupId,
              // 作成者を報告者としても登録
              reporters: {
                create: [
                  {
                    userId: session.user?.id || "",
                  },
                ],
              },
              // 作成者を実行者としても登録
              executors: {
                create: [
                  {
                    userId: session.user?.id || "",
                  },
                ],
              },
            },
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

    revalidatePath(`/dashboard/group/${updatedTask.groupId}`);
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("[UPDATE_TASK_STATUS]", error);
    return { error: "タスクのステータスの更新中にエラーが発生しました" };
  }
}

/**
 * FIXした分析結果データをCSVからアップロードして、タスクを更新する関数
 * @param data - CSVから読み込んだ評価データ
 * @param groupId - グループID
 * @returns 処理結果と成功・失敗データを含むオブジェクト
 */
export async function bulkUpdateFixedEvaluations(data: any[], groupId: string) {
  try {
    const session = await auth();

    // 認証セッションが取得できない場合
    if (!session?.user?.id) {
      return {
        success: false,
        error: "認証エラーが発生しました",
        successData: [],
        failedData: data.map((item) => ({ ...item, 失敗理由: "認証エラー" })),
      };
    }

    // グループオーナーまたはアプリオーナーかどうかをチェック
    const isAppOwner = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAppOwner: true },
    });

    const isGroupOwner = await prisma.groupMembership.findFirst({
      where: {
        userId: session.user.id,
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
    const successData: any[] = [];
    const failedData: any[] = [];

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
          const contributionPoint = parseInt(row.fixedContributionPoint);
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

          // タスクを更新
          const updatedTask = await tx.task.update({
            where: { id: row.id },
            data: {
              fixedContributionPoint: contributionPoint,
              fixedEvaluator: row.fixedEvaluator,
              fixedEvaluationLogic: row.fixedEvaluationLogic,
              // @ts-ignore - fixedEvaluationDateはスキーマに存在するが型定義にない
              fixedEvaluationDate: evaluationDate,
              userFixedSubmitterId: session?.user?.id,
              status: "POINTS_AWARDED",
            },
          });

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
