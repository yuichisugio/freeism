"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/library-setting/prisma";
import { z } from "zod"; // zodを使用して型検証を行います

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSVからインポートする評価データの検証スキーマ
 * すべてのフィールドを必須にして、データの完全性を確保
 */
const evaluationDataSchema = z.object({
  taskId: z.string().min(1, "タスクIDは必須です"),
  contributionPoint: z.union([
    z.number().min(0, "貢献度は0以上の数値である必要があります"),
    z
      .string()
      .min(1, "貢献度は必須です")
      .transform((val) => {
        const num = Number(val);
        if (isNaN(num)) {
          throw new Error("貢献度は有効な数値である必要があります");
        }
        if (num < 0) {
          throw new Error("貢献度は0以上の数値である必要があります");
        }
        return num;
      }),
  ]),
  evaluationLogic: z.string().min(1, "評価ロジックは必須です"),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSVからインポートする評価データの型定義
 */
type EvaluationImportData = z.infer<typeof evaluationDataSchema>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 評価結果の型定義
 */
type EvaluationResult =
  | { success: true; analyses: Array<{ count: number; message: string }> }
  | { success: false; error: string; details?: Record<string, unknown> };

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSVから貢献評価を一括登録する関数
 * @param rawData - CSVから読み込んだ評価データ
 * @param groupId - グループID
 * @returns 処理結果を含むオブジェクト
 */
export async function bulkCreateEvaluations(
  rawData: EvaluationImportData[],
  groupId: string,
  userId: string,
): Promise<EvaluationResult> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * パラメータの検証
     */
    if (!groupId || !userId || !rawData || rawData.length === 0 || !Array.isArray(rawData)) {
      throw new Error("無効なパラメータが指定されました");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 各行のデータを検証
     */
    const validationResults = rawData.map((item, index) => {
      try {
        // Zodスキーマを使用してデータを検証
        const validData = evaluationDataSchema.parse(item);

        return { success: true as const, data: validData, rowIndex: index + 1 };
      } catch (err) {
        // 検証エラーの詳細を取得
        const errorMessage =
          err instanceof z.ZodError
            ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
            : err instanceof Error
              ? err.message
              : "不明な検証エラー";

        return {
          success: false as const,
          error: `${index + 1}行目: ${errorMessage}`,
          rowIndex: index + 1,
        };
      }
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 検証エラーがあれば、検証エラーのみの配列を作成
     */
    const validationErrors = validationResults.filter(
      (result): result is { success: false; error: string; rowIndex: number } => !result.success,
    );

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 検証エラーがあれば中断
     */
    if (validationErrors.length > 0) {
      const errorMessages = validationErrors.map((e) => e.error);
      throw new Error(`データ検証に失敗しました: ${errorMessages.join("; ")}`);
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 検証済みデータを抽出
     */
    const validatedData = validationResults
      .filter((result): result is { success: true; data: EvaluationImportData; rowIndex: number } => result.success)
      .map((result) => result.data);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクIDの一覧を取得
     */
    const taskIds = [...new Set(validatedData.map((item) => item.taskId))];

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * トランザクションを使用してデータを一括登録
     */
    const result = await prisma.$transaction(async (tx) => {
      // 全タスクを一度に取得
      const existingTasks = await tx.task.findMany({
        where: {
          id: { in: taskIds },
          groupId: groupId,
        },
        select: {
          id: true,
        },
      });

      // タスクIDからタスクへのマッピングを作成（高速検索用）
      const taskMap = new Set(existingTasks.map((task) => task.id));

      // 見つからないタスクIDをチェック
      const missingTaskIds = taskIds.filter((id) => !taskMap.has(id));
      if (missingTaskIds.length > 0) {
        throw new Error(`以下のタスクIDが見つかりません: ${missingTaskIds.join(", ")}`);
      }

      // 評価データを一括作成（createManyで効率化）
      const createdRecords = await tx.analytics.createMany({
        data: validatedData.map((row) => ({
          contributionPoint: Number(row.contributionPoint),
          evaluationLogic: row.evaluationLogic,
          evaluator: userId,
          taskId: row.taskId,
          groupId,
        })),
      });

      return createdRecords;
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 正常処理の完了、ページのキャッシュを更新
     */
    revalidatePath(`/dashboard/group/${groupId}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果を返却
     */
    return { success: true, analyses: [{ count: result.count, message: `${result.count}件のデータを登録しました` }] };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラーを返却
     */
  } catch (error) {
    console.error("[BULK_CREATE_EVALUATIONS]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "貢献評価の一括登録中にエラーが発生しました",
    };
  }
}
