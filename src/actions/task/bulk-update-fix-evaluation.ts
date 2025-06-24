"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 固定評価データの型定義
 */
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
      select: { id: true },
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
          select: {
            id: true,
            status: true,
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
            select: {
              id: true,
              status: true,
            },
          });

          // GroupPointテーブルの残高を更新
          // 1. 報告者と実行者のユーザーIDを取得
          const taskWithUsers = await tx.task.findUnique({
            where: { id: row.id },
            select: {
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
            const userIds = [
              ...new Set([
                ...taskWithUsers.reporters.map((r) => r.userId!),
                ...taskWithUsers.executors.map((e) => e.userId!),
              ]),
            ];

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
                select: { id: true },
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
