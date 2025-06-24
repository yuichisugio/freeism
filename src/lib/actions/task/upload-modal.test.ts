import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
// モジュールのインポート
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  groupFactory,
  groupMembershipFactory,
  groupPointFactory,
  taskFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { contributionType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { checkIsPermission } from "../permission";
import { bulkCreateTasks, bulkUpdateFixedEvaluations, bulkUpdateTaskStatuses } from "./upload-modal";

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

  describe("bulkCreateTasks", () => {
    const validTaskData = [
      {
        task: "テストタスク1",
        detail: "詳細1",
        reference: "https://example.com",
        info: "情報1",
        contributionType: contributionType.NON_REWARD,
        deliveryMethod: "オンライン",
      },
      {
        task: "テストタスク2",
        detail: "詳細2",
        reference: null,
        info: null,
        contributionType: contributionType.REWARD,
        deliveryMethod: "オフライン",
        auctionStartTime: new Date("2024-01-01T10:00:00Z"),
        auctionEndTime: new Date("2024-01-08T10:00:00Z"),
      },
    ];

    test("should create tasks successfully with valid data", async () => {
      // Arrange
      const group = groupFactory.build({ id: testGroupId });
      const createdTasks = validTaskData.map((_, index) => ({ id: `task-${index + 1}` }));

      prismaMock.group.findUnique.mockResolvedValue(group);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            create: vi.fn().mockImplementation(() => {
              const index = createdTasks.length - validTaskData.length + 1;
              return Promise.resolve({ id: `task-${index}` });
            }),
          },
          auction: {
            create: vi.fn().mockResolvedValue({ id: "auction-1" }),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkCreateTasks(validTaskData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.tasks).toBeDefined();
      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: testGroupId },
        select: { id: true },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroupId}`);
    });

    test("should return error when groupId is empty", async () => {
      // Act
      const result = await bulkCreateTasks(validTaskData, "");

      // Assert
      expect(result.error).toBe("グループIDが指定されていません");
      expect(result.success).toBeUndefined();
    });

    test("should return error when groupId is null", async () => {
      // Act
      const result = await bulkCreateTasks(validTaskData, null as unknown as string);

      // Assert
      expect(result.error).toBe("グループIDが指定されていません");
    });

    test("should return error when group does not exist", async () => {
      // Arrange
      prismaMock.group.findUnique.mockResolvedValue(null);

      // Act
      const result = await bulkCreateTasks(validTaskData, testGroupId);

      // Assert
      expect(result.error).toBe("指定されたグループが見つかりません");
      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: testGroupId },
        select: { id: true },
      });
    });

    test("should create auction when contributionType is REWARD", async () => {
      // Arrange
      const rewardTaskData = [
        {
          task: "報酬タスク",
          contributionType: contributionType.REWARD,
          auctionStartTime: new Date("2024-01-01T10:00:00Z"),
          auctionEndTime: new Date("2024-01-08T10:00:00Z"),
        },
      ];

      const group = groupFactory.build({ id: testGroupId });
      prismaMock.group.findUnique.mockResolvedValue(group);

      const mockAuctionCreate = vi.fn().mockResolvedValue({ id: "auction-1" });
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            create: vi.fn().mockResolvedValue({ id: "task-1" }),
          },
          auction: {
            create: mockAuctionCreate,
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkCreateTasks(rewardTaskData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(mockAuctionCreate).toHaveBeenCalledWith({
        data: {
          taskId: "task-1",
          startTime: new Date("2024-01-01T10:00:00Z"),
          endTime: new Date("2024-01-08T10:00:00Z"),
          currentHighestBid: 0,
          extensionTotalCount: 0,
          extensionLimitCount: 3,
          extensionTime: 10,
          remainingTimeForExtension: 10,
          groupId: testGroupId,
        },
      });
    });

    test("should handle invalid date strings gracefully", async () => {
      // Arrange
      const invalidDateTaskData = [
        {
          task: "無効な日付タスク",
          contributionType: contributionType.REWARD,
          auctionStartTime: "invalid-date",
          auctionEndTime: "invalid-date",
        },
      ];

      const group = groupFactory.build({ id: testGroupId });
      prismaMock.group.findUnique.mockResolvedValue(group);

      const mockAuctionCreate = vi.fn().mockResolvedValue({ id: "auction-1" });
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            create: vi.fn().mockResolvedValue({ id: "task-1" }),
          },
          auction: {
            create: mockAuctionCreate,
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkCreateTasks(invalidDateTaskData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      // デフォルトの日時が使用されることを確認
      expect(mockAuctionCreate).toHaveBeenCalled();
    });

    test("should handle empty data array", async () => {
      // Arrange
      const group = groupFactory.build({ id: testGroupId });
      prismaMock.group.findUnique.mockResolvedValue(group);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: { create: vi.fn() },
          auction: { create: vi.fn() },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkCreateTasks([], testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.tasks).toEqual([]);
    });

    test("should handle database transaction error", async () => {
      // Arrange
      const group = groupFactory.build({ id: testGroupId });
      prismaMock.group.findUnique.mockResolvedValue(group);
      prismaMock.$transaction.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await bulkCreateTasks(validTaskData, testGroupId);

      // Assert
      expect(result.error).toBe("タスクの一括登録中にエラーが発生しました");
      expect(result.success).toBeUndefined();
    });
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

  describe("bulkUpdateTaskStatuses", () => {
    const validStatusData = [
      { taskId: "task-1", status: TaskStatus.PENDING },
      { taskId: "task-2", status: TaskStatus.TASK_COMPLETED },
    ];

    test("should update task statuses successfully", async () => {
      // Arrange
      const tasks = validStatusData.map((data) => ({
        id: data.taskId,
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        group: { id: testGroupId },
      }));

      // 各タスクに対してfindUniqueとupdateをモック
      prismaMock.task.findUnique
        .mockResolvedValueOnce(tasks[0] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[1] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);

      prismaMock.task.update
        .mockResolvedValueOnce({
          id: tasks[0].id,
          task: "テストタスク1",
          reference: null,
          status: TaskStatus.PENDING,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: tasks[1].id,
          task: "テストタスク2",
          reference: null,
          status: TaskStatus.TASK_COMPLETED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>);

      // Act
      const result = await bulkUpdateTaskStatuses(validStatusData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockCheckIsOwner).toHaveBeenCalledTimes(2);
    });

    test("should handle missing task ID", async () => {
      // Arrange
      const invalidData = [{ taskId: "", status: TaskStatus.PENDING }];

      // Act
      const result = await bulkUpdateTaskStatuses(invalidData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("タスクIDが指定されていません");
    });

    test("should handle missing status", async () => {
      // Arrange
      const invalidData = [{ taskId: "task-1", status: "" }];

      // Act
      const result = await bulkUpdateTaskStatuses(invalidData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("ステータスが指定されていません");
    });

    test("should handle invalid status", async () => {
      // Arrange
      const invalidData = [{ taskId: "task-1", status: "INVALID_STATUS" }];

      // Act
      const result = await bulkUpdateTaskStatuses(invalidData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("無効なステータスです: INVALID_STATUS");
    });

    test("should handle task not found", async () => {
      // Arrange
      const validData = [{ taskId: "non-existent-task", status: TaskStatus.PENDING }];
      prismaMock.task.findUnique.mockResolvedValue(null);

      // Act
      const result = await bulkUpdateTaskStatuses(validData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("タスクが見つかりません");
    });

    test("should handle permission denied", async () => {
      // Arrange
      const task = {
        id: "task-1",
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        group: { id: testGroupId },
      };

      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );
      mockCheckIsOwner.mockResolvedValue({ success: false, message: "Permission check failed" });

      // Act
      const result = await bulkUpdateTaskStatuses([{ taskId: "task-1", status: TaskStatus.PENDING }]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("このタスクのステータスを変更する権限がありません");
    });

    test("should handle immutable status", async () => {
      // Arrange
      const task = {
        id: "task-1",
        status: TaskStatus.FIXED_EVALUATED, // 変更不可ステータス
        fixedContributionPoint: null,
        group: { id: testGroupId },
      };

      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );

      // Act
      const result = await bulkUpdateTaskStatuses([{ taskId: "task-1", status: TaskStatus.PENDING }]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("このステータス(FIXED_EVALUATED)のタスクは変更できません");
    });

    test("should update group points when status changes to POINTS_AWARDED", async () => {
      // Arrange
      const task = {
        id: "task-1",
        status: TaskStatus.TASK_COMPLETED,
        fixedContributionPoint: 100,
        group: { id: testGroupId },
      };

      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );
      prismaMock.task.update.mockResolvedValue({
        id: "task-1",
        task: "テストタスク",
        reference: null,
        status: TaskStatus.POINTS_AWARDED,
        contributionType: "NON_REWARD",
        info: null,
        fixedContributionPoint: 100,
        fixedEvaluatorId: null,
        fixedEvaluationLogic: null,
        fixedEvaluationDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        groupId: testGroupId,
        creatorId: testUserId,
        userFixedSubmitterId: null,
        reporters: [{ userId: "user-1" }],
        executors: [{ userId: "user-2" }],
      } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>);

      const mockGroupPointUpdate = vi.fn().mockResolvedValue({ id: "group-point-1" });
      const mockGroupPointCreate = vi.fn().mockResolvedValue({ id: "group-point-2" });

      prismaMock.groupPoint.findUnique
        .mockResolvedValueOnce(
          groupPointFactory.build({
            id: "existing-point",
            userId: "user-1",
            groupId: testGroupId,
            balance: 50,
            fixedTotalPoints: 50,
          }),
        ) // user-1の既存ポイント
        .mockResolvedValueOnce(null); // user-2の新規ポイント

      prismaMock.groupPoint.update.mockImplementation(mockGroupPointUpdate);
      prismaMock.groupPoint.create.mockImplementation(mockGroupPointCreate);

      // Act
      const result = await bulkUpdateTaskStatuses([{ taskId: "task-1", status: TaskStatus.POINTS_AWARDED }]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);
      expect(mockGroupPointUpdate).toHaveBeenCalledWith({
        where: {
          userId_groupId: {
            userId: "user-1",
            groupId: testGroupId,
          },
        },
        data: {
          balance: { increment: 100 },
          fixedTotalPoints: { increment: 100 },
        },
      });
      expect(mockGroupPointCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-2",
          groupId: testGroupId,
          balance: 100,
          fixedTotalPoints: 100,
        },
      });
    });

    test("should not update group points when fixedContributionPoint is null", async () => {
      // Arrange
      const task = {
        id: "task-1",
        status: TaskStatus.TASK_COMPLETED,
        fixedContributionPoint: null, // ポイントが設定されていない
        group: { id: testGroupId },
      };

      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );
      prismaMock.task.update.mockResolvedValue({
        id: "task-1",
        task: "テストタスク",
        reference: null,
        status: TaskStatus.POINTS_AWARDED,
        contributionType: "NON_REWARD",
        info: null,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        fixedEvaluationLogic: null,
        fixedEvaluationDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        groupId: testGroupId,
        creatorId: testUserId,
        userFixedSubmitterId: null,
        reporters: [{ userId: "user-1" }],
        executors: [{ userId: "user-2" }],
      } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>);

      // Act
      const result = await bulkUpdateTaskStatuses([{ taskId: "task-1", status: TaskStatus.POINTS_AWARDED }]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);
      expect(prismaMock.groupPoint.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.groupPoint.update).not.toHaveBeenCalled();
      expect(prismaMock.groupPoint.create).not.toHaveBeenCalled();
    });

    test("should handle empty data array", async () => {
      // Act
      const result = await bulkUpdateTaskStatuses([]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    test("should handle database error during individual task update", async () => {
      // Arrange
      const task = {
        id: "task-1",
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        group: { id: testGroupId },
      };

      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );
      prismaMock.task.update.mockRejectedValue(new Error("Database update error"));

      // Act
      const result = await bulkUpdateTaskStatuses([{ taskId: "task-1", status: TaskStatus.TASK_COMPLETED }]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("Database update error");
    });

    test("should handle authentication error", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

      // Act
      const result = await bulkUpdateTaskStatuses(validStatusData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication failed");
    });

    test("should handle all valid task statuses", async () => {
      // Arrange
      const allValidStatuses = [
        { taskId: "task-1", status: TaskStatus.PENDING },
        { taskId: "task-2", status: TaskStatus.POINTS_DEPOSITED },
        { taskId: "task-3", status: TaskStatus.TASK_COMPLETED },
        { taskId: "task-4", status: TaskStatus.FIXED_EVALUATED },
        { taskId: "task-5", status: TaskStatus.POINTS_AWARDED },
        { taskId: "task-6", status: TaskStatus.ARCHIVED },
      ];

      const tasks = allValidStatuses.map((data) => ({
        id: data.taskId,
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        group: { id: testGroupId },
      }));

      // 各タスクに対してfindUniqueとupdateをモック
      prismaMock.task.findUnique
        .mockResolvedValueOnce(tasks[0] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[1] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[2] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[3] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[4] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[5] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);

      prismaMock.task.update
        .mockResolvedValueOnce({
          id: "task-1",
          task: "テストタスク1",
          reference: null,
          status: TaskStatus.PENDING,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: "task-2",
          task: "テストタスク2",
          reference: null,
          status: TaskStatus.POINTS_DEPOSITED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: "task-3",
          task: "テストタスク3",
          reference: null,
          status: TaskStatus.TASK_COMPLETED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: "task-4",
          task: "テストタスク4",
          reference: null,
          status: TaskStatus.FIXED_EVALUATED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: "task-5",
          task: "テストタスク5",
          reference: null,
          status: TaskStatus.POINTS_AWARDED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: "task-6",
          task: "テストタスク6",
          reference: null,
          status: TaskStatus.ARCHIVED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>);

      // Act
      const result = await bulkUpdateTaskStatuses(allValidStatuses);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(6);
      expect(result.failedCount).toBe(0);
    });
  });
});
