import { revalidatePath } from "next/cache";
import { checkIsPermission } from "@/actions/permission/permission";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { bulkUpdateFixedEvaluations } from "./bulk-update-fix-evaluation";

/**
 * Prismaトランザクションの型定義
 */
type TaskFindFirstArgs = {
  where: {
    id: string;
    groupId: string;
  };
  select: {
    id: true;
    status: true;
  };
};

type TaskUpdateArgs = {
  where: { id: string };
  data: {
    fixedContributionPoint: number;
    fixedEvaluatorId: string;
    fixedEvaluationLogic: string;
    fixedEvaluationDate: Date;
    userFixedSubmitterId: string;
    status: TaskStatus;
  };
  select: {
    id: true;
    status: true;
  };
};

type TaskFindUniqueArgs = {
  where: { id: string };
  select: {
    reporters: {
      select: { userId: true };
      where: { userId: { not: null } };
    };
    executors: {
      select: { userId: true };
      where: { userId: { not: null } };
    };
  };
};

type GroupPointUpsertArgs = {
  where: {
    userId_groupId: {
      userId: string;
      groupId: string;
    };
  };
  update: {
    fixedTotalPoints: { increment: number };
  };
  create: {
    userId: string;
    groupId: string;
    fixedTotalPoints: number;
  };
};

