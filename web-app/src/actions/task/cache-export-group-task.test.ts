import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ContributionType, TaskStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GroupTaskCsvDataItem } from "./cache-export-group-task";
import { cachedExportGroupTask } from "./cache-export-group-task";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータファクトリー関数
 */
const createMockUser = (id: string, username = "テストユーザー") => ({
  id,
  settings: {
    username,
  },
});

const createMockReporter = (name: string, username?: string) => ({
  name,
  user: username ? { settings: { username } } : null,
});

const createMockExecutor = (name: string, username?: string) => ({
  name,
  user: username ? { settings: { username } } : null,
});

type MockTaskData = {
  id?: string;
  task?: string;
  reference?: string | null;
  info?: string | null;
  status?: TaskStatus;
  fixedContributionPoint?: number | null;
  fixedEvaluatorId?: string | null;
  contributionType?: ContributionType;
  creator?: ReturnType<typeof createMockUser> | null;
  reporters?: ReturnType<typeof createMockReporter>[];
  executors?: ReturnType<typeof createMockExecutor>[];
  createdAt?: Date;
  updatedAt?: Date;
};

const createMockTask = (overrides: MockTaskData = {}) => ({
  id: "task-1",
  task: "テストタスク",
  reference: "https://example.com",
  info: "証拠情報",
  status: TaskStatus.PENDING,
  fixedContributionPoint: 100,
  fixedEvaluatorId: "evaluator-1",
  contributionType: ContributionType.REWARD,
  creator: createMockUser("creator-1", "作成者"),
  reporters: [createMockReporter("報告者", "報告者ユーザー")],
  executors: [createMockExecutor("実行者", "実行者ユーザー")],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
  ...overrides,
});

const createExpectedCsvItem = (overrides: Partial<GroupTaskCsvDataItem> = {}): GroupTaskCsvDataItem => ({
  タスクID: "task-1",
  タスク内容: "テストタスク",
  参照: "https://example.com",
  証拠情報: "証拠情報",
  ステータス: TaskStatus.PENDING,
  貢献ポイント: 100,
  評価者: "evaluator-1",
  貢献タイプ: ContributionType.REWARD,
  作成者: "作成者",
  報告者: "報告者ユーザー",
  実行者: "実行者ユーザー",
  作成日: "2024-01-01",
  更新日: "2024-01-02",
  ...overrides,
});

/**
 * Prismaモック設定ヘルパー関数
 */
