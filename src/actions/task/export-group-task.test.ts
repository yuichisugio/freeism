import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GroupTaskCsvDataItem } from "./cache-export-group-task";
import { cachedExportGroupTask } from "./cache-export-group-task";
import { exportGroupTask } from "./export-group-task";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// cachedExportGroupTaskをモック化
vi.mock("./cache-export-group-task", () => ({
  cachedExportGroupTask: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータファクトリー関数
 */
const createMockCsvData = (): GroupTaskCsvDataItem[] => [
  {
    タスクID: "task-1",
    タスク内容: "テストタスク",
    参照: "https://example.com",
    証拠情報: "証拠情報",
    ステータス: "PENDING",
    貢献ポイント: 100,
    評価者: "evaluator-1",
    貢献タイプ: "REWARD",
    作成者: "作成者",
    報告者: "報告者",
    実行者: "実行者",
    作成日: "2024-01-01",
    更新日: "2024-01-02",
  },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("exportGroupTask", () => {
  const mockCachedExportGroupTaskFn = vi.mocked(cachedExportGroupTask);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should call cachedExportGroupTask with correct arguments and return its result", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockData = createMockCsvData();
      mockCachedExportGroupTaskFn.mockResolvedValue({
        success: true,
        message: "データを取得しました",
        data: mockData,
      });

      // 関数実行
      const result = await exportGroupTask(groupId, undefined, undefined, false);

      // 検証
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, undefined, undefined, false);
      expect(result).toStrictEqual(mockData);
    });

    test("should call cachedExportGroupTask with startDate when provided", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const startDate = new Date("2024-01-01");
      const mockData = createMockCsvData();
      mockCachedExportGroupTaskFn.mockResolvedValue({
        success: true,
        message: "データを取得しました",
        data: mockData,
      });

      // 関数実行
      const result = await exportGroupTask(groupId, startDate, undefined, false);

      // 検証
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, startDate, undefined, false);
      expect(result).toStrictEqual(mockData);
    });

    test("should call cachedExportGroupTask with endDate when provided", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const endDate = new Date("2024-12-31");
      const mockData = createMockCsvData();
      mockCachedExportGroupTaskFn.mockResolvedValue({
        success: true,
        message: "データを取得しました",
        data: mockData,
      });

      // 関数実行
      const result = await exportGroupTask(groupId, undefined, endDate, false);

      // 検証
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, undefined, endDate, false);
      expect(result).toStrictEqual(mockData);
    });

    test("should call cachedExportGroupTask with both startDate and endDate when provided", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");
      const mockData = createMockCsvData();
      mockCachedExportGroupTaskFn.mockResolvedValue({
        success: true,
        message: "データを取得しました",
        data: mockData,
      });

      // 関数実行
      const result = await exportGroupTask(groupId, startDate, endDate, false);

      // 検証
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, startDate, endDate, false);
      expect(result).toStrictEqual(mockData);
    });

    test("should call cachedExportGroupTask with onlyTaskCompleted=true when provided", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockData = createMockCsvData();
      mockCachedExportGroupTaskFn.mockResolvedValue({
        success: true,
        message: "データを取得しました",
        data: mockData,
      });

      // 関数実行
      const result = await exportGroupTask(groupId, undefined, undefined, true);

      // 検証
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, undefined, undefined, true);
      expect(result).toStrictEqual(mockData);
    });

    test("should call cachedExportGroupTask with all parameters when provided", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");
      const onlyTaskCompleted = true;
      const mockData = createMockCsvData();
      mockCachedExportGroupTaskFn.mockResolvedValue({
        success: true,
        message: "データを取得しました",
        data: mockData,
      });

      // 関数実行
      const result = await exportGroupTask(groupId, startDate, endDate, onlyTaskCompleted);

      // 検証
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, startDate, endDate, onlyTaskCompleted);
      expect(result).toStrictEqual(mockData);
    });

    test("should return empty array when cachedExportGroupTask returns empty array", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      mockCachedExportGroupTaskFn.mockResolvedValue({
        success: true,
        message: "データを取得しました",
        data: [],
      });

      // 関数実行
      const result = await exportGroupTask(groupId, undefined, undefined, false);

      // 検証
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, undefined, undefined, false);
      expect(result).toStrictEqual([]);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should throw error when cachedExportGroupTask throws error", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const errorMessage = "データベースエラー";
      mockCachedExportGroupTaskFn.mockRejectedValue({
        success: false,
        message: errorMessage,
        data: null,
      });

      // 関数実行と検証
      await expect(exportGroupTask(groupId, undefined, undefined, false)).rejects.toThrow(errorMessage);
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, undefined, undefined, false);
    });

    test("should throw error when cachedExportGroupTask throws error with all parameters", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");
      const onlyTaskCompleted = true;
      const errorMessage = "グループが見つかりません";
      mockCachedExportGroupTaskFn.mockRejectedValue(new Error(errorMessage));

      // 関数実行と検証
      await expect(exportGroupTask(groupId, startDate, endDate, onlyTaskCompleted)).rejects.toThrow(errorMessage);
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, startDate, endDate, onlyTaskCompleted);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    test("should handle null dates correctly", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockData = createMockCsvData();
      mockCachedExportGroupTaskFn.mockResolvedValue({
        success: true,
        message: "データを取得しました",
        data: mockData,
      });

      // 関数実行
      const result = await exportGroupTask(groupId, null as unknown as Date, null as unknown as Date);

      // 検証
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, null, null, false);
      expect(result).toStrictEqual(mockData);
    });

    test("should handle false value for onlyTaskCompleted correctly", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const mockData = createMockCsvData();
      mockCachedExportGroupTaskFn.mockResolvedValue({
        success: true,
        message: "データを取得しました",
        data: mockData,
      });

      // 関数実行
      const result = await exportGroupTask(groupId, undefined, undefined, false);

      // 検証
      expect(mockCachedExportGroupTaskFn).toHaveBeenCalledWith(groupId, undefined, undefined, false);
      expect(result).toStrictEqual(mockData);
    });
  });
});
