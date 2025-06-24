"use server";

import type { MyTaskTable, MyTaskTableConditions } from "@/types/group-types";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  auctionFactory,
  groupFactory,
  taskFactory,
  userFactory,
  userSettingsFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { contributionType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getMyTaskData } from "./my-task-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const testUser = userFactory.build({ id: "test-user-id" });
const testUserSettings = userSettingsFactory.build({ userId: testUser.id, username: "テストユーザー" });
const testGroup = groupFactory.build({ id: "test-group-id", name: "テストグループ" });
const testAuction = auctionFactory.build({ id: "test-auction-id" });

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * デフォルトのテーブル条件
 */
const defaultTableConditions: MyTaskTableConditions = {
  page: 1,
  sort: null,
  searchQuery: null,
  taskStatus: "ALL",
  contributionType: "ALL",
  itemPerPage: 10,
};

/**
 * 共通のテストヘルパー関数
 */
const setupEmptyTaskMocks = () => {
  prismaMock.task.findMany.mockResolvedValue([]);
  prismaMock.task.count.mockResolvedValue(0);
};

const getBaseWhereCondition = (userId: string) => ({
  OR: [{ creatorId: userId }, { reporters: { some: { userId } } }, { executors: { some: { userId } } }],
});

const getBaseExpectedCall = (
  additionalWhere = {},
  orderBy: Prisma.TaskOrderByWithRelationInput = { createdAt: "desc" as const },
  skip = 0,
  take = 10,
) => ({
  where: {
    ...getBaseWhereCondition(testUser.id),
    ...additionalWhere,
  },
  select: expect.any(Object) as unknown as Prisma.TaskSelect,
  orderBy,
  skip,
  take,
});

