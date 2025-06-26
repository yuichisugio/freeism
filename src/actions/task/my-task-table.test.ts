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
import { ContributionType, TaskStatus } from "@prisma/client";
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

// 単一ソートテストのヘルパー関数
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

// 複数ソートテストのヘルパー関数
const testMultipleSortFields = async (
  sortTests: Array<{
    field: string;
    direction: "asc" | "desc";
    expectedOrderBy: Prisma.TaskOrderByWithRelationInput;
  }>,
) => {
  for (const { field, direction, expectedOrderBy } of sortTests) {
    vi.clearAllMocks();
    await testSortField(field, direction, expectedOrderBy);
  }
};

// フィルターテストのヘルパー関数
const testFilter = async (
  filterConditions: Partial<MyTaskTableConditions>,
  expectedWhereCondition: Record<string, unknown>,
) => {
  const tableConditions: MyTaskTableConditions = {
    ...defaultTableConditions,
    ...filterConditions,
  };

  setupEmptyTaskMocks();
  await getMyTaskData(tableConditions, testUser.id);

  expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall(expectedWhereCondition));
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
        contributionType: ContributionType.NON_REWARD,
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

    test("should handle null values in task data", async () => {
      // Arrange
      const mockTaskData = {
        id: "test-task-id",
        task: "テストタスク",
        detail: null,
        status: TaskStatus.PENDING,
        contributionType: ContributionType.NON_REWARD,
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
        contributionType: ContributionType.NON_REWARD,
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
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フィルター機能", () => {
    test.each([
      {
        name: "search query filter",
        conditions: { searchQuery: "検索クエリ" },
        expectedWhere: { task: { contains: "検索クエリ", mode: "insensitive" } },
      },
      {
        name: "task status filter",
        conditions: { taskStatus: TaskStatus.PENDING },
        expectedWhere: { status: TaskStatus.PENDING },
      },
      {
        name: "contribution type filter",
        conditions: { contributionType: ContributionType.REWARD },
        expectedWhere: { contributionType: ContributionType.REWARD },
      },
      {
        name: "multiple filters",
        conditions: {
          searchQuery: "テスト",
          taskStatus: TaskStatus.PENDING,
          contributionType: ContributionType.NON_REWARD,
        },
        expectedWhere: {
          task: { contains: "テスト", mode: "insensitive" },
          status: TaskStatus.PENDING,
          contributionType: ContributionType.NON_REWARD,
        },
      },
    ])("should apply filters correctly", async ({ conditions, expectedWhere }) => {
      await testFilter(conditions as MyTaskTableConditions, expectedWhere);
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });
  });

  test("should handle empty search query correctly", async () => {
    await testFilter({ searchQuery: "" }, {});
    expect(prismaMock.task.findMany).toHaveBeenCalled();
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("ソート機能", () => {
  test("should apply sorting correctly", async () => {
    const sortTests = [
      { field: "taskName", direction: "asc" as const, expectedOrderBy: { task: "asc" as const } },
      { field: "groupName", direction: "desc" as const, expectedOrderBy: { group: { name: "desc" as const } } },
      { field: "taskStatus", direction: "desc" as const, expectedOrderBy: { status: "desc" as const } },
      {
        field: "taskFixedContributionPoint",
        direction: "asc" as const,
        expectedOrderBy: { fixedContributionPoint: "asc" as const },
      },
      {
        field: "taskFixedEvaluator",
        direction: "asc" as const,
        expectedOrderBy: { fixedEvaluator: { settings: { username: "asc" as const } } },
      },
      {
        field: "taskFixedEvaluationLogic",
        direction: "desc" as const,
        expectedOrderBy: { fixedEvaluationLogic: "desc" as const },
      },
      { field: "id", direction: "asc" as const, expectedOrderBy: { id: "asc" as const } },
      {
        field: "taskCreatorName",
        direction: "asc" as const,
        expectedOrderBy: { creator: { settings: { username: "asc" as const } } },
      },
      {
        field: "auctionId",
        direction: "desc" as const,
        expectedOrderBy: { createdAt: "desc" as const },
      },
    ];

    await testMultipleSortFields(sortTests);
    // 少なくとも1回のアサーションが実行されることを確認
    expect(prismaMock.task.findMany).toHaveBeenCalled();
  });

  test("should handle invalid sort field gracefully", async () => {
    const tableConditions: MyTaskTableConditions = {
      ...defaultTableConditions,
      sort: { field: "invalidField" as unknown as keyof MyTaskTable, direction: "asc" },
    };

    setupEmptyTaskMocks();
    await getMyTaskData(tableConditions, testUser.id);

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall());
  });

  test("should handle null sort object", async () => {
    const tableConditions: MyTaskTableConditions = {
      ...defaultTableConditions,
      sort: null,
    };

    setupEmptyTaskMocks();
    await getMyTaskData(tableConditions, testUser.id);

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall());
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("ページネーション", () => {
  test("should apply pagination correctly", async () => {
    const paginationTests = [
      { page: 1, itemPerPage: 10, expectedSkip: 0, expectedTake: 10 },
      { page: 3, itemPerPage: 5, expectedSkip: 10, expectedTake: 5 },
      { page: 1000, itemPerPage: 50, expectedSkip: 49950, expectedTake: 50 },
      { page: 1, itemPerPage: 1, expectedSkip: 0, expectedTake: 1 },
    ];

    for (const { page, itemPerPage, expectedSkip, expectedTake } of paginationTests) {
      vi.clearAllMocks();
      const tableConditions: MyTaskTableConditions = {
        ...defaultTableConditions,
        page,
        itemPerPage,
      };

      setupEmptyTaskMocks();
      await getMyTaskData(tableConditions, testUser.id);

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        getBaseExpectedCall({}, { createdAt: "desc" }, expectedSkip, expectedTake),
      );
    }

    // 少なくとも1回のアサーションが実行されることを確認
    expect(paginationTests.length).toBeGreaterThan(0);
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("境界値・パターンテスト", () => {
  test("should handle long search query", async () => {
    const longSearchQuery = "a".repeat(1000);
    await testFilter({ searchQuery: longSearchQuery }, { task: { contains: longSearchQuery, mode: "insensitive" } });
    expect(prismaMock.task.findMany).toHaveBeenCalled();
  });

  test("should handle all TaskStatus values", async () => {
    const allTaskStatuses = Object.values(TaskStatus);
    for (const status of allTaskStatuses) {
      vi.clearAllMocks();
      await testFilter({ taskStatus: status }, { status });
    }
    expect(allTaskStatuses.length).toBeGreaterThan(0);
  });

  test("should handle all ContributionType values", async () => {
    const allContributionTypes = Object.values(ContributionType);
    for (const type of allContributionTypes) {
      vi.clearAllMocks();
      await testFilter({ contributionType: type }, { contributionType: type });
    }
    expect(allContributionTypes.length).toBeGreaterThan(0);
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("異常系・バリデーション", () => {
  test.each([
    {
      name: "userId is empty",
      userId: "",
      conditions: defaultTableConditions,
    },
    {
      name: "userId is null",
      userId: null,
      conditions: defaultTableConditions,
    },
    {
      name: "userId is undefined",
      userId: undefined,
      conditions: defaultTableConditions,
    },
    {
      name: "tableConditions is null",
      userId: testUser.id,
      conditions: null,
    },
    {
      name: "tableConditions is undefined",
      userId: testUser.id,
      conditions: undefined,
    },
    {
      name: "tableConditions is empty object",
      userId: testUser.id,
      conditions: {},
    },
    {
      name: "tableConditions is empty array",
      userId: testUser.id,
      conditions: [],
    },
    {
      name: "tableConditions is invalid contributionType",
      userId: testUser.id,
      conditions: { ...defaultTableConditions, contributionType: "INVALID" },
    },
    {
      name: "tableConditions is invalid taskStatus",
      userId: testUser.id,
      conditions: { ...defaultTableConditions, taskStatus: "INVALID" },
    },
    {
      name: "invalid taskStatus",
      userId: testUser.id,
      conditions: { ...defaultTableConditions, taskStatus: "INVALID" },
    },
    {
      name: "invalid contributionType",
      userId: testUser.id,
      conditions: { ...defaultTableConditions, contributionType: "INVALID" },
    },
  ])("should throw validation errors when userId or conditions is invalid", async ({ userId, conditions }) => {
    // Act & Assert
    await expect(getMyTaskData(conditions as MyTaskTableConditions, userId!)).rejects.toThrow(
      "タスク情報の取得中にエラーが発生しました",
    );
  });

  test.each([
    {
      name: "findMany fails",
      setup: () => prismaMock.task.findMany.mockRejectedValue(new Error("データベースエラー")),
    },
    {
      name: "count fails",
      setup: () => {
        prismaMock.task.findMany.mockResolvedValue([]);
        prismaMock.task.count.mockRejectedValue(new Error("カウントエラー"));
      },
    },
  ])("should handle database errors when findMany or count fails", async ({ setup }) => {
    setup();
    await expect(getMyTaskData(defaultTableConditions, testUser.id)).rejects.toThrow(
      "タスク情報の取得中にエラーが発生しました",
    );
  });
});
