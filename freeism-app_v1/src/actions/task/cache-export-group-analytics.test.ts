import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ContributionType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { cachedExportGroupAnalytics } from "./cache-export-group-analytics";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cachedExportGroupAnalytics", () => {
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
      const mockEvaluator = {
        id: "evaluator-1",
        settings: { username: "評価者1" },
      };
      const mockCreator = {
        id: "creator-1",
        settings: { username: "作成者1" },
      };
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
      prismaMock.task.count.mockResolvedValue(1);
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.user.findMany.mockResolvedValue([mockEvaluator] as unknown as Awaited<
        ReturnType<typeof prismaMock.user.findMany>
      >);

      // 関数実行
      const result = await cachedExportGroupAnalytics(groupId);

      // 検証
      expect(result).toStrictEqual({
        success: true,
        message: "分析データのエクスポートが完了しました",
        data: {
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
        },
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
      const result = await cachedExportGroupAnalytics(groupId, page);

      // 検証 - ページネーションの計算
      expect(result).toStrictEqual({
        success: true,
        message: "分析データのエクスポートが完了しました",
        data: {
          data: {},
          totalPages: 2, // 400 / 200 = 2ページ
          currentPage: 2,
        },
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
      await cachedExportGroupAnalytics(groupId, 1, true);

      // 検証 - POINTS_AWARDEDのフィルタが適用されているか
      expect(prismaMock.task.count).toHaveBeenCalledWith({
        where: {
          groupId,
          status: TaskStatus.POINTS_AWARDED,
        },
      });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          groupId,
          status: TaskStatus.POINTS_AWARDED,
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
      await cachedExportGroupAnalytics(groupId, 1, false, true);

      // 検証 - TASK_COMPLETEDのフィルタが適用されているか
      expect(prismaMock.task.count).toHaveBeenCalledWith({
        where: {
          groupId,
          status: TaskStatus.TASK_COMPLETED,
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
        creator: { id: "creator-1", settings: { username: "作成者" } },
        reporters: [],
        executors: [],
      };

      // Prismaモックの設定
      prismaMock.task.count.mockResolvedValue(1);
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.user.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

      // 関数実行
      const result = await cachedExportGroupAnalytics(groupId);

      // 検証 - 未割り当ての評価者が正しく処理されているか
      expect(result.data?.data).toHaveProperty("未設定_null");
      expect(result.data?.data?.["未設定_null"][0].評価者名).toBe("未設定_null");
      expect(result.data?.data?.["未設定_null"][0].評価者ID).toBe("");
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
        creator: { id: "creator-1", settings: { username: "作成者" } },
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
      const result = await cachedExportGroupAnalytics(groupId, 1, true);

      // 検証 - 評価日が追加されているか
      const evaluatorData = Object.values(result.data?.data ?? {})[0];
      expect(evaluatorData?.[0]).toHaveProperty("評価日", "2024-01-20");
      expect(evaluatorData?.[0]).toHaveProperty("評価者名", "未設定_null");
      expect(evaluatorData?.[0]).toHaveProperty("評価者ID", "");
    });

    test("should handle tasks with reporters and executors correctly", async () => {
      // テストデータの準備 - 報告者と実行者がいるタスク
      const groupId = "test-group-id";
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };
      const mockEvaluator = {
        id: "evaluator-1",
        settings: { username: "評価者1" },
      };
      const mockTask = {
        id: "task-1",
        task: "テストタスク",
        reference: "https://example.com",
        info: "証拠情報",
        status: TaskStatus.TASK_COMPLETED,
        contributionType: ContributionType.REWARD,
        fixedContributionPoint: 150,
        fixedEvaluatorId: "evaluator-1",
        fixedEvaluationLogic: "自動評価ロジック",
        fixedEvaluationDate: new Date("2024-01-15"),
        userFixedSubmitterId: null,
        creator: { id: "creator-1", settings: { username: "作成者1" } },
        reporters: [
          {
            user: {
              id: "reporter-1",
              settings: { username: "報告者1" },
            },
          },
          {
            user: {
              id: "reporter-2",
              settings: { username: "報告者2" },
            },
          },
        ],
        executors: [
          {
            user: {
              id: "executor-1",
              settings: { username: "実行者1" },
            },
          },
          {
            user: {
              id: "executor-2",
              settings: { username: "実行者2" },
            },
          },
        ],
      };

      // Prismaモックの設定
      prismaMock.task.count.mockResolvedValue(1);
      prismaMock.task.findMany.mockResolvedValue([mockTask] as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findMany>
      >);
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.user.findMany.mockResolvedValue([mockEvaluator] as unknown as Awaited<
        ReturnType<typeof prismaMock.user.findMany>
      >);

      // 関数実行
      const result = await cachedExportGroupAnalytics(groupId);

      // 検証 - 報告者と実行者の名前が正しく結合されているか
      expect(result.data?.data?.["評価者1"][0].タスク報告者).toBe("報告者1, 報告者2");
      expect(result.data?.data?.["評価者1"][0].タスク実行者).toBe("実行者1, 実行者2");
      expect(result.data?.data?.["評価者1"][0].評価者名).toBe("評価者1");
      expect(result.data?.data?.["評価者1"][0].タスク作成者).toBe("作成者1");
    });

    test("should handle multiple evaluators correctly", async () => {
      // テストデータの準備 - 複数の評価者がいる場合
      const groupId = "test-group-id";
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };
      const mockEvaluators = [
        {
          id: "evaluator-1",
          settings: { username: "評価者1" },
        },
        {
          id: "evaluator-2",
          settings: { username: "評価者2" },
        },
        {
          id: "evaluator-3",
          settings: { username: "評価者3" },
        },
      ];
      const mockTasks = [
        {
          id: "task-1",
          task: "タスク1",
          reference: "https://example1.com",
          info: "証拠情報1",
          status: TaskStatus.TASK_COMPLETED,
          contributionType: ContributionType.REWARD,
          fixedContributionPoint: 100,
          fixedEvaluatorId: "evaluator-1",
          fixedEvaluationLogic: "評価ロジック1",
          fixedEvaluationDate: new Date("2024-01-15"),
          userFixedSubmitterId: null,
          creator: { id: "creator-1", settings: { username: "作成者1" } },
          reporters: [],
          executors: [],
        },
        {
          id: "task-2",
          task: "タスク2",
          reference: "https://example2.com",
          info: "証拠情報2",
          status: TaskStatus.TASK_COMPLETED,
          contributionType: ContributionType.NON_REWARD,
          fixedContributionPoint: 200,
          fixedEvaluatorId: "evaluator-2",
          fixedEvaluationLogic: "評価ロジック2",
          fixedEvaluationDate: new Date("2024-01-16"),
          userFixedSubmitterId: null,
          creator: { id: "creator-2", settings: { username: "作成者2" } },
          reporters: [],
          executors: [],
        },
        {
          id: "task-3",
          task: "タスク3",
          reference: "https://example3.com",
          info: "証拠情報3",
          status: TaskStatus.TASK_COMPLETED,
          contributionType: ContributionType.REWARD,
          fixedContributionPoint: 150,
          fixedEvaluatorId: "evaluator-1",
          fixedEvaluationLogic: "評価ロジック3",
          fixedEvaluationDate: new Date("2024-01-17"),
          userFixedSubmitterId: null,
          creator: { id: "creator-3", settings: { username: "作成者3" } },
          reporters: [],
          executors: [],
        },
        {
          id: "task-4",
          task: "タスク4",
          reference: "https://example4.com",
          info: "証拠情報4",
          status: TaskStatus.TASK_COMPLETED,
          contributionType: ContributionType.NON_REWARD,
          fixedContributionPoint: 300,
          fixedEvaluatorId: "evaluator-3",
          fixedEvaluationLogic: "評価ロジック4",
          fixedEvaluationDate: new Date("2024-01-18"),
          userFixedSubmitterId: null,
          creator: { id: "creator-4", settings: { username: "作成者4" } },
          reporters: [],
          executors: [],
        },
      ];

      // Prismaモックの設定
      prismaMock.task.count.mockResolvedValue(4);
      prismaMock.task.findMany.mockResolvedValue(
        mockTasks as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
      );
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );
      prismaMock.user.findMany.mockResolvedValue(
        mockEvaluators as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>,
      );

      // 関数実行
      const result = await cachedExportGroupAnalytics(groupId);

      // 検証 - 評価者ごとにデータが正しくグループ化されているか
      expect(Object.keys(result.data?.data)).toHaveLength(3);
      expect(result.data?.data).toHaveProperty("評価者1");
      expect(result.data?.data).toHaveProperty("評価者2");
      expect(result.data?.data).toHaveProperty("評価者3");

      // 評価者1のタスクが2件あることを確認
      expect(result.data?.data?.["評価者1"]).toHaveLength(2);
      expect(result.data?.data?.["評価者1"][0].タスク内容).toBe("タスク1");
      expect(result.data?.data?.["評価者1"][1].タスク内容).toBe("タスク3");
      expect(result.data?.data?.["評価者1"][0].貢献ポイント).toBe(100);
      expect(result.data?.data?.["評価者1"][1].貢献ポイント).toBe(150);

      // 評価者2のタスクが1件あることを確認
      expect(result.data?.data?.["評価者2"]).toHaveLength(1);
      expect(result.data?.data?.["評価者2"][0].タスク内容).toBe("タスク2");
      expect(result.data?.data?.["評価者2"][0].貢献ポイント).toBe(200);

      // 評価者3のタスクが1件あることを確認
      expect(result.data?.data?.["評価者3"]).toHaveLength(1);
      expect(result.data?.data?.["評価者3"][0].タスク内容).toBe("タスク4");
      expect(result.data?.data?.["評価者3"][0].貢献ポイント).toBe(300);

      // 各評価者のデータが正しい評価者名を持っていることを確認
      expect(result.data?.data?.["評価者1"][0].評価者名).toBe("評価者1");
      expect(result.data?.data?.["評価者2"][0].評価者名).toBe("評価者2");
      expect(result.data?.data?.["評価者3"][0].評価者名).toBe("評価者3");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should throw error when group is not found", async () => {
      // テストデータの準備
      const groupId = "non-existent-group";

      // Prismaモックの設定 - グループが見つからない
      prismaMock.task.count.mockResolvedValue(1);
      prismaMock.task.findMany.mockResolvedValue([
        {
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
          creator: { id: "creator-1", settings: { username: "作成者" } },
          reporters: [],
          executors: [],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);
      prismaMock.group.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行とエラー検証
      await expect(cachedExportGroupAnalytics(groupId)).rejects.toThrow("グループが見つかりません");
    });

    test("should throw error when database error occurs", async () => {
      // テストデータの準備
      const groupId = "test-group-id";

      // Prismaモックの設定 - エラーを投げる
      prismaMock.task.count.mockRejectedValue(
        new Error("Database connection error") as unknown as Awaited<ReturnType<typeof prismaMock.task.count>>,
      );

      // 関数実行とエラー検証
      await expect(cachedExportGroupAnalytics(groupId)).rejects.toThrow("Database connection error");
    });

    test("should throw error when task is not found", async () => {
      const groupId = "test-group-id";
      const mockGroup = { id: groupId, name: "テストグループ", goal: "目標", evaluationMethod: "評価方法" };

      prismaMock.task.count.mockResolvedValue(1);
      prismaMock.task.findMany.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
      );
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroup as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      await expect(cachedExportGroupAnalytics(groupId)).rejects.toThrow("タスクが見つかりません");
    });

    test.each([
      { groupId: "test-group-id", page: null, onlyFixed: false, onlyTaskCompleted: false },
      { groupId: "test-group-id", page: "invalid", onlyFixed: false, onlyTaskCompleted: false },
      { groupId: "test-group-id", page: -1, onlyFixed: false, onlyTaskCompleted: false },
      { groupId: "test-group-id", page: 1, onlyFixed: null, onlyTaskCompleted: false },
      { groupId: "test-group-id", page: 1, onlyFixed: false, onlyTaskCompleted: null },
      { groupId: "test-group-id", page: 1, onlyFixed: false, onlyTaskCompleted: false, limit: null },
      { groupId: "test-group-id", page: 1, onlyFixed: false, onlyTaskCompleted: false, limit: -1 },
      { groupId: "test-group-id", page: 1, onlyFixed: false, onlyTaskCompleted: false, limit: 0 },
      { groupId: "test-group-id", page: 1, onlyFixed: false, onlyTaskCompleted: false, limit: "invalid" },
      { groupId: null, page: 1, onlyFixed: false, onlyTaskCompleted: false, limit: 200 },
      { groupId: "", page: 1, onlyFixed: false, onlyTaskCompleted: false, limit: 200 },
    ])("should handle invalid parameters correctly", async ({ groupId, page, onlyFixed, onlyTaskCompleted, limit }) => {
      await expect(
        cachedExportGroupAnalytics(
          groupId!,
          page as number,
          onlyFixed!,
          onlyTaskCompleted!,
          limit as number | undefined,
        ),
      ).rejects.toThrow(`パラメータが不正です`);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    test("should throw error for empty groupId", async () => {
      // 空のgroupIdでテスト
      const groupId = "";

      // 関数実行とエラー検証
      await expect(cachedExportGroupAnalytics(groupId)).rejects.toThrow("パラメータが不正です");
    });

    test("should throw error for page 0", async () => {
      // ページ0でテスト（最小値）
      const groupId = "test-group-id";
      const page = 0;

      // 関数実行とエラー検証
      await expect(cachedExportGroupAnalytics(groupId, page)).rejects.toThrow("パラメータが不正です");
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

      const result = await cachedExportGroupAnalytics(groupId);

      // 検証 - totalPagesが正しく計算されているか
      expect(result.data?.totalPages).toBe(1); // 200 / 200 = 1ページ
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

      const result = await cachedExportGroupAnalytics(groupId);

      // 検証 - totalPagesが正しく計算されているか
      expect(result.data?.totalPages).toBe(2); // Math.ceil(201 / 200) = 2ページ
    });
  });
});