const testSortField = async (
  field: string,
  direction: "asc" | "desc",
  expectedOrderBy: Prisma.TaskOrderByWithRelationInput,
) => {
  const tableConditions: MyTaskTableConditions = {
    ...defaultTableConditions,
    sort: { field: field as keyof MyTaskTable, direction },
  };

  setupEmptyTaskMocks();
  await getMyTaskData(tableConditions, testUser.id);

  expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall({}, expectedOrderBy, 0, 10));
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getMyTaskData", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
    mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should return user tasks successfully with default conditions", async () => {
      // Arrange
      const testTask = taskFactory.build({
        id: "test-task-id",
        task: "テストタスク",
        detail: "テストタスクの詳細",
        status: TaskStatus.PENDING,
        contributionType: contributionType.NON_REWARD,
        fixedContributionPoint: 100,
        fixedEvaluationLogic: "自動評価",
        creatorId: testUser.id,
        groupId: testGroup.id,
      });

      const mockTaskData = {
        id: testTask.id,
        task: testTask.task,
        detail: testTask.detail,
        status: testTask.status,
        contributionType: testTask.contributionType,
        fixedContributionPoint: testTask.fixedContributionPoint,
        fixedEvaluationLogic: testTask.fixedEvaluationLogic,
        fixedEvaluator: {
          settings: {
            username: "評価者ユーザー",
          },
        },
        creator: {
          settings: {
            username: testUserSettings.username,
          },
        },
        reporters: [],
        executors: [],
        group: {
          id: testGroup.id,
          name: testGroup.name,
        },
        auction: {
          id: testAuction.id,
        },
      };

      prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);
      prismaMock.task.count.mockResolvedValue(1);

      // Act
      const result = await getMyTaskData(defaultTableConditions, testUser.id);

      // Assert
      expect(result).toStrictEqual({
        tasks: [
          {
            id: testTask.id,
            taskName: testTask.task,
            taskDetail: testTask.detail,
            taskStatus: testTask.status,
            taskContributionType: testTask.contributionType,
            taskFixedContributionPoint: testTask.fixedContributionPoint,
            taskFixedEvaluator: "評価者ユーザー",
            taskFixedEvaluationLogic: testTask.fixedEvaluationLogic,
            taskCreatorName: testUserSettings.username,
            taskReporterUserIds: [],
            taskExecutorUserIds: [],
            taskReporterUserNames: "",
            taskExecutorUserNames: "",
            reporters: [],
            executors: [],
            groupId: testGroup.id,
            groupName: testGroup.name,
            auctionId: testAuction.id,
            group: { id: testGroup.id, name: testGroup.name },
          },
        ],
        totalTaskCount: 1,
      });

      // expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce(); // getMyTaskDataではgetAuthenticatedSessionUserIdを使用していない
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { creatorId: testUser.id },
            { reporters: { some: { userId: testUser.id } } },
            { executors: { some: { userId: testUser.id } } },
          ],
        },
        select: expect.any(Object) as unknown as Prisma.TaskSelect,
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
      expect(prismaMock.task.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { creatorId: testUser.id },
            { reporters: { some: { userId: testUser.id } } },
            { executors: { some: { userId: testUser.id } } },
          ],
        },
      });
    });

    test("should return tasks with reporters and executors", async () => {
      // Arrange
      const testTask = taskFactory.build({
        id: "test-task-id",
        creatorId: testUser.id,
        groupId: testGroup.id,
      });

      const mockTaskData = {
        id: testTask.id,
        task: testTask.task,
        detail: testTask.detail,
        status: testTask.status,
        contributionType: testTask.contributionType,
        fixedContributionPoint: testTask.fixedContributionPoint,
        fixedEvaluationLogic: testTask.fixedEvaluationLogic,
        fixedEvaluator: null,
        creator: {
          settings: {
            username: testUserSettings.username,
          },
        },
        reporters: [
          {
            userId: "reporter-user-id",
            user: {
              settings: {
                username: "報告者ユーザー",
              },
            },
          },
        ],
        executors: [
          {
            userId: "executor-user-id",
            user: {
              settings: {
                username: "実行者ユーザー",
              },
            },
          },
        ],
        group: {
          id: testGroup.id,
          name: testGroup.name,
        },
        auction: null,
      };

      prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);
      prismaMock.task.count.mockResolvedValue(1);

      // Act
      const result = await getMyTaskData(defaultTableConditions, testUser.id);

      // Assert
      expect(result.tasks[0]).toMatchObject({
        taskReporterUserIds: ["reporter-user-id"],
        taskExecutorUserIds: ["executor-user-id"],
        taskReporterUserNames: "報告者ユーザー",
        taskExecutorUserNames: "実行者ユーザー",
        reporters: [{ appUserName: "報告者ユーザー", appUserId: "reporter-user-id" }],
        executors: [{ appUserName: "実行者ユーザー", appUserId: "executor-user-id" }],
        auctionId: null,
      });
    });

    test("should apply search query filter", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        searchQuery: "検索クエリ",
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        getBaseExpectedCall({
          task: {
            contains: "検索クエリ",
            mode: "insensitive",
          },
        }),
      );
    });

    test("should apply task status filter", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        taskStatus: TaskStatus.PENDING,
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall({ status: TaskStatus.PENDING }));
    });

    test("should apply contribution type filter", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        contributionType: contributionType.REWARD,
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        getBaseExpectedCall({ contributionType: contributionType.REWARD }),
      );
    });

    test("should apply multiple filters simultaneously", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        searchQuery: "テスト",
        taskStatus: TaskStatus.PENDING,
        contributionType: contributionType.NON_REWARD,
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        getBaseExpectedCall({
          task: {
            contains: "テスト",
            mode: "insensitive",
          },
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
        }),
      );
    });

    test("should apply pagination correctly", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        page: 3,
        itemPerPage: 5,
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        ...getBaseExpectedCall(),
        skip: 10, // (3 - 1) * 5
        take: 5,
      });
    });

    test("should apply sort by taskName", async () => {
      await testSortField("taskName", "asc", { task: "asc" });
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });

    test("should apply sort by groupName", async () => {
      await testSortField("groupName", "desc", { group: { name: "desc" } });
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });

    test("should apply sort by taskFixedContributionPoint", async () => {
      await testSortField("taskFixedContributionPoint", "asc", { fixedContributionPoint: "asc" });
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });

    test("should apply sort by taskCreatorName", async () => {
      await testSortField("taskCreatorName", "asc", { creator: { settings: { username: "asc" } } });
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });

    test("should apply sort by taskStatus", async () => {
      await testSortField("taskStatus", "desc", { status: "desc" });
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });

    test("should apply sort by taskFixedEvaluator", async () => {
      await testSortField("taskFixedEvaluator", "asc", { fixedEvaluator: { settings: { username: "asc" } } });
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });

    test("should apply sort by taskFixedEvaluationLogic", async () => {
      await testSortField("taskFixedEvaluationLogic", "desc", { fixedEvaluationLogic: "desc" });
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });

    test("should apply sort by id", async () => {
      await testSortField("id", "asc", { id: "asc" });
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });

    test("should apply sort by auctionId", async () => {
      await testSortField("auctionId", "desc", { createdAt: "desc" }); // auctionIdソートはcreatedAtソートにマップされる
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });

    test("should handle null values in task data", async () => {
      // Arrange
      const mockTaskData = {
        id: "test-task-id",
        task: "テストタスク",
        detail: null,
        status: TaskStatus.PENDING,
        contributionType: contributionType.NON_REWARD,
        fixedContributionPoint: null,
        fixedEvaluationLogic: null,
        fixedEvaluator: null,
        creator: {
          settings: null,
        },
        reporters: [],
        executors: [],
        group: {
          id: testGroup.id,
          name: testGroup.name,
        },
        auction: null,
      };

      prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);
      prismaMock.task.count.mockResolvedValue(1);

      // Act
      const result = await getMyTaskData(defaultTableConditions, testUser.id);

      // Assert
      expect(result.tasks[0]).toMatchObject({
        taskDetail: null,
        taskFixedContributionPoint: null,
        taskFixedEvaluator: "未設定",
        taskFixedEvaluationLogic: null,
        taskCreatorName: "未設定",
        auctionId: null,
      });
    });

    test("should filter out null userIds and usernames", async () => {
      // Arrange
      const mockTaskData = {
        id: "test-task-id",
        task: "テストタスク",
        detail: "詳細",
        status: TaskStatus.PENDING,
        contributionType: contributionType.NON_REWARD,
        fixedContributionPoint: 100,
        fixedEvaluationLogic: "ロジック",
        fixedEvaluator: null,
        creator: {
          settings: {
            username: "作成者",
          },
        },
        reporters: [
          {
            userId: null,
            user: {
              settings: {
                username: "報告者1",
              },
            },
          },
          {
            userId: "reporter-2",
            user: {
              settings: {
                username: "未設定",
              },
            },
          },
          {
            userId: "reporter-3",
            user: {
              settings: {
                username: "報告者3",
              },
            },
          },
        ],
        executors: [
          {
            userId: "executor-1",
            user: {
              settings: {
                username: null,
              },
            },
          },
          {
            userId: "executor-2",
            user: {
              settings: {
                username: "実行者2",
              },
            },
          },
        ],
        group: {
          id: testGroup.id,
          name: testGroup.name,
        },
        auction: null,
      };

      prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);
      prismaMock.task.count.mockResolvedValue(1);

      // Act
      const result = await getMyTaskData(defaultTableConditions, testUser.id);

      // Assert
      expect(result.tasks[0]).toMatchObject({
        taskReporterUserIds: ["reporter-2", "reporter-3"],
        taskExecutorUserIds: ["executor-1", "executor-2"],
        taskReporterUserNames: "報告者1, 報告者3",
        taskExecutorUserNames: "実行者2",
      });
    });

    test("should return empty array when no tasks found", async () => {
      // Arrange
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockResolvedValue(0);

      // Act
      const result = await getMyTaskData(defaultTableConditions, testUser.id);

      // Assert
      expect(result).toStrictEqual({
        tasks: [],
        totalTaskCount: 0,
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should throw error when getAuthenticatedSessionUserId fails", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証エラー"));

      // Act & Assert
      await expect(getMyTaskData(defaultTableConditions, testUser.id)).rejects.toThrow(
        "タスク情報の取得中にエラーが発生しました",
      );
    });

    test("should throw error when prisma.task.findMany fails", async () => {
      // Arrange
      prismaMock.task.findMany.mockRejectedValue(new Error("データベースエラー"));

      // Act & Assert
      await expect(getMyTaskData(defaultTableConditions, testUser.id)).rejects.toThrow(
        "タスク情報の取得中にエラーが発生しました",
      );
    });

    test("should throw error when prisma.task.count fails", async () => {
      // Arrange
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockRejectedValue(new Error("カウントエラー"));

      // Act & Assert
      await expect(getMyTaskData(defaultTableConditions, testUser.id)).rejects.toThrow(
        "タスク情報の取得中にエラーが発生しました",
      );
    });

    test("should handle invalid sort field gracefully", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        sort: { field: "invalidField" as unknown as keyof MyTaskTable, direction: "asc" as unknown as "asc" | "desc" },
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert - デフォルトソートが適用される
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall());
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle page 1 correctly", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        page: 1,
        itemPerPage: 10,
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall());
    });

    test("should handle large page number", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        page: 1000,
        itemPerPage: 50,
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        getBaseExpectedCall({}, { createdAt: "desc" }, 49950, 50), // (1000 - 1) * 50
      );
    });

    test("should handle itemPerPage of 1", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        page: 1,
        itemPerPage: 1,
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall({}, { createdAt: "desc" }, 0, 1));
    });

    test("should handle empty search query", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        searchQuery: "",
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert - 空文字列の場合は検索条件が追加されない
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall());
    });

    test("should handle very long search query", async () => {
      // Arrange
      const longSearchQuery = "a".repeat(1000);
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        searchQuery: longSearchQuery,
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        getBaseExpectedCall({
          task: {
            contains: longSearchQuery,
            mode: "insensitive",
          },
        }),
      );
    });

    test("should handle all possible TaskStatus values", async () => {
      // Arrange
      const allTaskStatuses = Object.values(TaskStatus);

      for (const status of allTaskStatuses) {
        const tableConditions: MyTaskTableConditions = {
          ...defaultTableConditions,
          taskStatus: status,
        };

        setupEmptyTaskMocks();

        // Act
        await getMyTaskData(tableConditions, testUser.id);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall({ status }));
      }
    });

    test("should handle all possible contributionType values", async () => {
      // Arrange
      const allContributionTypes = Object.values(contributionType);

      for (const type of allContributionTypes) {
        const tableConditions: MyTaskTableConditions = {
          ...defaultTableConditions,
          contributionType: type,
        };

        setupEmptyTaskMocks();

        // Act
        await getMyTaskData(tableConditions, testUser.id);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall({ contributionType: type }));
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("引数のパターンテスト", () => {
    test("should handle undefined tableConditions properties", async () => {
      // Arrange
      const tableConditions = {
        page: 1,
        sort: null,
        searchQuery: null,
        taskStatus: "ALL" as const,
        contributionType: "ALL" as const,
        itemPerPage: 10,
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall());
    });

    test("should handle null sort object", async () => {
      // Arrange
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        sort: null,
      };

      setupEmptyTaskMocks();

      // Act
      await getMyTaskData(tableConditions, testUser.id);

      // Assert
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall());
    });
  });
});
