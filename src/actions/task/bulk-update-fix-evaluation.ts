"use server";

import { revalidatePath } from "next/cache";
import { checkIsPermission } from "@/actions/permission/permission";
import { prisma } from "@/library-setting/prisma";
import { TaskStatus } from "@prisma/client";

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
  error?: string;
  status?: TaskStatus;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * FIXした分析結果データをCSVからアップロードして、タスクを更新する関数
 * @param data - CSVから読み込んだ評価データ
 * @param groupId - グループID
 * @returns 処理結果と成功・失敗データを含むオブジェクト
 */
export async function bulkUpdateFixedEvaluations(data: FixedEvaluationData[], groupId: string, userId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  try {
    /**
     * パラメータチェック
     */
    if (!userId || !groupId) {
      throw new Error("パラメータが不正です");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 権限チェック
     */
    const isPermission = await checkIsPermission(userId, groupId, undefined, false);

    if (!isPermission.success) {
      throw new Error("この操作を行う権限がありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 成功したデータと失敗したデータを保存する配列
    const successData: FixedEvaluationData[] = [];
    const failedData: FixedEvaluationData[] = [];

    // トランザクションを使用してデータを一括更新
    await prisma.$transaction(async (tx) => {
      // 行ごとに処理を行う
      for (const row of data) {
        // 行ごとのデータを取得
        const { id, fixedContributionPoint, fixedEvaluatorId, fixedEvaluationLogic, fixedEvaluationDate } = row;

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        /**
         * 必須項目のチェック
         */
        if (!id) {
          failedData.push({ ...row, error: "タスクIDが指定されていません" });
          continue;
        }

        // 評価ポイントが数値かをチェック
        const contributionPoint = parseInt(fixedContributionPoint.toString());
        if (isNaN(contributionPoint)) {
          failedData.push({ ...row, error: "固定貢献ポイントが数値ではありません" });
          continue;
        }

        // 評価者と評価ロジックのチェック
        if (!fixedEvaluatorId) {
          failedData.push({ ...row, error: "固定評価者が指定されていません" });
          continue;
        }

        if (!fixedEvaluationLogic) {
          failedData.push({ ...row, error: "固定評価ロジックが指定されていません" });
          continue;
        }

        // 評価日の確認（指定がなければ現在の日時）
        let evaluationDate: Date;
        if (fixedEvaluationDate) {
          const dateValue = new Date(fixedEvaluationDate);
          evaluationDate = isNaN(dateValue.getTime()) ? new Date() : dateValue;
        } else {
          evaluationDate = new Date();
        }

        // セッションのユーザーIDチェック
        if (!userId) {
          failedData.push({ ...row, error: "認証情報が不正です" });
          continue;
        }

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
        try {
          /**
           * タスクの存在確認
           */
          const task = await tx.task.findFirst({
            where: {
              id,
              groupId: groupId,
            },
            select: {
              id: true,
              status: true,
            },
          });

          if (!task) {
            failedData.push({ ...row, error: "指定されたタスクが見つかりません" });
            continue;
          }

          // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

          /**
           * タスクのステータスが TASK_COMPLETED かどうかチェック
           */
          if (task.status !== TaskStatus.TASK_COMPLETED) {
            failedData.push({ ...row, error: "タスクのステータスが「タスク完了」でないため更新できません" });
            continue;
          }

          // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

          /**
           * タスクを更新
           */
          const updatedTask = await tx.task.update({
            where: { id },
            data: {
              fixedContributionPoint: contributionPoint,
              fixedEvaluatorId,
              fixedEvaluationLogic,
              fixedEvaluationDate: evaluationDate,
              userFixedSubmitterId: userId,
              status: TaskStatus.POINTS_AWARDED,
            },
            select: {
              id: true,
              status: true,
            },
          });

          // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

          /**
           * GroupPointテーブルの残高を更新
           */
          // 1. 報告者と実行者のユーザーIDを取得
          const taskWithUsers = await tx.task.findUnique({
            where: { id },
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

          // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

          /**
           * タスクの実行者と報告者のユーザーIDを取得
           */
          if (taskWithUsers) {
            // 重複を排除したユーザーIDリストを作成
            const userIds = [
              ...new Set([
                ...taskWithUsers.reporters.map((r) => r.userId!),
                ...taskWithUsers.executors.map((e) => e.userId!),
              ]),
            ];

            // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

            /**
             * 各ユーザーのGroupPointを更新
             */
            for (const userId of userIds) {
              // GroupPointが存在しなければ作成、存在すれば更新
              await tx.groupPoint.upsert({
                where: { userId_groupId: { userId: userId, groupId: groupId } },
                update: {
                  balance: { increment: contributionPoint },
                  fixedTotalPoints: { increment: contributionPoint },
                },
                create: {
                  userId: userId,
                  groupId: groupId,
                  balance: contributionPoint,
                  fixedTotalPoints: contributionPoint,
                },
              });
            }
          }

          // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

          /**
           * 成功データを保存
           */
          successData.push({ ...row, status: updatedTask.status });
        } catch (error) {
          // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

          /**
           * エラーを保存
           */
          console.error(`タスク更新エラー (ID: ${id}):`, error);
          failedData.push({ ...row, error: `エラー: ${error instanceof Error ? error.message : "不明なエラー"}` });
        }
      }
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 再検証
     */
    revalidatePath(`/dashboard/group/${groupId}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果を返却
     */
    return {
      success: true,
      successData,
      failedData,
      message: `${successData.length}件のタスクが正常に更新されました。${failedData.length > 0 ? `${failedData.length}件の更新に失敗しました。` : ""}`,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("[BULK_UPDATE_FIXED_EVALUATIONS]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "タスクの一括更新中にエラーが発生しました",
      successData: [],
      failedData: data.map((item) => ({ ...item, error: "システムエラー" })),
    };
  }
}
