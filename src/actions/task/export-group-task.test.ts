import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ContributionType, TaskStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { exportGroupTask } from "./export-group-task";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("exportGroupTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should return formatted task data when tasks exist", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockUser = { id: "user-1", name: "テストユーザー" };
      const mockReporter = {
        id: "reporter-1",
        name: "報告者",
        userId: "user-1",
        user: mockUser,
      };
      const mockExecutor = {
        id: "executor-1",
        name: "実行者",
        userId: "user-1",
        user: mockUser,
      };
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: "https://example.com",
        info: "証拠情報",
        status: TaskStatus.PENDING,
        fixedContributionPoint: 100,
        fixedEvaluatorId: "evaluator-1",
        contributionType: ContributionType.REWARD,
        creator: mockUser,
        reporters: [mockReporter],
        executors: [mockExecutor],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };

      // Prismaモックの設定
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);

      // 関数実行
      const result = await exportGroupTask(groupId);

      // 検証
      expect(result).toStrictEqual([
        {
          タスクID: "task-1",
          タスク内容: "テストタスク",
          参照: "https://example.com",
          証拠情報: "証拠情報",
          ステータス: TaskStatus.PENDING,
          貢献ポイント: 100,
          評価者: "evaluator-1",
          貢献タイプ: ContributionType.REWARD,
          作成者: "テストユーザー",
          報告者: "テストユーザー",
          実行者: "テストユーザー",
          作成日: "2024-01-01",
          更新日: "2024-01-02",
        },
      ]);

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
              name: true,
            },
          },
          reporters: {
            select: {
              name: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          executors: {
            select: {
              name: true,
              user: {
                select: {
                  name: true,
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

    test("should filter tasks by date range when startDate and endDate are provided", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: null,
        info: null,
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        contributionType: ContributionType.NON_REWARD,
        creator: { name: "作成者" },
        reporters: [],
        executors: [],
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
      };

      // Prismaモックの設定
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);

      // 関数実行
      await exportGroupTask(groupId, startDate, endDate);

      // 検証 - 日付範囲の条件が正しく設定されているか
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          groupId,
          createdAt: {
            gte: startOfDay(startDate),
            lte: endOfDay(endDate),
          },
        },
        select: expect.any(Object) as unknown as Prisma.TaskSelect,
        orderBy: {
          createdAt: "desc",
        },
      });
    });

    test("should filter only TASK_COMPLETED tasks when onlyTaskCompleted is true", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: null,
        info: null,
        status: TaskStatus.TASK_COMPLETED,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        contributionType: ContributionType.NON_REWARD,
        creator: { name: "作成者" },
        reporters: [],
        executors: [],
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
      };

      // Prismaモックの設定
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);

      // 関数実行
      await exportGroupTask(groupId, undefined, undefined, true);

      // 検証 - TASK_COMPLETEDのフィルタが適用されているか
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          groupId,
          status: TaskStatus.TASK_COMPLETED,
        },
        select: expect.any(Object) as unknown as Prisma.TaskSelect,
        orderBy: {
          createdAt: "desc",
        },
      });
    });

    test("should handle tasks with null values correctly", async () => {
      // テストデータの準備 - null値を含むタスク
      const groupId = "test-group-id";
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: null,
        info: null,
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        contributionType: ContributionType.NON_REWARD,
        creator: null,
        reporters: [],
        executors: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };

      // Prismaモックの設定
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);

      // 関数実行
      const result = await exportGroupTask(groupId);

      // 検証 - null値が適切にデフォルト値に変換されているか
      expect(result[0]).toStrictEqual({
        タスクID: "task-1",
        タスク内容: "テストタスク",
        参照: "",
        証拠情報: "",
        ステータス: TaskStatus.PENDING,
        貢献ポイント: 0,
        評価者: "",
        貢献タイプ: ContributionType.NON_REWARD,
        作成者: "不明",
        報告者: "",
        実行者: "",
        作成日: "2024-01-01",
        更新日: "2024-01-02",
      });
    });

    test("should handle reporters and executors without user association", async () => {
      // テストデータの準備 - userがnullの報告者・実行者
      const groupId = "test-group-id";
      const mockReporter = {
        name: "報告者名前のみ",
        userId: null,
        user: null,
      };
      const mockExecutor = {
        name: "実行者名前のみ",
        userId: null,
        user: null,
      };
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: null,
        info: null,
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        contributionType: ContributionType.NON_REWARD,
        creator: { name: "作成者" },
        reporters: [mockReporter],
        executors: [mockExecutor],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };

      // Prismaモックの設定
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);

      // 関数実行
      const result = await exportGroupTask(groupId);

      // 検証 - 名前のみの報告者・実行者が正しく処理されているか
      expect(result[0].報告者).toBe("報告者名前のみ");
      expect(result[0].実行者).toBe("実行者名前のみ");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should throw error when no tasks are found", async () => {
      // テストデータの準備
      const groupId = "non-existent-group";

      // Prismaモックの設定 - 空配列を返す
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数実行と検証
      await expect(exportGroupTask(groupId)).rejects.toThrow(
        "グループのTask情報のエクスポート中にエラーが発生しました",
      );
    });

    test("should throw error when tasks is null", async () => {
      // テストデータの準備
      const groupId = "test-group-id";

      // Prismaモックの設定 - nullを返す
      prismaMock.task.findMany.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
      );

      // 関数実行と検証
      await expect(exportGroupTask(groupId)).rejects.toThrow(
        "グループのTask情報のエクスポート中にエラーが発生しました",
      );
    });

    test("should throw error when database error occurs", async () => {
      // テストデータの準備
      const groupId = "test-group-id";

      // Prismaモックの設定 - エラーを投げる
      prismaMock.task.findMany.mockRejectedValue(new Error("Database connection error"));

      // 関数実行と検証
      await expect(exportGroupTask(groupId)).rejects.toThrow(
        "グループのTask情報のエクスポート中にエラーが発生しました",
      );
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    test("should handle empty groupId", async () => {
      // 空のgroupIdでテスト
      const groupId = "";
      prismaMock.task.findMany.mockResolvedValue([]);

      await expect(exportGroupTask(groupId)).rejects.toThrow(
        "グループのTask情報のエクスポート中にエラーが発生しました",
      );
    });

    test("should handle startDate only", async () => {
      // startDateのみ指定
      const groupId = "test-group-id";
      const startDate = new Date("2024-01-01");
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: null,
        info: null,
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        contributionType: ContributionType.NON_REWARD,
        creator: { name: "作成者" },
        reporters: [],
        executors: [],
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
      };

      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);

      await exportGroupTask(groupId, startDate);

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          groupId,
          createdAt: {
            gte: startOfDay(startDate),
          },
        },
        select: expect.any(Object) as unknown as Prisma.TaskSelect,
        orderBy: {
          createdAt: "desc",
        },
      });
    });

    test("should handle endDate only", async () => {
      // endDateのみ指定
      const groupId = "test-group-id";
      const endDate = new Date("2024-01-31");
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: null,
        info: null,
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        contributionType: ContributionType.NON_REWARD,
        creator: { name: "作成者" },
        reporters: [],
        executors: [],
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
      };

      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);

      await exportGroupTask(groupId, undefined, endDate);

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          groupId,
          createdAt: {
            lte: endOfDay(endDate),
          },
        },
        select: expect.any(Object) as unknown as Prisma.TaskSelect,
        orderBy: {
          createdAt: "desc",
        },
      });
    });
  });
});
