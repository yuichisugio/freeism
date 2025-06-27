import { beforeEach, describe, expect, test, vi } from "vitest";

import { cachedExportGroupAnalytics } from "./cache-export-group-analytics";
import { exportGroupAnalytics } from "./export-group-analytics";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// cachedExportGroupAnalyticsをモック
vi.mock("./cache-export-group-analytics");

// モック関数の参照を取得
const mockCachedExportGroupAnalytics = vi.mocked(cachedExportGroupAnalytics);

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
    test("should call cachedExportGroupAnalytics with all parameters and return the result", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const page = 2;
      const onlyFixed = true;
      const onlyTaskCompleted = true;
      const expectedResult = {
        data: {
          評価者1: [
            {
              分析ID: "analysis-1",
              タスクID: "task-1",
              貢献ポイント: 100,
              評価ロジック: "自動評価",
              評価者ID: "evaluator-1",
              評価者名: "評価者1",
              タスク内容: "テストタスク",
              参照情報: "https://example.com",
              証拠情報: "証拠情報",
              ステータス: "POINTS_AWARDED",
              貢献タイプ: "REWARD",
              タスク報告者: "報告者1",
              タスク実行者: "実行者1",
              タスク作成者: "作成者1",
              グループ目標: "テスト目標",
              評価方法: "自動評価",
              作成日: "2024-01-15",
              評価日: "2024-01-16",
            },
          ],
        },
        totalPages: 5,
        currentPage: 2,
      };

      // モックの設定
      mockCachedExportGroupAnalytics.mockResolvedValue(expectedResult);

      // 関数実行
      const result = await exportGroupAnalytics(groupId, page, onlyFixed, onlyTaskCompleted);

      // 検証 - cachedExportGroupAnalyticsが正しい引数で呼ばれているか
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledWith(groupId, page, onlyFixed, onlyTaskCompleted);
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledTimes(1);

      // 検証 - 戻り値が正しく返されているか
      expect(result).toStrictEqual(expectedResult);
    });

    test("should call cachedExportGroupAnalytics with default parameters when optional parameters are not provided", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const expectedResult = {
        data: {},
        totalPages: 1,
        currentPage: 1,
      };

      // モックの設定
      mockCachedExportGroupAnalytics.mockResolvedValue(expectedResult);

      // 関数実行（デフォルト引数を使用）
      const result = await exportGroupAnalytics(groupId);

      // 検証 - cachedExportGroupAnalyticsがデフォルト引数で呼ばれているか
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledWith(groupId, 1, false, false);
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledTimes(1);

      // 検証 - 戻り値が正しく返されているか
      expect(result).toStrictEqual(expectedResult);
    });

    test("should call cachedExportGroupAnalytics with partial parameters", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const page = 3;
      const expectedResult = {
        data: {
          未割り当て: [
            {
              分析ID: "analysis-2",
              タスクID: "task-2",
              貢献ポイント: 50,
              評価ロジック: "",
              評価者ID: "",
              評価者名: "未割り当て",
              タスク内容: "テストタスク2",
              参照情報: "",
              証拠情報: "",
              ステータス: "TASK_COMPLETED",
              貢献タイプ: "NON_REWARD",
              タスク報告者: "",
              タスク実行者: "",
              タスク作成者: "作成者2",
              グループ目標: null,
              評価方法: null,
              作成日: "2024-01-17",
            },
          ],
        },
        totalPages: 10,
        currentPage: 3,
      };

      // モックの設定
      mockCachedExportGroupAnalytics.mockResolvedValue(expectedResult);

      // 関数実行（pageのみ指定）
      const result = await exportGroupAnalytics(groupId, page);

      // 検証 - cachedExportGroupAnalyticsが正しい引数で呼ばれているか
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledWith(groupId, page, false, false);
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledTimes(1);

      // 検証 - 戻り値が正しく返されているか
      expect(result).toStrictEqual(expectedResult);
    });

    test("should call cachedExportGroupAnalytics with onlyFixed=true and onlyTaskCompleted=false", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const page = 1;
      const onlyFixed = true;
      const onlyTaskCompleted = false;
      const expectedResult = {
        data: {},
        totalPages: 0,
        currentPage: 1,
      };

      // モックの設定
      mockCachedExportGroupAnalytics.mockResolvedValue(expectedResult);

      // 関数実行
      const result = await exportGroupAnalytics(groupId, page, onlyFixed, onlyTaskCompleted);

      // 検証 - cachedExportGroupAnalyticsが正しい引数で呼ばれているか
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledWith(groupId, page, onlyFixed, onlyTaskCompleted);
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledTimes(1);

      // 検証 - 戻り値が正しく返されているか
      expect(result).toStrictEqual(expectedResult);
    });

    test("should call cachedExportGroupAnalytics with onlyFixed=false and onlyTaskCompleted=true", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const page = 1;
      const onlyFixed = false;
      const onlyTaskCompleted = true;
      const expectedResult = {
        data: {
          評価者A: [
            {
              分析ID: "analysis-3",
              タスクID: "task-3",
              貢献ポイント: 75,
              評価ロジック: "手動評価",
              評価者ID: "evaluator-a",
              評価者名: "評価者A",
              タスク内容: "テストタスク3",
              参照情報: "https://test.com",
              証拠情報: "テスト証拠",
              ステータス: "TASK_COMPLETED",
              貢献タイプ: "REWARD",
              タスク報告者: "報告者A",
              タスク実行者: "実行者A",
              タスク作成者: "作成者A",
              グループ目標: "テスト目標A",
              評価方法: "手動評価",
              作成日: "2024-01-18",
            },
          ],
        },
        totalPages: 3,
        currentPage: 1,
      };

      // モックの設定
      mockCachedExportGroupAnalytics.mockResolvedValue(expectedResult);

      // 関数実行
      const result = await exportGroupAnalytics(groupId, page, onlyFixed, onlyTaskCompleted);

      // 検証 - cachedExportGroupAnalyticsが正しい引数で呼ばれているか
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledWith(groupId, page, onlyFixed, onlyTaskCompleted);
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledTimes(1);

      // 検証 - 戻り値が正しく返されているか
      expect(result).toStrictEqual(expectedResult);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should throw error when cachedExportGroupAnalytics throws error", async () => {
      // テストデータの準備
      const groupId = "test-group-id";
      const errorMessage = "データベースエラー";

      // モックの設定 - エラーを投げる
      mockCachedExportGroupAnalytics.mockRejectedValue(new Error(errorMessage));

      // 関数実行とエラー検証
      await expect(exportGroupAnalytics(groupId)).rejects.toThrow(errorMessage);

      // 検証 - cachedExportGroupAnalyticsが呼ばれているか
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledWith(groupId, 1, false, false);
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledTimes(1);
    });

    test("should preserve error type when cachedExportGroupAnalytics throws custom error", async () => {
      // テストデータの準備
      const groupId = "invalid-group-id";
      const customError = new TypeError("パラメータが不正です");

      // モックの設定 - カスタムエラーを投げる
      mockCachedExportGroupAnalytics.mockRejectedValue(customError);

      // 関数実行とエラー検証
      await expect(exportGroupAnalytics(groupId)).rejects.toThrow(TypeError);
      await expect(exportGroupAnalytics(groupId)).rejects.toThrow("パラメータが不正です");

      // 検証 - cachedExportGroupAnalyticsが呼ばれているか
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledWith(groupId, 1, false, false);
      expect(mockCachedExportGroupAnalytics).toHaveBeenCalledTimes(2);
    });
  });
});
