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
const getBaseExpectedCall = (
  additionalWhere = {},
  orderBy: Prisma.TaskOrderByWithRelationInput = { createdAt: "desc" as const },
  skip = 0,
  take = 10,
) => ({
  where: {
    OR: [
      { creatorId: testUser.id },
      { reporters: { some: { userId: testUser.id } } },
      { executors: { some: { userId: testUser.id } } },
    ],
    ...additionalWhere,
  },
  select: expect.any(Object) as unknown as Prisma.TaskSelect,
  orderBy,
  skip,
  take,
});

// フィルターテストのヘルパー関数
const testFilter = async (
  filterConditions: Partial<MyTaskTableConditions>,
  expectedWhereCondition: Record<string, unknown>,
) => {
  const tableConditions: MyTaskTableConditions = {
    ...defaultTableConditions,
    ...filterConditions,
  };

  prismaMock.task.findMany.mockResolvedValue([]);
  prismaMock.task.count.mockResolvedValue(0);
  await getMyTaskData(tableConditions, testUser.id);

  expect(prismaMock.task.findMany).toHaveBeenCalledWith({
    where: {
      OR: [
        { creatorId: testUser.id },
        { reporters: { some: { userId: testUser.id } } },
        { executors: { some: { userId: testUser.id } } },
      ],
      ...expectedWhereCondition,
    },
    select: {
      id: true,
      task: true,
      detail: true,
      status: true,
      contributionType: true,
      fixedContributionPoint: true,
      fixedEvaluator: {
        select: {
          settings: {
            select: {
              username: true,
            },
          },
        },
      },
      fixedEvaluationLogic: true,
      creator: {
        select: {
          settings: {
            select: {
              username: true,
            },
          },
        },
      },
      reporters: {
        select: {
          userId: true,
          user: {
            select: {
              settings: {
                select: {
                  username: true,
                },
              },
            },
          },
        },
      },
      executors: {
        select: {
          userId: true,
          user: {
            select: {
              settings: {
                select: {
                  username: true,
                },
              },
            },
          },
        },
      },
      group: {
        select: {
          id: true,
          name: true,
          members: {
            where: {
              userId: testUser.id,
            },
            select: {
              isGroupOwner: true,
            },
          },
        },
      },
      auction: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: 0,
    take: 10,
  });
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
          members: [{ isGroupOwner: true }],
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
        success: true,
        message: "タスク情報の取得が完了しました",
        data: {
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
              isGroupOwner: true,
            },
          ],
          totalTaskCount: 1,
        },
      });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { creatorId: testUser.id },
            { reporters: { some: { userId: testUser.id } } },
            { executors: { some: { userId: testUser.id } } },
          ],
        },
        select: expect.any(Object),
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
          members: [{ isGroupOwner: false }],
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
      expect(result.data?.tasks[0]).toMatchObject({
        taskReporterUserIds: ["reporter-user-id"],
        taskExecutorUserIds: ["executor-user-id"],
        taskReporterUserNames: "報告者ユーザー",
        taskExecutorUserNames: "実行者ユーザー",
        reporters: [{ appUserName: "報告者ユーザー", appUserId: "reporter-user-id" }],
        executors: [{ appUserName: "実行者ユーザー", appUserId: "executor-user-id" }],
        auctionId: null,
        isGroupOwner: false,
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
        success: true,
        message: "タスク情報の取得が完了しました",
        data: {
          tasks: [],
          totalTaskCount: 0,
        },
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
          members: [{ isGroupOwner: true }],
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
      expect(result.data?.tasks[0]).toMatchObject({
        taskDetail: null,
        taskFixedContributionPoint: null,
        taskFixedEvaluator: "未設定",
        taskFixedEvaluationLogic: null,
        taskCreatorName: "未設定",
        auctionId: null,
        isGroupOwner: true,
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
            username: null,
          },
        },
        reporters: [
          {
            userId: "reporter-1",
            user: {
              settings: {
                username: "報告者1",
              },
            },
          },
          {
            userId: null,
            user: {
              settings: {
                username: "報告者2",
              },
            },
          },
          {
            userId: "reporter-3",
            user: {
              settings: {
                username: null,
              },
            },
          },
          {
            userId: null,
            user: {
              settings: {
                username: null,
              },
            },
          },
        ],
        executors: [
          {
            userId: "executor-1",
            user: {
              settings: {
                username: "実行者1",
              },
            },
          },
          {
            userId: null,
            user: {
              settings: {
                username: "実行者2",
              },
            },
          },
          {
            userId: "executor-3",
            user: {
              settings: {
                username: null,
              },
            },
          },
          {
            userId: null,
            user: {
              settings: {
                username: null,
              },
            },
          },
        ],
        group: {
          id: testGroup.id,
          name: testGroup.name,
          members: [{ isGroupOwner: false }],
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
      expect(result.data?.tasks[0]).toMatchObject({
        taskReporterUserIds: ["reporter-1", "reporter-3"],
        taskExecutorUserIds: ["executor-1", "executor-3"],
        taskReporterUserNames: "報告者1, 報告者2",
        taskExecutorUserNames: "実行者1, 実行者2",
        isGroupOwner: false,
      });
    });

    test.each(Object.values(TaskStatus))("should handle all TaskStatus values", async (status) => {
      await testFilter({ taskStatus: status }, { status });
      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });

    test.each(Object.values(ContributionType))("should handle all ContributionType values", async (type) => {
      await testFilter({ contributionType: type }, { contributionType: type });
      expect(prismaMock.task.findMany).toHaveBeenCalled();
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
          name: "search query filter with whitespace",
          conditions: { searchQuery: " 検索クエリ " },
          expectedWhere: { task: { contains: "検索クエリ", mode: "insensitive" } },
        },
        {
          name: "search query filter with whitespace and english",
          conditions: { searchQuery: " 検索クエリ 英語 " },
          expectedWhere: { task: { contains: "検索クエリ 英語", mode: "insensitive" } },
        },
        {
          name: "search query filter with empty",
          conditions: { searchQuery: "" },
          expectedWhere: {},
        },
        {
          name: "task status filter with pending",
          conditions: { taskStatus: TaskStatus.PENDING },
          expectedWhere: { status: TaskStatus.PENDING },
        },
        {
          name: "task status filter with all",
          conditions: { taskStatus: "ALL" },
          expectedWhere: {},
        },
        {
          name: "contribution type filter with reward",
          conditions: { contributionType: ContributionType.REWARD },
          expectedWhere: { contributionType: ContributionType.REWARD },
        },
        {
          name: "contribution type filter with non reward",
          conditions: { contributionType: ContributionType.NON_REWARD },
          expectedWhere: { contributionType: ContributionType.NON_REWARD },
        },
        {
          name: "contribution type filter with all",
          conditions: { contributionType: "ALL" },
          expectedWhere: {},
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
        {
          name: "multiple filters with all",
          conditions: {
            searchQuery: "テスト",
            taskStatus: "ALL",
            contributionType: "ALL",
          },
          expectedWhere: {
            task: { contains: "テスト", mode: "insensitive" },
          },
        },
      ])("should apply filters correctly", async ({ conditions, expectedWhere }) => {
        await testFilter(conditions as MyTaskTableConditions, expectedWhere);
        expect(prismaMock.task.findMany).toHaveBeenCalled();
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("ソート機能", () => {
      test.each([
        { field: "taskName", direction: "asc" as const, expectedOrderBy: { task: "asc" as const } },
        { field: "taskName", direction: "desc" as const, expectedOrderBy: { task: "desc" as const } },
        { field: "groupName", direction: "asc" as const, expectedOrderBy: { group: { name: "asc" as const } } },
        { field: "groupName", direction: "desc" as const, expectedOrderBy: { group: { name: "desc" as const } } },
        { field: "taskStatus", direction: "asc" as const, expectedOrderBy: { status: "asc" as const } },
        { field: "taskStatus", direction: "desc" as const, expectedOrderBy: { status: "desc" as const } },
        {
          field: "taskFixedContributionPoint",
          direction: "asc" as const,
          expectedOrderBy: { fixedContributionPoint: "asc" as const },
        },
        {
          field: "taskFixedContributionPoint",
          direction: "desc" as const,
          expectedOrderBy: { fixedContributionPoint: "desc" as const },
        },
        {
          field: "taskFixedEvaluator",
          direction: "asc" as const,
          expectedOrderBy: { fixedEvaluator: { settings: { username: "asc" as const } } },
        },
        {
          field: "taskFixedEvaluator",
          direction: "desc" as const,
          expectedOrderBy: { fixedEvaluator: { settings: { username: "desc" as const } } },
        },
        {
          field: "taskFixedEvaluationLogic",
          direction: "asc" as const,
          expectedOrderBy: { fixedEvaluationLogic: "asc" as const },
        },
        {
          field: "taskFixedEvaluationLogic",
          direction: "desc" as const,
          expectedOrderBy: { fixedEvaluationLogic: "desc" as const },
        },
        {
          field: "id",
          direction: "asc" as const,
          expectedOrderBy: { id: "asc" as const },
        },
        {
          field: "id",
          direction: "desc" as const,
          expectedOrderBy: { id: "desc" as const },
        },
        {
          field: "taskCreatorName",
          direction: "asc" as const,
          expectedOrderBy: { creator: { settings: { username: "asc" as const } } },
        },
        {
          field: "taskCreatorName",
          direction: "desc" as const,
          expectedOrderBy: { creator: { settings: { username: "desc" as const } } },
        },
        {
          field: "auctionId",
          direction: "asc" as const,
          expectedOrderBy: { createdAt: "asc" as const },
        },
        {
          field: "auctionId",
          direction: "desc" as const,
          expectedOrderBy: { createdAt: "desc" as const },
        },
        {
          field: "invalidField",
          direction: "asc" as const,
          expectedOrderBy: {},
        },
        {
          field: "invalidField",
          direction: "desc" as const,
          expectedOrderBy: {},
        },
        {
          field: null,
          direction: "asc" as const,
          expectedOrderBy: {},
        },
        {
          field: null,
          direction: "desc" as const,
          expectedOrderBy: {},
        },
        {
          field: undefined,
          direction: "asc" as const,
          expectedOrderBy: {},
        },
        {
          field: undefined,
          direction: "desc" as const,
          expectedOrderBy: {},
        },
        {
          field: "taskName",
          direction: null,
          expectedOrderBy: { task: "desc" as const },
        },
        {
          field: "taskName",
          direction: undefined,
          expectedOrderBy: { task: "desc" as const },
        },
      ])("should apply sorting correctly", async ({ field, direction, expectedOrderBy }) => {
        const tableConditions: MyTaskTableConditions = {
          ...defaultTableConditions,
          sort: { field: field as keyof MyTaskTable, direction: direction! },
        };

        prismaMock.task.findMany.mockResolvedValue([]);
        prismaMock.task.count.mockResolvedValue(0);
        await getMyTaskData(tableConditions, testUser.id);

        expect(prismaMock.task.findMany).toHaveBeenCalledWith(getBaseExpectedCall({}, expectedOrderBy, 0, 10));
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("ページネーション", () => {
      test.each([
        { page: 1, itemPerPage: 10, expectedSkip: 0, expectedTake: 10 },
        { page: 3, itemPerPage: 5, expectedSkip: 10, expectedTake: 5 },
        { page: 1000, itemPerPage: 50, expectedSkip: 49950, expectedTake: 50 },
        { page: 1, itemPerPage: 1, expectedSkip: 0, expectedTake: 1 },
      ])("should apply pagination correctly", async ({ page, itemPerPage, expectedSkip, expectedTake }) => {
        const tableConditions: MyTaskTableConditions = {
          ...defaultTableConditions,
          page,
          itemPerPage,
        };

        prismaMock.task.findMany.mockResolvedValue([]);
        prismaMock.task.count.mockResolvedValue(0);
        await getMyTaskData(tableConditions, testUser.id);

        expect(prismaMock.task.findMany).toHaveBeenCalledWith(
          getBaseExpectedCall({}, { createdAt: "desc" }, expectedSkip, expectedTake),
        );
      });
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("異常系・バリデーション", () => {
  test.each([
    {
      name: "userId is empty",
      userId: "",
      conditions: defaultTableConditions,
      expectedError: "ユーザーID or テーブルの表示条件が指定されていません",
    },
    {
      name: "userId is null",
      userId: null,
      conditions: defaultTableConditions,
      expectedError: "ユーザーID or テーブルの表示条件が指定されていません",
    },
    {
      name: "userId is undefined",
      userId: undefined,
      conditions: defaultTableConditions,
      expectedError: "ユーザーID or テーブルの表示条件が指定されていません",
    },
    {
      name: "tableConditions is null",
      userId: testUser.id,
      conditions: null,
      expectedError: "Cannot destructure property 'page' of 'tableConditions' as it is null.",
    },
    {
      name: "tableConditions is undefined",
      userId: testUser.id,
      conditions: undefined,
      expectedError: "Cannot destructure property 'page' of 'tableConditions' as it is undefined.",
    },
    {
      name: "tableConditions is empty object",
      userId: testUser.id,
      conditions: {},
      expectedError: "ユーザーID or テーブルの表示条件が指定されていません",
    },
    {
      name: "tableConditions is empty array",
      userId: testUser.id,
      conditions: [],
      expectedError: "ユーザーID or テーブルの表示条件が指定されていません",
    },
    {
      name: "tableConditions is invalid contributionType",
      userId: testUser.id,
      conditions: { ...defaultTableConditions, contributionType: "INVALID" },
      expectedError: "ユーザーID or テーブルの表示条件が指定されていません",
    },
    {
      name: "tableConditions is invalid taskStatus",
      userId: testUser.id,
      conditions: { ...defaultTableConditions, taskStatus: "INVALID" },
      expectedError: "ユーザーID or テーブルの表示条件が指定されていません",
    },
  ])(
    "should throw validation errors when userId or conditions is invalid",
    async ({ userId, conditions, expectedError }) => {
      // Act & Assert
      await expect(getMyTaskData(conditions as MyTaskTableConditions, userId!)).rejects.toThrow(expectedError);
    },
  );

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
    await expect(getMyTaskData(defaultTableConditions, testUser.id)).rejects.toThrow();
  });
});
