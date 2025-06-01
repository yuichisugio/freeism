import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionFactory, groupFactory, taskFactory, userFactory, userSettingsFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { contributionType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getGroupTaskAndCount } from "./group-detail-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの準備
 */
const testGroup = groupFactory.build({ id: "test-group-1" });
const testUser1 = userFactory.build({ id: "test-user-1" });
const testUser2 = userFactory.build({ id: "test-user-2" });
const testUserSettings1 = userSettingsFactory.build({ id: "test-settings-1", userId: testUser1.id, username: "テストユーザー1" });
const testUserSettings2 = userSettingsFactory.build({ id: "test-settings-2", userId: testUser2.id, username: "テストユーザー2" });
const testAuction = auctionFactory.build({ id: "test-auction-1", groupId: testGroup.id, taskId: "test-task-1" });

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Prismaクエリの返り値の型定義
 */
type MockTaskData = {
  id: string;
  task: string;
  detail: string;
  status: TaskStatus;
  contributionType: contributionType;
  fixedContributionPoint: number | null;
  fixedEvaluationLogic: string | null;
  createdAt: Date;
  auction: { id: string } | null;
  fixedEvaluator: { settings: { id: string; username: string } | null } | null;
  creator: { settings: { id: string; username: string } | null };
  reporters: Array<{ user: { settings: { id: string; username: string } | null } | null }>;
  executors: Array<{ user: { settings: { id: string; username: string } | null } | null }>;
  group: {
    id: string;
    name: string;
    maxParticipants: number;
    goal: string;
    evaluationMethod: string;
    depositPeriod: number;
    members: Array<{ id: string; userId: string }>;
  };
};

/**
 * Prismaクエリの返り値の型に合わせたモックデータ作成ヘルパー
 */
function createMockTaskData(overrides: Partial<MockTaskData> = {}): MockTaskData {
  return {
    id: overrides.id ?? "test-task-1",
    task: overrides.task ?? "テストタスク",
    detail: overrides.detail ?? "テストタスクの詳細",
    status: overrides.status ?? TaskStatus.PENDING,
    contributionType: overrides.contributionType ?? contributionType.NON_REWARD,
    fixedContributionPoint: overrides.fixedContributionPoint ?? null,
    fixedEvaluationLogic: overrides.fixedEvaluationLogic ?? null,
    createdAt: overrides.createdAt ?? new Date("2024-01-01"),
    auction: overrides.auction ?? null,
    fixedEvaluator: overrides.fixedEvaluator ?? null,
    creator: overrides.creator ?? { settings: { id: testUserSettings1.id, username: testUserSettings1.username } },
    reporters: overrides.reporters ?? [],
    executors: overrides.executors ?? [],
    group: overrides.group ?? {
      id: testGroup.id,
      name: testGroup.name,
      maxParticipants: testGroup.maxParticipants,
      goal: testGroup.goal,
      evaluationMethod: testGroup.evaluationMethod,
      depositPeriod: testGroup.depositPeriod,
      members: [],
    },
  };
}

