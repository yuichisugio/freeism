"use server";

import type { TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { contributionType } from "@prisma/client";

import { checkIsAppOwner, checkIsOwner } from "../permission";

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
                currentHighestBid: 0,
                extensionTotalCount: 0,
                extensionLimitCount: 3,
                extensionTime: 10,
                remainingTimeForExtension: 10,
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

type FixedEvaluationData = {
  id: string;
  fixedContributionPoint: string | number;
  fixedEvaluatorId: string;
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
          if (!row.fixedEvaluatorId) {
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
              fixedEvaluatorId: row.fixedEvaluatorId,
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

    const isAppOwner = await checkIsAppOwner(userId);

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
      fixedEvaluatorId: string | null;
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
        const isGroupOwner = await checkIsOwner(userId, task.group.id);

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
