import type { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { bulkCreateEvaluations } from "@/actions/task/bulk-create-evaluation";
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

// revalidatePathのモック
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

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

/**
 * 共通のテストヘルパー関数
 */

/**
 * 正常系のPrismaモック設定
 */
function setupSuccessfulPrismaMock(tasks: { id: string }[], expectedCount: number) {
  prismaMock.$transaction.mockImplementation(async (callback) => {
    const mockTx = {
      task: {
        findMany: vi.fn().mockResolvedValue(tasks),
      },
      analytics: {
        createMany: vi.fn().mockResolvedValue({ count: expectedCount }),
      },
    };
    return await callback(mockTx as unknown as PrismaTransaction);
  });
}

/**
 * タスクが見つからない場合のPrismaモック設定
 */
function setupTaskNotFoundPrismaMock(foundTasks: { id: string }[]) {
  prismaMock.$transaction.mockImplementation(async (callback) => {
    const mockTx = {
      task: {
        findMany: vi.fn().mockResolvedValue(foundTasks),
      },
      analytics: {
        createMany: vi.fn(),
      },
    };
    return await callback(mockTx as unknown as PrismaTransaction);
  });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("bulkCreateEvaluations", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

      setupSuccessfulPrismaMock([{ id: testTask1.id }, { id: testTask2.id }], 2);

      // Act
      const result = await bulkCreateEvaluations(validEvaluationData, testGroup.id, testUser.id);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        data: [{ count: 2, message: "2件のデータを登録しました" }],
        message: "2件のデータを登録しました",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
    });

    test("should handle string contributionPoint values and duplicate taskIds", async () => {
      // Arrange
      const validEvaluationData: EvaluationTestData[] = [
        {
          taskId: testTask1.id,
          contributionPoint: "75", // 文字列として渡す
          evaluationLogic: "自動評価ロジック1",
        },
        {
          taskId: testTask1.id, // 重複するタスクID
          contributionPoint: "123.45", // 小数点を含む文字列
          evaluationLogic: "自動評価ロジック2",
        },
      ];

      setupSuccessfulPrismaMock([{ id: testTask1.id }], 2);

      // Act
      const result = await bulkCreateEvaluations(
        validEvaluationData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
        testGroup.id,
        testUser.id,
      );

      // Assert
      expect(result).toStrictEqual({
        success: true,
        data: [{ count: 2, message: "2件のデータを登録しました" }],
        message: "2件のデータを登録しました",
      });
    });

    test("should handle boundary values (zero contributionPoint, large data, long text)", async () => {
      // Arrange
      const boundaryTestData = [
        {
          taskId: testTask1.id,
          contributionPoint: 0, // 境界値：0
          evaluationLogic: "評価なし",
        },
        {
          taskId: testTask2.id,
          contributionPoint: Number.MAX_SAFE_INTEGER, // 最大値
          evaluationLogic: "a".repeat(1000), // 長い文字列
        },
      ];

      setupSuccessfulPrismaMock([{ id: testTask1.id }, { id: testTask2.id }], 2);

      // Act
      const result = await bulkCreateEvaluations(boundaryTestData, testGroup.id, testUser.id);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        data: [{ count: 2, message: "2件のデータを登録しました" }],
        message: "2件のデータを登録しました",
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

      setupSuccessfulPrismaMock(mockTasks, 100);

      // Act
      const result = await bulkCreateEvaluations(largeEvaluationData, testGroup.id, testUser.id);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        data: [{ count: 100, message: "100件のデータを登録しました" }],
        message: "100件のデータを登録しました",
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test.each([
      { data: [], expectedError: "無効なパラメータが指定されました" },
      { data: null as unknown as EvaluationTestData[], expectedError: "無効なパラメータが指定されました" },
    ])("should return error when rawData is empty or invalid", async ({ data, expectedError }) => {
      // Arrange & Act & Assert
      await expect(
        bulkCreateEvaluations(
          data as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
          testGroup.id,
          testUser.id,
        ),
      ).rejects.toThrow(expectedError);
    });

    test.each([
      {
        data: [{ contributionPoint: 100, evaluationLogic: "評価ロジック" }] as IncompleteEvaluationData[],
        expectedErrorContains: ["データ検証に失敗しました", "1行目", "taskId"],
      },
      {
        data: [{ taskId: "", contributionPoint: 100, evaluationLogic: "評価ロジック" }],
        expectedErrorContains: ["データ検証に失敗しました", "1行目"],
      },
      {
        data: [{ taskId: "valid-task-id", evaluationLogic: "評価ロジック" }] as IncompleteEvaluationData[],
        expectedErrorContains: ["データ検証に失敗しました", "1行目", "contributionPoint"],
      },
      {
        data: [{ taskId: "valid-task-id", contributionPoint: "", evaluationLogic: "評価ロジック" }],
        expectedErrorContains: ["データ検証に失敗しました", "1行目", "貢献度は必須です"],
      },
      {
        data: [{ taskId: "valid-task-id", contributionPoint: -10, evaluationLogic: "評価ロジック" }],
        expectedErrorContains: ["データ検証に失敗しました", "1行目", "貢献度は0以上の数値である必要があります"],
      },
      {
        data: [{ taskId: "valid-task-id", contributionPoint: "invalid", evaluationLogic: "評価ロジック" }],
        expectedErrorContains: ["データ検証に失敗しました", "1行目", "貢献度は有効な数値である必要があります"],
      },
      {
        data: [{ taskId: "valid-task-id", contributionPoint: 100 }] as IncompleteEvaluationData[],
        expectedErrorContains: ["データ検証に失敗しました", "1行目", "evaluationLogic"],
      },
      {
        data: [{ taskId: "valid-task-id", contributionPoint: 100, evaluationLogic: "" }],
        expectedErrorContains: ["データ検証に失敗しました", "1行目", "評価ロジックは必須です"],
      },
    ])("should return error for missing or invalid required fields", async ({ data, expectedErrorContains }) => {
      // Act & Assert
      const result = await bulkCreateEvaluations(
        data as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
        testGroup.id,
        testUser.id,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        for (const expectedText of expectedErrorContains) {
          expect(result.message).toContain(expectedText);
        }
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
          taskId: "valid-task-id",
          contributionPoint: "invalid", // 無効
          evaluationLogic: "有効な評価ロジック",
        },
      ];

      // バリデーションエラーのテストなので、prismaモックは設定しない

      // Act
      const result = await bulkCreateEvaluations(
        invalidData as unknown as { taskId: string; contributionPoint: number; evaluationLogic: string }[],
        testGroup.id,
        testUser.id,
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain("データ検証に失敗しました");
        expect(result.message).toContain("1行目");
        expect(result.message).toContain("2行目");
      }
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("データベースエラー", () => {
      test.each([
        {
          description: "single task not found",
          data: [{ taskId: "non-existent-task", contributionPoint: 100, evaluationLogic: "評価ロジック" }],
          foundTasks: [],
          expectedErrorContains: "以下のタスクIDが見つかりません: non-existent-task",
        },
        {
          description: "some tasks not found",
          data: [
            { taskId: testTask1.id, contributionPoint: 100, evaluationLogic: "評価ロジック1" },
            { taskId: "non-existent-task-1", contributionPoint: 50, evaluationLogic: "評価ロジック2" },
            { taskId: "non-existent-task-2", contributionPoint: 75, evaluationLogic: "評価ロジック3" },
          ],
          foundTasks: [{ id: testTask1.id }],
          expectedErrorContains: "以下のタスクIDが見つかりません",
        },
      ])("should return error when tasks not found", async ({ data, foundTasks, expectedErrorContains }) => {
        // Arrange & Act & Assert
        setupTaskNotFoundPrismaMock(foundTasks);
        await expect(bulkCreateEvaluations(data, testGroup.id, testUser.id)).rejects.toThrow(expectedErrorContains);
      });

      test("should handle various database errors", async () => {
        // Arrange
        const validEvaluationData = [
          {
            taskId: testTask1.id,
            contributionPoint: 100,
            evaluationLogic: "評価ロジック",
          },
        ];

        // Act & Assert
        const errorTestCases = [
          { error: new Error("データベース接続エラー"), expectedError: "データベース接続エラー" },
          { error: "予期しないエラー", expectedError: "予期しないエラー" },
        ];

        for (const testCase of errorTestCases) {
          prismaMock.$transaction.mockRejectedValue(testCase.error);

          await expect(bulkCreateEvaluations(validEvaluationData, testGroup.id, testUser.id)).rejects.toThrow(
            testCase.expectedError,
          );
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

        // Act & Assert
        await expect(bulkCreateEvaluations(validEvaluationData, testGroup.id, testUser.id)).rejects.toThrow(
          "データ作成エラー",
        );
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
      await bulkCreateEvaluations(validEvaluationData, testGroup.id, testUser.id);

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
        testUser.id,
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