const setupPrismaMockWithTasks = (tasks: ReturnType<typeof createMockTask>[]) => {
  prismaMock.task.findMany.mockResolvedValue(tasks as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
};

const setupPrismaMockError = (error: Error) => {
  prismaMock.task.findMany.mockRejectedValue(error);
};

const setupPrismaMockEmpty = () => {
  prismaMock.task.findMany.mockResolvedValue([]);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cachedExportGroupTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should return formatted task data with complete information", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockTask = createMockTask();
      setupPrismaMockWithTasks([mockTask]);

      // 関数実行
      const result = await cachedExportGroupTask(groupId);

      // 検証
      expect(result).toStrictEqual({
        success: true,
        message: "タスク情報のエクスポートが完了しました",
        data: [createExpectedCsvItem()],
      });

      // Prismaの呼び出し検証
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: { groupId },
        select: {
          id: true,
          task: true,
          reference: true,
          status: true,
          contributionType: true,
          info: true,
          fixedContributionPoint: true,
          fixedEvaluatorId: true,
          createdAt: true,
          updatedAt: true,
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
              name: true,
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
              name: true,
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
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });

    test("should handle null values correctly", async () => {
      // null値を含むタスクのテストデータ
      const groupId = "test-group-id";
      const mockTask = createMockTask({
        reference: null,
        info: null,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        creator: null,
        reporters: [],
        executors: [],
      });
      setupPrismaMockWithTasks([mockTask]);

      // 関数実行
      const result = await cachedExportGroupTask(groupId);

      // 検証 - null値が適切にデフォルト値に変換されているか
      expect(result).toStrictEqual({
        success: true,
        message: "タスク情報のエクスポートが完了しました",
        data: [
          createExpectedCsvItem({
            参照: "",
            証拠情報: "",
            貢献ポイント: 0,
            評価者: "",
            作成者: "未設定",
            報告者: "",
            実行者: "",
          }),
        ],
      });
    });

    test("should handle reporters and executors without user association", async () => {
      // userがnullの報告者・実行者のテストデータ
      const groupId = "test-group-id";
      const mockTask = createMockTask({
        reporters: [createMockReporter("報告者名前のみ")],
        executors: [createMockExecutor("実行者名前のみ")],
      });
      setupPrismaMockWithTasks([mockTask]);

      // 関数実行
      const result = await cachedExportGroupTask(groupId);

      // 検証 - 名前のみの報告者・実行者が正しく処理されているか
      expect(result.data?.[0].報告者).toBe("報告者名前のみ");
      expect(result.data?.[0].実行者).toBe("実行者名前のみ");
    });

    test("should handle multiple reporters and executors", async () => {
      // 複数の報告者・実行者のテストデータ
      const groupId = "test-group-id";
      const mockTask = createMockTask({
        reporters: [createMockReporter("報告者1", "報告者1ユーザー"), createMockReporter("報告者2", "報告者2ユーザー")],
        executors: [createMockExecutor("実行者1", "実行者1ユーザー"), createMockExecutor("実行者2", "実行者2ユーザー")],
      });
      setupPrismaMockWithTasks([mockTask]);

      // 関数実行
      const result = await cachedExportGroupTask(groupId);

      // 検証 - 複数の報告者・実行者が正しく結合されているか
      expect(result.data?.[0].報告者).toBe("報告者1ユーザー, 報告者2ユーザー");
      expect(result.data?.[0].実行者).toBe("実行者1ユーザー, 実行者2ユーザー");
    });

    describe("フィルタリング機能", () => {
      test("should filter tasks by date range when startDate and endDate are provided", async () => {
        const groupId = "test-group-id";
        const startDate = new Date("2024-01-01");
        const endDate = new Date("2024-01-31");
        const mockTask = createMockTask();
        setupPrismaMockWithTasks([mockTask]);

        // 関数実行
        await cachedExportGroupTask(groupId, startDate, endDate);

        // 検証 - 日付範囲の条件が正しく設定されているか
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: {
            groupId,
            createdAt: {
              gte: startOfDay(startDate),
              lte: endOfDay(endDate),
            },
          },
          select: expect.any(Object),
          orderBy: {
            createdAt: "desc",
          },
        });
      });

      test("should filter tasks by startDate only", async () => {
        const groupId = "test-group-id";
        const startDate = new Date("2024-01-01");
        const mockTask = createMockTask();
        setupPrismaMockWithTasks([mockTask]);

        await cachedExportGroupTask(groupId, startDate);

        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: {
            groupId,
            createdAt: {
              gte: startOfDay(startDate),
            },
          },
          select: expect.any(Object),
          orderBy: {
            createdAt: "desc",
          },
        });
      });

      test("should filter tasks by endDate only", async () => {
        const groupId = "test-group-id";
        const endDate = new Date("2024-01-31");
        const mockTask = createMockTask();
        setupPrismaMockWithTasks([mockTask]);

        await cachedExportGroupTask(groupId, undefined, endDate);

        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: {
            groupId,
            createdAt: {
              lte: endOfDay(endDate),
            },
          },
          select: expect.any(Object),
          orderBy: {
            createdAt: "desc",
          },
        });
      });

      test("should filter only TASK_COMPLETED tasks when onlyTaskCompleted is true", async () => {
        const groupId = "test-group-id";
        const mockTask = createMockTask({ status: TaskStatus.TASK_COMPLETED });
        setupPrismaMockWithTasks([mockTask]);

        await cachedExportGroupTask(groupId, undefined, undefined, true);

        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: {
            groupId,
            status: TaskStatus.TASK_COMPLETED,
          },
          select: expect.any(Object),
          orderBy: {
            createdAt: "desc",
          },
        });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should throw error when groupId is empty", async () => {
      const groupId = "";

      await expect(cachedExportGroupTask(groupId)).rejects.toThrow("グループIDが指定されていません");
    });

    test("should return error response when no tasks are found", async () => {
      const groupId = "non-existent-group";
      setupPrismaMockEmpty();

      const result = await cachedExportGroupTask(groupId);

      expect(result).toStrictEqual({
        success: false,
        message: "タスクが見つかりません",
        data: [],
      });
    });

    test("should return error response when tasks is null", async () => {
      const groupId = "test-group-id";
      prismaMock.task.findMany.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
      );

      const result = await cachedExportGroupTask(groupId);

      expect(result).toStrictEqual({
        success: false,
        message: "タスクが見つかりません",
        data: [],
      });
    });

    test("should throw error when database error occurs", async () => {
      const groupId = "test-group-id";
      setupPrismaMockError(new Error("Database connection error"));

      await expect(cachedExportGroupTask(groupId)).rejects.toThrow("Database connection error");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    test("should handle undefined groupId", async () => {
      const groupId = undefined as unknown as string;

      await expect(cachedExportGroupTask(groupId)).rejects.toThrow("グループIDが指定されていません");
    });

    test("should handle tasks with empty arrays for reporters and executors", async () => {
      const groupId = "test-group-id";
      const mockTask = createMockTask({
        reporters: [],
        executors: [],
      });
      setupPrismaMockWithTasks([mockTask]);

      const result = await cachedExportGroupTask(groupId);

      expect(result.data?.[0].報告者).toBe("");
      expect(result.data?.[0].実行者).toBe("");
    });

    test("should handle edge case date values", async () => {
      const groupId = "test-group-id";
      const mockTask = createMockTask({
        createdAt: new Date("1970-01-01"),
        updatedAt: new Date("2099-12-31"),
      });
      setupPrismaMockWithTasks([mockTask]);

      const result = await cachedExportGroupTask(groupId);

      expect(result.data?.[0].作成日).toBe("1970-01-01");
      expect(result.data?.[0].更新日).toBe("2099-12-31");
    });
  });
});