type PrismaTransaction = {
  task: {
    findFirst: (args: TaskFindFirstArgs) => Promise<{ id: string; status: TaskStatus } | null>;
    update: (args: TaskUpdateArgs) => Promise<{ id: string; status: TaskStatus }>;
    findUnique: (args: TaskFindUniqueArgs) => Promise<{
      reporters: { userId: string }[];
      executors: { userId: string }[];
    } | null>;
  };
  groupPoint: {
    upsert: (args: GroupPointUpsertArgs) => Promise<{ id: string }>;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック設定
vi.mock("@/actions/permission/permission", () => ({
  checkIsPermission: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数の型定義
const mockCheckIsPermission = vi.mocked(checkIsPermission);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// トランザクション用のモックヘルパー
const createMockTransaction = (
  config: {
    taskExists?: boolean;
    taskStatus?: TaskStatus;
    taskUpdateError?: Error | string;
    hasUsers?: boolean;
  } = {},
) => {
  const { taskExists = true, taskStatus = TaskStatus.TASK_COMPLETED, taskUpdateError, hasUsers = true } = config;

  return vi.fn().mockImplementation(async (callback: (tx: PrismaTransaction) => Promise<void>) => {
    const mockTx: PrismaTransaction = {
      task: {
        findFirst: vi.fn().mockResolvedValue(taskExists ? { id: "task-1", status: taskStatus } : null),
        update: taskUpdateError
          ? vi.fn().mockRejectedValue(taskUpdateError)
          : vi.fn().mockResolvedValue({ id: "task-1", status: TaskStatus.POINTS_AWARDED }),
        findUnique: vi.fn().mockResolvedValue(
          hasUsers
            ? {
                reporters: [{ userId: "user-1" }],
                executors: [{ userId: "user-2" }],
              }
            : { reporters: [], executors: [] },
        ),
      },
      groupPoint: {
        upsert: vi.fn().mockResolvedValue({ id: "group-point-1" }),
      },
    };
    return callback(mockTx);
  });
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("bulkUpdateFixedEvaluations", () => {
  // テスト用定数
  const testUserId = "test-user-id";
  const testGroupId = "test-group-id";

  // 有効な評価データ
  const validEvaluationData = [
    {
      id: "task-1",
      fixedContributionPoint: "100",
      fixedEvaluatorId: "evaluator-1",
      fixedEvaluationLogic: "自動評価",
      fixedEvaluationDate: "2024-01-01T10:00:00Z",
    },
    {
      id: "task-2",
      fixedContributionPoint: 200,
      fixedEvaluatorId: "evaluator-2",
      fixedEvaluationLogic: "手動評価",
    },
  ];

  // 権限設定ヘルパー
  const setupPermission = (hasPermission: boolean) => {
    const result = hasPermission
      ? { success: true, message: "Permission check successfully" }
      : { success: false, message: "Permission check failed" };
    mockCheckIsPermission.mockResolvedValue(result);
  };

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
    // デフォルトで権限ありに設定
    setupPermission(true);
  });

  describe("正常系テスト", () => {
    test("有効なデータで固定評価を正常に更新する", async () => {
      // Arrange
      prismaMock.$transaction.mockImplementation(createMockTransaction());

      // Act
      const result = await bulkUpdateFixedEvaluations(validEvaluationData, testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successData).toHaveLength(2);
      expect(result.failedData).toHaveLength(0);
      expect(result.message).toContain("2件のタスクが正常に更新されました");
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroupId}`);
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    test("既存のGroupPointを正常に更新する", async () => {
      // Arrange
      prismaMock.$transaction.mockImplementation(createMockTransaction());

      // Act
      const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successData).toHaveLength(1);
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    test("重複するユーザーIDを正しく処理する", async () => {
      // Arrange
      prismaMock.$transaction.mockImplementation(
        createMockTransaction({
          hasUsers: true,
        }),
      );

      // Act
      const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successData).toHaveLength(1);
    });
  });

  describe("異常系テスト", () => {
    describe("権限エラーテスト", () => {
      test("権限がない場合はエラーを返す", async () => {
        // Arrange
        setupPermission(false);

        // Act
        const result = await bulkUpdateFixedEvaluations(validEvaluationData, testGroupId, testUserId);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("この操作を行う権限がありません");
        expect(result.failedData).toHaveLength(2);
        expect(result.failedData.every((item) => item.error === "システムエラー")).toBe(true);
      });

      test.each([
        {
          name: "両方のパラメータが不正な場合",
          userId: "",
          groupId: "",
        },
        {
          name: "userIs is empty",
          userId: "",
          groupId: "test-group-id",
        },
        {
          name: "groupId is empty",
          userId: "test-user-id",
          groupId: "",
        },
      ])("$name", async ({ userId, groupId }) => {
        // Act
        const result = await bulkUpdateFixedEvaluations(validEvaluationData, groupId, userId);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("パラメータが不正です");
      });

      test("空の配列を渡した場合", async () => {
        // Arrange
        prismaMock.$transaction.mockImplementation(createMockTransaction());

        // Act
        const result = await bulkUpdateFixedEvaluations([], testGroupId, testUserId);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "パラメータが不正です",
          failedData: [],
          successData: [],
        });
      });
    });

    describe("バリデーションエラーテスト", () => {
      test.each([
        {
          name: "タスクIDが空の場合",
          data: {
            id: "",
            fixedContributionPoint: "100",
            fixedEvaluatorId: "evaluator-1",
            fixedEvaluationLogic: "自動評価",
          },
          expectedError: "タスクIDが指定されていません",
        },
        {
          name: "貢献ポイントが数値でない場合",
          data: {
            id: "task-1",
            fixedContributionPoint: "invalid-number",
            fixedEvaluatorId: "evaluator-1",
            fixedEvaluationLogic: "自動評価",
          },
          expectedError: "固定貢献ポイントが数値ではありません",
        },
        {
          name: "評価者IDが空の場合",
          data: { id: "task-1", fixedContributionPoint: "100", fixedEvaluatorId: "", fixedEvaluationLogic: "自動評価" },
          expectedError: "固定評価者が指定されていません",
        },
        {
          name: "評価ロジックが空の場合",
          data: {
            id: "task-1",
            fixedContributionPoint: "100",
            fixedEvaluatorId: "evaluator-1",
            fixedEvaluationLogic: "",
          },
          expectedError: "固定評価ロジックが指定されていません",
        },
      ])("$name", async ({ data, expectedError }) => {
        // Arrange
        prismaMock.$transaction.mockImplementation(createMockTransaction({ taskUpdateError: "String error" }));

        // Act
        const result = await bulkUpdateFixedEvaluations([data], testGroupId, testUserId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.successData).toHaveLength(0);
        expect(result.failedData).toHaveLength(1);
        expect(result.failedData[0].error).toBe(expectedError);
      });
    });

    describe("タスク関連エラーテスト", () => {
      test("タスクが見つからない場合", async () => {
        // Arrange
        prismaMock.$transaction.mockImplementation(createMockTransaction({ taskExists: false }));

        // Act
        const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId, testUserId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.failedData).toHaveLength(1);
        expect(result.failedData[0].error).toBe("指定されたタスクが見つかりません");
      });

      test("タスクのステータスが不正な場合", async () => {
        // Arrange
        prismaMock.$transaction.mockImplementation(createMockTransaction({ taskStatus: TaskStatus.PENDING }));

        // Act
        const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId, testUserId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.failedData).toHaveLength(1);
        expect(result.failedData[0].error).toBe("タスクのステータスが「タスク完了」でないため更新できません");
      });
    });

    describe("システムエラーテスト", () => {
      test("データベースエラーが発生した場合", async () => {
        // Arrange
        prismaMock.$transaction.mockImplementation(vi.fn().mockRejectedValue(new Error("Database error")));

        // Act
        const result = await bulkUpdateFixedEvaluations(validEvaluationData, testGroupId, testUserId);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Database error");
        expect(result.failedData).toHaveLength(2);
        expect(result.failedData.every((item) => item.error === "システムエラー")).toBe(true);
      });

      test("個別のタスク更新でエラーが発生した場合", async () => {
        // Arrange
        prismaMock.$transaction.mockImplementation(
          createMockTransaction({ taskUpdateError: new Error("Task update failed") }),
        );

        // Act
        const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId, testUserId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.failedData).toHaveLength(1);
        expect(result.failedData[0].error).toBe("エラー: Task update failed");
      });
    });

    test("Error以外のオブジェクトでエラーが発生した場合", async () => {
      // Arrange
      prismaMock.$transaction.mockImplementation(createMockTransaction({ taskUpdateError: "String error" }));

      // Act
      const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedData).toHaveLength(1);
      expect(result.failedData[0].error).toBe("エラー: 不明なエラー");
    });
  });

  describe("境界値テスト", () => {
    test("評価日が指定されていない場合は現在日時を使用する", async () => {
      // Arrange
      const dataWithoutDate = [
        {
          id: "task-1",
          fixedContributionPoint: "100",
          fixedEvaluatorId: "evaluator-1",
          fixedEvaluationLogic: "自動評価",
          // fixedEvaluationDate なし
        },
      ];
      prismaMock.$transaction.mockImplementation(createMockTransaction());

      // Act
      const result = await bulkUpdateFixedEvaluations(dataWithoutDate, testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successData).toHaveLength(1);
    });

    test("不正な評価日が指定された場合は現在日時を使用する", async () => {
      // Arrange
      const dataWithInvalidDate = [
        {
          id: "task-1",
          fixedContributionPoint: "100",
          fixedEvaluatorId: "evaluator-1",
          fixedEvaluationLogic: "自動評価",
          fixedEvaluationDate: "invalid-date",
        },
      ];
      prismaMock.$transaction.mockImplementation(createMockTransaction());

      // Act
      const result = await bulkUpdateFixedEvaluations(dataWithInvalidDate, testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successData).toHaveLength(1);
    });

    describe("混合結果テスト", () => {
      test("成功と失敗が混在する場合", async () => {
        // Arrange
        const mixedData = [
          validEvaluationData[0], // 成功
          { id: "", fixedContributionPoint: "100", fixedEvaluatorId: "evaluator-1", fixedEvaluationLogic: "自動評価" }, // 失敗
          validEvaluationData[1], // 成功
        ];
        prismaMock.$transaction.mockImplementation(createMockTransaction());

        // Act
        const result = await bulkUpdateFixedEvaluations(mixedData, testGroupId, testUserId);

        // Assert
        expect(result.success).toBe(true);

        expect(result.successData).toHaveLength(2);
        expect(result.failedData).toHaveLength(1);
        expect(result.message).toBe("2件のタスクが正常に更新されました。1件の更新に失敗しました。");
      });
    });
  });
});
