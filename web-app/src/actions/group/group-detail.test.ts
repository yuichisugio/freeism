import type { Group } from "@/types/group-types";
import { getCachedGroupById } from "@/actions/group/cache-group-detail";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getGroupById } from "./group-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モックと型定義
 */
vi.mock("@/actions/group/cache-group-detail", () => ({
  getCachedGroupById: vi.fn(),
}));
const mockGetCachedGroupById = vi.mocked(getCachedGroupById);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getGroupById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should return group data when valid groupId is provided", async () => {
      // Arrange
      const mockGroupId = "test-group-id";
      const expectedGroup: Group = {
        id: mockGroupId,
        name: "テストグループ",
        goal: "テスト目標",
        evaluationMethod: "自動評価",
        joinMemberCount: 3,
        maxParticipants: 10,
        depositPeriod: 30,
        members: [{ userId: "user-1" }, { userId: "user-2" }, { userId: "user-3" }],
      };

      const expectedResponse = {
        success: true,
        message: "グループ情報を取得しました",
        data: expectedGroup,
      };

      // Act
      mockGetCachedGroupById.mockResolvedValue(expectedResponse);

      const result = await getGroupById(mockGroupId);

      // Assert
      expect(result).toStrictEqual(expectedResponse);
      expect(mockGetCachedGroupById).toHaveBeenCalledTimes(1);
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(mockGroupId);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should throw error when group is not found", async () => {
      // テストデータの準備
      const nonExistentGroupId = "non-existent-group-id";
      const notFoundError = new Error("グループが見つかりません");

      // モックの設定（グループが見つからない場合）
      mockGetCachedGroupById.mockRejectedValue(notFoundError);

      // 関数実行と検証
      await expect(getGroupById(nonExistentGroupId)).rejects.toThrow("グループが見つかりません");

      // getCachedGroupByIdが正しく呼ばれたことを確認
      expect(mockGetCachedGroupById).toHaveBeenCalledTimes(1);
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(nonExistentGroupId);
    });

    test("should throw error when database error occurs", async () => {
      // テストデータの準備
      const mockGroupId = "test-group-db-error";
      const dbError = new Error("Database connection failed");

      // モックの設定（データベースエラー）
      mockGetCachedGroupById.mockRejectedValue(dbError);

      // 関数実行と検証
      await expect(getGroupById(mockGroupId)).rejects.toThrow("Database connection failed");

      // getCachedGroupByIdが正しく呼ばれたことを確認
      expect(mockGetCachedGroupById).toHaveBeenCalledTimes(1);
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(mockGroupId);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty string groupId", async () => {
      // テストデータの準備
      const emptyGroupId = "";
      const notFoundError = new Error("グループが見つかりません");

      // モックの設定
      mockGetCachedGroupById.mockRejectedValue(notFoundError);

      // 関数実行と検証
      await expect(getGroupById(emptyGroupId)).rejects.toThrow("グループが見つかりません");

      // getCachedGroupByIdが正しく呼ばれたことを確認
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(emptyGroupId);
    });
  });
});
