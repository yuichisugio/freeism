import type { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { bulkCreateEvaluations } from "@/lib/actions/task/modal/bulk-create-evaluation";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory, taskFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Prismaトランザクションの型定義
 */
type PrismaTransaction = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * 評価データの型定義（テスト用）
 */
type EvaluationTestData = {
  taskId: string;
  contributionPoint: number | string;
  evaluationLogic: string;
};

/**
 * 不完全な評価データの型定義（テスト用）
 */
type IncompleteEvaluationData = Partial<EvaluationTestData>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

// revalidatePathのモック
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの準備
 */
const testUser = userFactory.build({ id: "test-user-1" });
const testGroup = groupFactory.build({ id: "test-group-1" });
const testTask1 = taskFactory.build({ id: "test-task-1", groupId: testGroup.id });
const testTask2 = taskFactory.build({ id: "test-task-2", groupId: testGroup.id });

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("evaluation.ts", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("bulkCreateEvaluations", () => {
    describe("正常系", () => {
      test("should successfully create evaluations with valid data", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: "自動評価ロジック1",
          },
          {
            taskId: testTask2.id,
            contributionPoint: 50,
            evaluationLogic: "自動評価ロジック2",
          },
        ];

        // Prismaモックの設定
        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([{ id: testTask1.id }, { id: testTask2.id }]),
            },
            analytics: {
              createMany: vi.fn().mockResolvedValue({ count: 2 }),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(validEvaluationData, testGroup.id);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          analyses: [{ count: 2, message: "2件のデータを登録しました" }],
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
      });

      test("should handle string contributionPoint values", async () => {
        // Arrange
        const validEvaluationData: EvaluationTestData[] = [
          {
            taskId: testTask1.id,
            contributionPoint: "75", // 文字列として渡す
            evaluationLogic: "自動評価ロジック",
          },
        ];

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([{ id: testTask1.id }]),
            },
            analytics: {
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(
          validEvaluationData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
          testGroup.id,
        );

        // Assert
        expect(result).toStrictEqual({
          success: true,
          analyses: [{ count: 1, message: "1件のデータを登録しました" }],
        });
      });

      test("should handle duplicate taskIds correctly", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: "評価1",
          },
          {
            taskId: testTask1.id, // 重複するタスクID
            contributionPoint: 50,
            evaluationLogic: "評価2",
          },
        ];

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([{ id: testTask1.id }]),
            },
            analytics: {
              createMany: vi.fn().mockResolvedValue({ count: 2 }),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(validEvaluationData, testGroup.id);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          analyses: [{ count: 2, message: "2件のデータを登録しました" }],
        });
      });

      test("should handle zero contributionPoint", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 0, // 境界値：0
            evaluationLogic: "評価なし",
          },
        ];

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([{ id: testTask1.id }]),
            },
            analytics: {
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(validEvaluationData, testGroup.id);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          analyses: [{ count: 1, message: "1件のデータを登録しました" }],
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系 - 入力データ検証エラー", () => {
      test("should return error when rawData is empty array", async () => {
        // Arrange
        const emptyData: { taskId: string; contributionPoint: number; evaluationLogic: string }[] = [];

        // Act
        const result = await bulkCreateEvaluations(emptyData, testGroup.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "評価データが空か無効な形式です",
        });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      });

      test("should return error when rawData is not an array", async () => {
        // Arrange
        const invalidData = null as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[];

        // Act
        const result = await bulkCreateEvaluations(invalidData, testGroup.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "評価データが空か無効な形式です",
        });
      });

      test("should return error when taskId is missing", async () => {
        // Arrange
        const invalidData: IncompleteEvaluationData[] = [
          {
            // taskId: testTask1.id, // 必須フィールドを削除
            contributionPoint: 100,
            evaluationLogic: "評価ロジック",
          },
        ];

        // Act
        const result = await bulkCreateEvaluations(
          invalidData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
          testGroup.id,
        );

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("データ検証に失敗しました");
          expect(result.error).toContain("1行目");
          expect(result.error).toContain("taskId");
        }
      });

      test("should return error when taskId is empty string", async () => {
        // Arrange
        const invalidData: EvaluationTestData[] = [
          {
            taskId: "", // 空文字列
            contributionPoint: 100,
            evaluationLogic: "評価ロジック",
          },
        ];

        // Act
        const result = await bulkCreateEvaluations(
          invalidData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
          testGroup.id,
        );

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("データ検証に失敗しました");
          expect(result.error).toContain("1行目");
        }
      });

      test("should return error when contributionPoint is missing", async () => {
        // Arrange
        const invalidData: IncompleteEvaluationData[] = [
          {
            taskId: testTask1.id,
            // contributionPoint: 100, // 必須フィールドを削除
            evaluationLogic: "評価ロジック",
          },
        ];

        // Act
        const result = await bulkCreateEvaluations(
          invalidData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
          testGroup.id,
        );

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("データ検証に失敗しました");
          expect(result.error).toContain("1行目");
          expect(result.error).toContain("contributionPoint");
        }
      });

      test("should return error when contributionPoint is negative", async () => {
        // Arrange
        const invalidData = [
          {
            taskId: testTask1.id,
            contributionPoint: -10, // 負の値
            evaluationLogic: "評価ロジック",
          },
        ];

        // Act
        const result = await bulkCreateEvaluations(invalidData, testGroup.id);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("データ検証に失敗しました");
          expect(result.error).toContain("1行目");
          expect(result.error).toContain("貢献度は0以上の数値である必要があります");
        }
      });

      test("should return error when contributionPoint is invalid string", async () => {
        // Arrange
        const invalidData: EvaluationTestData[] = [
          {
            taskId: testTask1.id,
            contributionPoint: "invalid", // 無効な文字列
            evaluationLogic: "評価ロジック",
          },
        ];

        // Act
        const result = await bulkCreateEvaluations(
          invalidData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
          testGroup.id,
        );

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("データ検証に失敗しました");
          expect(result.error).toContain("1行目");
          expect(result.error).toContain("貢献度は有効な数値である必要があります");
        }
      });

      test("should return error when contributionPoint is empty string", async () => {
        // Arrange
        const invalidData: EvaluationTestData[] = [
          {
            taskId: testTask1.id,
            contributionPoint: "", // 空文字列
            evaluationLogic: "評価ロジック",
          },
        ];

        // Act
        const result = await bulkCreateEvaluations(
          invalidData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
          testGroup.id,
        );

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("データ検証に失敗しました");
          expect(result.error).toContain("1行目");
          expect(result.error).toContain("貢献度は必須です");
        }
      });

      test("should return error when evaluationLogic is missing", async () => {
        // Arrange
        const invalidData: IncompleteEvaluationData[] = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            // evaluationLogic: "評価ロジック", // 必須フィールドを削除
          },
        ];

        // Act
        const result = await bulkCreateEvaluations(
          invalidData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
          testGroup.id,
        );

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("データ検証に失敗しました");
          expect(result.error).toContain("1行目");
          expect(result.error).toContain("evaluationLogic");
        }
      });

      test("should return error when evaluationLogic is empty string", async () => {
        // Arrange
        const invalidData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: "", // 空文字列
          },
        ];

        // Act
        const result = await bulkCreateEvaluations(invalidData, testGroup.id);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("データ検証に失敗しました");
          expect(result.error).toContain("1行目");
          expect(result.error).toContain("評価ロジックは必須です");
        }
      });

      test("should return error with multiple validation errors", async () => {
        // Arrange
        const invalidData: EvaluationTestData[] = [
          {
            taskId: "", // 無効
            contributionPoint: -5, // 無効
            evaluationLogic: "", // 無効
          },
          {
            taskId: testTask1.id,
            contributionPoint: "invalid", // 無効
            evaluationLogic: "有効な評価ロジック",
          },
        ];

        // Act
        const result = await bulkCreateEvaluations(
          invalidData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
          testGroup.id,
        );

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("データ検証に失敗しました");
          expect(result.error).toContain("1行目");
          expect(result.error).toContain("2行目");
        }
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系 - データベースエラー", () => {
      test("should return error when task not found", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: "non-existent-task",
            contributionPoint: 100,
            evaluationLogic: "評価ロジック",
          },
        ];

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([]), // タスクが見つからない
            },
            analytics: {
              createMany: vi.fn(),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(validEvaluationData, testGroup.id);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("以下のタスクIDが見つかりません: non-existent-task");
        }
      });

      test("should return error when some tasks not found", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: "評価ロジック1",
          },
          {
            taskId: "non-existent-task-1",
            contributionPoint: 50,
            evaluationLogic: "評価ロジック2",
          },
          {
            taskId: "non-existent-task-2",
            contributionPoint: 75,
            evaluationLogic: "評価ロジック3",
          },
        ];

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([{ id: testTask1.id }]), // 一部のタスクのみ見つかる
            },
            analytics: {
              createMany: vi.fn(),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(validEvaluationData, testGroup.id);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("以下のタスクIDが見つかりません");
          expect(result.error).toContain("non-existent-task-1");
          expect(result.error).toContain("non-existent-task-2");
        }
      });

      test("should return error when authentication fails", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: "評価ロジック",
          },
        ];

        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証エラー"));

        // Act
        const result = await bulkCreateEvaluations(validEvaluationData, testGroup.id);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("認証エラー");
        }
      });

      test("should return error when database transaction fails", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: "評価ロジック",
          },
        ];

        prismaMock.$transaction.mockRejectedValue(new Error("データベース接続エラー"));

        // Act
        const result = await bulkCreateEvaluations(validEvaluationData, testGroup.id);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("データベース接続エラー");
        }
      });

      test("should return error when createMany fails", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: "評価ロジック",
          },
        ];

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([{ id: testTask1.id }]),
            },
            analytics: {
              createMany: vi.fn().mockRejectedValue(new Error("データ作成エラー")),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(validEvaluationData, testGroup.id);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("データ作成エラー");
        }
      });

      test("should return generic error when unknown error occurs", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: "評価ロジック",
          },
        ];

        // 非Errorオブジェクトをthrow
        prismaMock.$transaction.mockRejectedValue("予期しないエラー");

        // Act
        const result = await bulkCreateEvaluations(validEvaluationData, testGroup.id);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("貢献評価の一括登録中にエラーが発生しました");
        }
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("境界値テスト", () => {
      test("should handle single evaluation data", async () => {
        // Arrange
        const singleEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 1,
            evaluationLogic: "最小評価",
          },
        ];

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([{ id: testTask1.id }]),
            },
            analytics: {
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(singleEvaluationData, testGroup.id);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          analyses: [{ count: 1, message: "1件のデータを登録しました" }],
        });
      });

      test("should handle large number of evaluation data", async () => {
        // Arrange
        const largeEvaluationData = Array.from({ length: 100 }, (_, index) => ({
          taskId: `task-${index}`,
          contributionPoint: index + 1,
          evaluationLogic: `評価ロジック${index + 1}`,
        }));

        const mockTasks = Array.from({ length: 100 }, (_, index) => ({
          id: `task-${index}`,
        }));

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue(mockTasks),
            },
            analytics: {
              createMany: vi.fn().mockResolvedValue({ count: 100 }),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(largeEvaluationData, testGroup.id);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          analyses: [{ count: 100, message: "100件のデータを登録しました" }],
        });
      });

      test("should handle very long evaluationLogic", async () => {
        // Arrange
        const longEvaluationLogic = "a".repeat(1000); // 1000文字の長い文字列
        const evaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: longEvaluationLogic,
          },
        ];

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([{ id: testTask1.id }]),
            },
            analytics: {
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(evaluationData, testGroup.id);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          analyses: [{ count: 1, message: "1件のデータを登録しました" }],
        });
      });

      test("should handle maximum safe integer contributionPoint", async () => {
        // Arrange
        const maxSafeInteger = Number.MAX_SAFE_INTEGER;
        const evaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: maxSafeInteger,
            evaluationLogic: "最大値評価",
          },
        ];

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([{ id: testTask1.id }]),
            },
            analytics: {
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        const result = await bulkCreateEvaluations(evaluationData, testGroup.id);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          analyses: [{ count: 1, message: "1件のデータを登録しました" }],
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("データベース呼び出しの検証", () => {
      test("should call database methods with correct parameters", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: "評価ロジック1",
          },
          {
            taskId: testTask2.id,
            contributionPoint: 50,
            evaluationLogic: "評価ロジック2",
          },
        ];

        const mockFindMany = vi.fn().mockResolvedValue([{ id: testTask1.id }, { id: testTask2.id }]);
        const mockCreateMany = vi.fn().mockResolvedValue({ count: 2 });

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: { findMany: mockFindMany },
            analytics: { createMany: mockCreateMany },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        await bulkCreateEvaluations(validEvaluationData, testGroup.id);

        // Assert
        expect(mockFindMany).toHaveBeenCalledWith({
          where: {
            id: { in: [testTask1.id, testTask2.id] },
            groupId: testGroup.id,
          },
          select: {
            id: true,
          },
        });

        expect(mockCreateMany).toHaveBeenCalledWith({
          data: [
            {
              contributionPoint: 100,
              evaluationLogic: "評価ロジック1",
              evaluator: testUser.id,
              taskId: testTask1.id,
              groupId: testGroup.id,
            },
            {
              contributionPoint: 50,
              evaluationLogic: "評価ロジック2",
              evaluator: testUser.id,
              taskId: testTask2.id,
              groupId: testGroup.id,
            },
          ],
        });
      });

      test("should handle string contributionPoint conversion correctly", async () => {
        // Arrange
        const validEvaluationData: EvaluationTestData[] = [
          {
            taskId: testTask1.id,
            contributionPoint: "123.45", // 小数点を含む文字列
            evaluationLogic: "評価ロジック",
          },
        ];

        const mockCreateMany = vi.fn().mockResolvedValue({ count: 1 });

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            task: {
              findMany: vi.fn().mockResolvedValue([{ id: testTask1.id }]),
            },
            analytics: { createMany: mockCreateMany },
          };
          return await callback(mockTx as unknown as PrismaTransaction);
        });

        // Act
        await bulkCreateEvaluations(
          validEvaluationData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
          testGroup.id,
        );

        // Assert
        expect(mockCreateMany).toHaveBeenCalledWith({
          data: [
            {
              contributionPoint: 123.45, // 数値に変換されている
              evaluationLogic: "評価ロジック",
              evaluator: testUser.id,
              taskId: testTask1.id,
              groupId: testGroup.id,
            },
          ],
        });
      });
    });
  });
});
