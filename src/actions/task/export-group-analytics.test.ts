import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ContributionType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { exportGroupAnalytics } from "./export-group-analytics";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("exportGroupAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should return analytics data grouped by evaluator", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockGroup = {
        id: groupId,
        name: "テストグループ",
        goal: "テスト目標",
        evaluationMethod: "自動評価",
      };
      const mockEvaluator = { id: "evaluator-1", name: "評価者1" };
      const mockCreator = { id: "creator-1", name: "作成者1" };
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: "https://example.com",
        info: "証拠情報",
        status: TaskStatus.TASK_COMPLETED,
        contributionType: ContributionType.REWARD,
        fixedContributionPoint: 100,
        fixedEvaluatorId: "evaluator-1",
        fixedEvaluationLogic: "自動評価ロジック",
        fixedEvaluationDate: new Date("2024-01-15"),
        userFixedSubmitterId: null,
        creator: mockCreator,
        reporters: [],
        executors: [],
      };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.task.count.mockResolvedValue(1);
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);
      prismaMock.user.findMany.mockResolvedValue([mockEvaluator] as unknown as Awaited<
        ReturnType<typeof prismaMock.user.findMany>
      >);

      // 関数実行
      const result = await exportGroupAnalytics(groupId);

      // 検証
      expect(result).toStrictEqual({
        data: {
          評価者1: [
            {
              分析ID: "task-1",
              タスクID: "task-1",
              貢献ポイント: 100,
              評価ロジック: "自動評価ロジック",
              評価者ID: "evaluator-1",
              評価者名: "評価者1",
              タスク内容: "テストタスク",
              参照情報: "https://example.com",
              証拠情報: "証拠情報",
              ステータス: TaskStatus.TASK_COMPLETED,
              貢献タイプ: ContributionType.REWARD,
              タスク報告者: "",
              タスク実行者: "",
              タスク作成者: "作成者1",
              グループ目標: "テスト目標",
              評価方法: "自動評価",
              作成日: "2024-01-15",
            },
          ],
        },
        totalPages: 1,
        currentPage: 1,
      });
    });

    test("should handle pagination correctly", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const page = 2;
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.task.count.mockResolvedValue(400); // 400件のタスク
      prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
      prismaMock.user.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

      // 関数実行
      const result = await exportGroupAnalytics(groupId, page);

      // 検証 - ページネーションの計算
      expect(result).toStrictEqual({
        data: {},
        totalPages: 2, // 400 / 200 = 2ページ
        currentPage: 2,
      });

      // Prismaの呼び出し検証 - skip/takeが正しく設定されているか
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: { groupId },
        skip: 200, // (2 - 1) * 200
        take: 200,
        select: expect.any(Object) as unknown as Prisma.TaskSelect,
      });
    });

    test("should filter only POINTS_AWARDED tasks when onlyFixed is true", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.task.count.mockResolvedValue(0);
      prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
      prismaMock.user.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

      // 関数実行
      await exportGroupAnalytics(groupId, 1, true);

      // 検証 - POINTS_AWARDEDのフィルタが適用されているか
      expect(prismaMock.task.count).toHaveBeenCalledWith({
        where: {
          groupId,
          AND: [{ status: TaskStatus.POINTS_AWARDED }],
        },
      });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          groupId,
          AND: [{ status: TaskStatus.POINTS_AWARDED }],
        },
        skip: 0,
        take: 200,
        select: expect.any(Object) as unknown as Prisma.TaskSelect,
      });
    });

    test("should filter only TASK_COMPLETED tasks when onlyTaskCompleted is true", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.task.count.mockResolvedValue(0);
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      // 関数実行
      await exportGroupAnalytics(groupId, 1, false, true);

      // 検証 - TASK_COMPLETEDのフィルタが適用されているか
      expect(prismaMock.task.count).toHaveBeenCalledWith({
        where: {
          groupId,
          AND: [{ status: TaskStatus.TASK_COMPLETED }],
        },
      });
    });

    test("should handle tasks without evaluator correctly", async () => {
      // テストデータの準備 - 評価者が未割り当てのタスク
      const groupId = "test-group-id";
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: null,
        info: null,
        status: TaskStatus.TASK_COMPLETED,
        contributionType: ContributionType.NON_REWARD,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        fixedEvaluationLogic: null,
        fixedEvaluationDate: null,
        userFixedSubmitterId: null,
        creator: { id: "creator-1", name: "作成者" },
        reporters: [],
        executors: [],
      };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.task.count.mockResolvedValue(1);
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);
      prismaMock.user.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

      // 関数実行
      const result = await exportGroupAnalytics(groupId);

      // 検証 - 未割り当ての評価者が正しく処理されているか
      expect(result.data).toHaveProperty("未割り当て");
      expect(result.data!["未割り当て"][0].評価者名).toBe("未割り当て");
      expect(result.data!["未割り当て"][0].評価者ID).toBe("");
    });

    test("should add evaluation date when onlyFixed is true and fixedEvaluationDate exists", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: null,
        info: null,
        status: TaskStatus.POINTS_AWARDED,
        contributionType: ContributionType.NON_REWARD,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        fixedEvaluationLogic: null,
        fixedEvaluationDate: new Date("2024-01-20"),
        userFixedSubmitterId: null,
        creator: { id: "creator-1", name: "作成者" },
        reporters: [],
        executors: [],
      };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.task.count.mockResolvedValue(1);
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);
      prismaMock.user.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

      // 関数実行
      const result = await exportGroupAnalytics(groupId, 1, true);

      // 検証 - 評価日が追加されているか
      expect(result.data!["未割り当て"][0]).toHaveProperty("評価日", "2024-01-20");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should return error when group is not found", async () => {
      // テストデータの準備
      const groupId = "non-existent-group";

      // Prismaモックの設定 - グループが見つからない
      prismaMock.group.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行
      const result = await exportGroupAnalytics(groupId);

      // 検証
      expect(result).toStrictEqual({ error: "グループが見つかりません" });
    });

    test("should return error when database error occurs", async () => {
      // テストデータの準備
      const groupId = "test-group-id";

      // Prismaモックの設定 - エラーを投げる
      prismaMock.group.findUnique.mockRejectedValue(
        new Error("Database connection error") as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行
      const result = await exportGroupAnalytics(groupId);

      // 検証
      expect(result).toStrictEqual({ error: "分析データのエクスポート中にエラーが発生しました" });
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

      prismaMock.group.findUnique.mockResolvedValue(null);

      const result = await exportGroupAnalytics(groupId);

      expect(result).toStrictEqual({ error: "グループが見つかりません" });
    });

    test("should handle page 0", async () => {
      // ページ0でテスト（最小値）
      const groupId = "test-group-id";
      const page = 0;
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };

      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.task.count.mockResolvedValue(0);
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      await exportGroupAnalytics(groupId, page);

      // 検証 - skip値が負にならないか
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: { groupId },
        skip: -200, // (0 - 1) * 200 = -200
        take: 200,
        select: expect.any(Object) as unknown as Prisma.TaskSelect,
      });
    });

    test("should handle large page number", async () => {
      // 大きなページ番号でテスト
      const groupId = "test-group-id";
      const page = 1000;
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };

      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.task.count.mockResolvedValue(0);
      prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
      prismaMock.user.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

      await exportGroupAnalytics(groupId, page);

      // 検証 - 大きなskip値が正しく計算されているか
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: { groupId },
        skip: 199800, // (1000 - 1) * 200
        take: 200,
        select: expect.any(Object) as unknown as Prisma.TaskSelect,
      });
    });

    test("should handle tasks count of exactly 200", async () => {
      // ちょうど200件のタスクでテスト（境界値）
      const groupId = "test-group-id";
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };

      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.task.count.mockResolvedValue(200);
      prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
      prismaMock.user.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

      const result = await exportGroupAnalytics(groupId);

      // 検証 - totalPagesが正しく計算されているか
      expect(result.totalPages).toBe(1); // 200 / 200 = 1ページ
    });

    test("should handle tasks count of 201", async () => {
      // 201件のタスクでテスト（境界値+1）
      const groupId = "test-group-id";
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };

      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.task.count.mockResolvedValue(201);
      prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
      prismaMock.user.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

      const result = await exportGroupAnalytics(groupId);

      // 検証 - totalPagesが正しく計算されているか
      expect(result.totalPages).toBe(2); // Math.ceil(201 / 200) = 2ページ
    });
  });
});