describe("group-detail-table.ts", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getGroupTaskAndCount", () => {
    describe("正常系", () => {
      test("should successfully return tasks and count with basic parameters", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          task: "テストタスク1",
          detail: "テストタスクの詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          fixedContributionPoint: 100,
          fixedEvaluationLogic: "自動評価",
          groupId: testGroup.id,
          creatorId: testUser1.id,
          createdAt: new Date("2024-01-01"),
        });

        const mockTaskData = createMockTaskData({
          id: testTask.id,
          task: testTask.task,
          detail: testTask.detail!,
          status: testTask.status,
          contributionType: testTask.contributionType,
          fixedContributionPoint: testTask.fixedContributionPoint,
          fixedEvaluationLogic: testTask.fixedEvaluationLogic,
          createdAt: testTask.createdAt,
          auction: { id: testAuction.id },
          fixedEvaluator: { settings: { id: testUserSettings2.id, username: testUserSettings2.username } },
          creator: { settings: { id: testUserSettings1.id, username: testUserSettings1.username } },
          group: {
            id: testGroup.id,
            name: testGroup.name,
            maxParticipants: testGroup.maxParticipants,
            goal: testGroup.goal,
            evaluationMethod: testGroup.evaluationMethod,
            depositPeriod: testGroup.depositPeriod,
            members: [{ id: "member-1", userId: testUser1.id }],
          },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(result).toStrictEqual({
          returnTasks: [
            {
              id: testTask.id,
              auctionId: testAuction.id,
              taskName: testTask.task,
              taskDetail: testTask.detail,
              taskStatus: testTask.status,
              taskContributionType: testTask.contributionType,
              taskFixedContributionPoint: testTask.fixedContributionPoint,
              taskFixedEvaluator: testUserSettings2.username,
              taskFixedEvaluationLogic: testTask.fixedEvaluationLogic,
              taskCreator: testUserSettings1.username,
              taskReporterUserIds: null,
              taskExecutorUserIds: null,
              taskReporterUserNames: null,
              taskExecutorUserNames: null,
              createdAt: testTask.createdAt,
              group: {
                id: testGroup.id,
                name: testGroup.name,
                maxParticipants: testGroup.maxParticipants,
                goal: testGroup.goal,
                evaluationMethod: testGroup.evaluationMethod,
                members: [{ userId: testUser1.id }],
                depositPeriod: testGroup.depositPeriod,
              },
            },
          ],
          totalTaskCount: 1,
        });

        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: testGroup.id },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 10,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });

        expect(prismaMock.task.count).toHaveBeenCalledWith({
          where: { groupId: testGroup.id },
        });
      });

      test("should handle search query filtering", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "検索対象タスク",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          createdAt: new Date(),
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "検索対象",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: {
            groupId: testGroup.id,
            task: {
              contains: "検索対象",
              mode: "insensitive",
            },
          },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 10,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });

        expect(result.returnTasks).toHaveLength(1);
        expect(result.totalTaskCount).toBe(1);
      });

      test("should handle contribution type filtering", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "報酬タスク",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.REWARD,
          fixedContributionPoint: 500,
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: contributionType.REWARD,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: {
            groupId: testGroup.id,
            contributionType: contributionType.REWARD,
          },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 10,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });

        expect(result.returnTasks[0].taskContributionType).toBe(contributionType.REWARD);
      });

      test("should handle status filtering", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "完了タスク",
          detail: "詳細",
          status: TaskStatus.TASK_COMPLETED,
          contributionType: contributionType.NON_REWARD,
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: TaskStatus.TASK_COMPLETED,
          itemPerPage: 10,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: {
            groupId: testGroup.id,
            status: TaskStatus.TASK_COMPLETED,
          },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 10,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });

        expect(result.returnTasks[0].taskStatus).toBe(TaskStatus.TASK_COMPLETED);
      });

      test("should handle custom sort field for taskFixedContributionPoint", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "ソートテストタスク",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          fixedContributionPoint: 100,
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "taskFixedContributionPoint",
          sortDirection: "asc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: testGroup.id },
          orderBy: { fixedContributionPoint: "asc" },
          skip: 0,
          take: 10,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });
      });

      test("should handle pagination correctly", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "ページネーションテスト",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(25);

        const params = {
          groupId: testGroup.id,
          page: 3,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: testGroup.id },
          orderBy: { createdAt: "desc" },
          skip: 20, // (3 - 1) * 10
          take: 10,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });

        expect(result.totalTaskCount).toBe(25);
      });

      test("should handle tasks with reporters and executors", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "参加者ありタスク",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          creator: { settings: { id: "settings-1", username: "作成者" } },
          reporters: [
            { user: { settings: { id: "reporter-1", username: "報告者1" } } },
            { user: { settings: { id: "reporter-2", username: "報告者2" } } },
          ],
          executors: [{ user: { settings: { id: "executor-1", username: "実行者1" } } }],
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(result.returnTasks[0].taskReporterUserIds).toStrictEqual(["reporter-1", "reporter-2"]);
        expect(result.returnTasks[0].taskExecutorUserIds).toStrictEqual(["executor-1"]);
        expect(result.returnTasks[0].taskReporterUserNames).toStrictEqual(["報告者1", "報告者2"]);
        expect(result.returnTasks[0].taskExecutorUserNames).toStrictEqual(["実行者1"]);
      });

      test("should filter out null and undefined user settings", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "null設定テスト",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          creator: { settings: { id: "settings-1", username: "作成者" } },
          reporters: [
            { user: { settings: { id: "reporter-1", username: "報告者1" } } },
            { user: { settings: null } }, // null settings
            { user: null }, // null user
          ],
          executors: [
            { user: { settings: { id: "executor-1", username: "未設定" } } }, // "未設定"は除外される
            { user: { settings: { id: "executor-2", username: "実行者2" } } },
          ],
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(result.returnTasks[0].taskReporterUserIds).toStrictEqual(["reporter-1"]);
        expect(result.returnTasks[0].taskExecutorUserIds).toStrictEqual(["executor-1", "executor-2"]); // IDは除外されない
        expect(result.returnTasks[0].taskReporterUserNames).toStrictEqual(["報告者1"]);
        expect(result.returnTasks[0].taskExecutorUserNames).toStrictEqual(["実行者2"]); // "未設定"は除外される
      });

      test("should handle empty results", async () => {
        // Arrange
        prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(0);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(result).toStrictEqual({
          returnTasks: [],
          totalTaskCount: 0,
        });
      });

      test("should handle multiple filters combined", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "複合フィルターテスト",
          detail: "詳細",
          status: TaskStatus.TASK_COMPLETED,
          contributionType: contributionType.REWARD,
          fixedContributionPoint: 200,
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "task",
          sortDirection: "asc",
          searchQuery: "複合",
          contributionTypeFilter: contributionType.REWARD,
          statusFilter: TaskStatus.TASK_COMPLETED,
          itemPerPage: 5,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: {
            groupId: testGroup.id,
            task: {
              contains: "複合",
              mode: "insensitive",
            },
            contributionType: contributionType.REWARD,
            status: TaskStatus.TASK_COMPLETED,
          },
          orderBy: { task: "asc" },
          skip: 0,
          take: 5,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });

        expect(result.returnTasks).toHaveLength(1);
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test("should throw error when database query fails", async () => {
        // Arrange
        prismaMock.task.findMany.mockRejectedValue(new Error("データベース接続エラー"));

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act & Assert
        await expect(getGroupTaskAndCount(params)).rejects.toThrow("タスク情報の取得中にエラーが発生しました");
      });

      test("should throw error when count query fails", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "テストタスク",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockRejectedValue(new Error("カウントクエリエラー"));

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act & Assert
        await expect(getGroupTaskAndCount(params)).rejects.toThrow("タスク情報の取得中にエラーが発生しました");
      });

      test("should throw error when tasks is null (edge case)", async () => {
        // Arrange
        // Prismaの型定義を無視してnullを返すケースをテスト
        prismaMock.task.findMany.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act & Assert
        await expect(getGroupTaskAndCount(params)).rejects.toThrow("タスク情報の取得中にエラーが発生しました");
      });

      test("should handle unknown error types", async () => {
        // Arrange
        prismaMock.task.findMany.mockRejectedValue("予期しないエラー");

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act & Assert
        await expect(getGroupTaskAndCount(params)).rejects.toThrow("タスク情報の取得中にエラーが発生しました");
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("境界値テスト", () => {
      test("should handle page 0 (edge case)", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "境界値テスト",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 0,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: testGroup.id },
          orderBy: { createdAt: "desc" },
          skip: -10, // (0 - 1) * 10
          take: 10,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });
      });

      test("should handle very large page number", async () => {
        // Arrange
        prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(0);

        const params = {
          groupId: testGroup.id,
          page: 999999,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: testGroup.id },
          orderBy: { createdAt: "desc" },
          skip: 9999980, // (999999 - 1) * 10
          take: 10,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });

        expect(result.returnTasks).toStrictEqual([]);
        expect(result.totalTaskCount).toBe(0);
      });

      test("should handle itemPerPage of 1", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "1件表示テスト",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(100);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 1,
        };

        // Act
        const result = await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: testGroup.id },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 1,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });

        expect(result.returnTasks).toHaveLength(1);
        expect(result.totalTaskCount).toBe(100);
      });

      test("should handle very large itemPerPage", async () => {
        // Arrange
        prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(0);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10000,
        };

        // Act
        await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: testGroup.id },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 10000,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });
      });

      test("should handle empty string search query", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "空文字検索テスト",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: testGroup.id },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 10,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });
      });

      test("should handle very long search query", async () => {
        // Arrange
        const longSearchQuery = "a".repeat(1000);
        prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(0);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: longSearchQuery,
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: {
            groupId: testGroup.id,
            task: {
              contains: longSearchQuery,
              mode: "insensitive",
            },
          },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 10,
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("データベース呼び出しの検証", () => {
      test("should call database methods with correct select fields", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          id: "test-task-1",
          task: "セレクトフィールドテスト",
          detail: "詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          creator: { settings: { id: "settings-1", username: "作成者" } },
        });

        prismaMock.task.findMany.mockResolvedValue([mockTaskData] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
        prismaMock.task.count.mockResolvedValue(1);

        const params = {
          groupId: testGroup.id,
          page: 1,
          sortField: "createdAt",
          sortDirection: "desc",
          searchQuery: "",
          contributionTypeFilter: "ALL" as const,
          statusFilter: "ALL" as const,
          itemPerPage: 10,
        };

        // Act
        await getGroupTaskAndCount(params);

        // Assert
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: testGroup.id },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 10,
          select: {
            id: true,
            task: true,
            detail: true,
            status: true,
            contributionType: true,
            fixedContributionPoint: true,
            fixedEvaluationLogic: true,
            createdAt: true,
            auction: {
              select: {
                id: true,
              },
            },
            fixedEvaluator: {
              select: {
                settings: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
            creator: {
              select: {
                settings: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
            reporters: {
              select: {
                user: {
                  select: {
                    settings: {
                      select: {
                        id: true,
                        username: true,
                      },
                    },
                  },
                },
              },
            },
            executors: {
              select: {
                user: {
                  select: {
                    settings: {
                      select: {
                        id: true,
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
                maxParticipants: true,
                goal: true,
                evaluationMethod: true,
                depositPeriod: true,
                members: {
                  select: {
                    id: true,
                    userId: true,
                  },
                },
              },
            },
          },
        });
      });
    });
  });
});
