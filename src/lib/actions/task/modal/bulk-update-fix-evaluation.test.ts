import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { checkIsPermission } from "@/lib/actions/permission";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  groupMembershipFactory,
  groupPointFactory,
  taskFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { bulkUpdateFixedEvaluations } from "./bulk-update-fix-evaluation";

// モック設定
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("../permission", () => ({
  checkIsOwner: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// モック関数の型定義
const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);
const mockCheckIsOwner = vi.mocked(checkIsPermission);
const mockRevalidatePath = vi.mocked(revalidatePath);

describe("upload-modal", () => {
  const testUserId = "test-user-id";
  const testGroupId = "test-group-id";

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
    mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
    mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });
  });

  describe("bulkUpdateFixedEvaluations", () => {
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

    test("should update fixed evaluations successfully for app owner", async () => {
      // Arrange
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });
      const tasks = validEvaluationData.map((data) =>
        taskFactory.build({ id: data.id, status: TaskStatus.TASK_COMPLETED }),
      );

      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);
      prismaMock.groupMembership.findFirst.mockResolvedValue(null);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
              const task = tasks.find((t) => t.id === where.id);
              return Promise.resolve(task ? { id: task.id, status: task.status } : null);
            }),
            update: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
              const task = tasks.find((t) => t.id === where.id);
              return Promise.resolve({
                id: task ? (task as unknown as { id: string }).id : undefined,
                status: "POINTS_AWARDED",
              });
            }),
            findUnique: vi.fn().mockImplementation(() => {
              return Promise.resolve({
                reporters: [{ userId: "user-1" }],
                executors: [{ userId: "user-2" }],
              });
            }),
          },
          groupPoint: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: "group-point-1" }),
            update: vi.fn().mockResolvedValue({ id: "group-point-1" }),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations(validEvaluationData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successData).toHaveLength(2);
      expect(result.failedData).toHaveLength(0);
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroupId}`);
    });

    test("should update fixed evaluations successfully for group owner", async () => {
      // Arrange
      const regularUser = userFactory.build({ id: testUserId, isAppOwner: false });
      const groupMembership = groupMembershipFactory.build({
        userId: testUserId,
        groupId: testGroupId,
        isGroupOwner: true,
      });

      prismaMock.user.findUnique.mockResolvedValue(regularUser);
      prismaMock.groupMembership.findFirst.mockResolvedValue(groupMembership);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockResolvedValue({ id: "task-1", status: TaskStatus.TASK_COMPLETED }),
            update: vi.fn().mockResolvedValue({ id: "task-1", status: "POINTS_AWARDED" }),
            findUnique: vi.fn().mockResolvedValue({
              reporters: [{ userId: "user-1" }],
              executors: [{ userId: "user-2" }],
            }),
          },
          groupPoint: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: "group-point-1" }),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successData).toHaveLength(1);
    });

    test("should return error when user has no permission", async () => {
      // Arrange
      const regularUser = userFactory.build({ id: testUserId, isAppOwner: false });
      prismaMock.user.findUnique.mockResolvedValue(regularUser);
      prismaMock.groupMembership.findFirst.mockResolvedValue(null);

      // Act
      const result = await bulkUpdateFixedEvaluations(validEvaluationData, testGroupId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("この操作を行う権限がありません");
      expect(result.failedData).toHaveLength(2);
      expect(result.failedData[0].失敗理由).toBe("アクセス権限エラー");
    });

    test("should handle missing task ID", async () => {
      // Arrange
      const invalidData = [
        { id: "", fixedContributionPoint: "100", fixedEvaluatorId: "evaluator-1", fixedEvaluationLogic: "自動評価" },
      ];
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });

      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {};
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations(invalidData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successData).toHaveLength(0);
      expect(result.failedData).toHaveLength(1);
      expect(result.failedData[0].失敗理由).toBe("タスクIDが指定されていません");
    });

    test("should handle task not found", async () => {
      // Arrange
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });
      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedData).toHaveLength(1);
      expect(result.failedData[0].失敗理由).toBe("指定されたタスクが見つかりません");
    });

    test("should handle task with invalid status", async () => {
      // Arrange
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });
      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockResolvedValue({ id: "task-1", status: TaskStatus.PENDING }),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedData).toHaveLength(1);
      expect(result.failedData[0].失敗理由).toBe("タスクのステータスが「タスク完了」でないため更新できません");
    });

    test("should handle invalid contribution point", async () => {
      // Arrange
      const invalidData = [
        {
          id: "task-1",
          fixedContributionPoint: "invalid-number",
          fixedEvaluatorId: "evaluator-1",
          fixedEvaluationLogic: "自動評価",
        },
      ];
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });

      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockResolvedValue({ id: "task-1", status: TaskStatus.TASK_COMPLETED }),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations(invalidData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedData).toHaveLength(1);
      expect(result.failedData[0].失敗理由).toBe("固定貢献ポイントが数値ではありません");
    });

    test("should handle missing evaluator ID", async () => {
      // Arrange
      const invalidData = [
        {
          id: "task-1",
          fixedContributionPoint: "100",
          fixedEvaluatorId: "",
          fixedEvaluationLogic: "自動評価",
        },
      ];
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });

      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockResolvedValue({ id: "task-1", status: TaskStatus.TASK_COMPLETED }),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations(invalidData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedData).toHaveLength(1);
      expect(result.failedData[0].失敗理由).toBe("固定評価者が指定されていません");
    });

    test("should handle missing evaluation logic", async () => {
      // Arrange
      const invalidData = [
        {
          id: "task-1",
          fixedContributionPoint: "100",
          fixedEvaluatorId: "evaluator-1",
          fixedEvaluationLogic: "",
        },
      ];
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });

      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockResolvedValue({ id: "task-1", status: TaskStatus.TASK_COMPLETED }),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations(invalidData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedData).toHaveLength(1);
      expect(result.failedData[0].失敗理由).toBe("固定評価ロジックが指定されていません");
    });

    test("should handle database error during transaction", async () => {
      // Arrange
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });
      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);
      prismaMock.$transaction.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await bulkUpdateFixedEvaluations(validEvaluationData, testGroupId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("タスクの一括更新中にエラーが発生しました");
      expect(result.failedData).toHaveLength(2);
      expect(result.failedData[0].失敗理由).toBe("システムエラー");
    });

    test("should update existing group points", async () => {
      // Arrange
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });
      const existingGroupPoint = groupPointFactory.build({ userId: "user-1", groupId: testGroupId });

      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockResolvedValue({ id: "task-1", status: TaskStatus.TASK_COMPLETED }),
            update: vi.fn().mockResolvedValue({ id: "task-1", status: "POINTS_AWARDED" }),
            findUnique: vi.fn().mockResolvedValue({
              reporters: [{ userId: "user-1" }],
              executors: [{ userId: "user-1" }], // 同じユーザー（重複排除テスト）
            }),
          },
          groupPoint: {
            findUnique: vi.fn().mockResolvedValue(existingGroupPoint),
            update: vi.fn().mockResolvedValue({ id: "group-point-1" }),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successData).toHaveLength(1);
    });

    test("should handle authentication error in transaction", async () => {
      // Arrange
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });
      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);

      // 認証情報が不正な場合をテスト（userIdがnullの場合）
      mockGetAuthenticatedSessionUserId.mockResolvedValueOnce(null as unknown as string);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockResolvedValue({ id: "task-1", status: TaskStatus.TASK_COMPLETED }),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedData).toHaveLength(1);
      expect(result.failedData[0].失敗理由).toBe("認証情報が不正です");
    });

    test("should handle individual task update error in transaction", async () => {
      // Arrange
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });
      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockResolvedValue({ id: "task-1", status: TaskStatus.TASK_COMPLETED }),
            update: vi.fn().mockRejectedValue(new Error("Task update failed")),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedData).toHaveLength(1);
      expect(result.failedData[0].失敗理由).toBe("エラー: Task update failed");
    });

    test("should handle non-Error object in catch block", async () => {
      // Arrange
      const appOwnerUser = userFactory.build({ id: testUserId, isAppOwner: true });
      prismaMock.user.findUnique.mockResolvedValue(appOwnerUser);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            findFirst: vi.fn().mockResolvedValue({ id: "task-1", status: TaskStatus.TASK_COMPLETED }),
            update: vi.fn().mockRejectedValue("String error"), // Error オブジェクトではない
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkUpdateFixedEvaluations([validEvaluationData[0]], testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedData).toHaveLength(1);
      expect(result.failedData[0].失敗理由).toBe("エラー: 不明なエラー");
    });
  });
});
