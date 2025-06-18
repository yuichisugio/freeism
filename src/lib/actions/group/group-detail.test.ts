import type { Group } from "@/types/group-types";
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数のインポート
import { getCachedGroupById } from "@/lib/actions/cache/cache-group-detail";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getGroupById } from "./group-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// getCachedGroupByIdのモック
vi.mock("@/lib/actions/cache/cache-group-detail", () => ({
  getCachedGroupById: vi.fn(),
}));

// モック関数の型定義
const mockGetCachedGroupById = vi.mocked(getCachedGroupById);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getGroupById", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should return group data when valid groupId is provided", async () => {
      // テストデータの準備
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

      // モックの設定
      mockGetCachedGroupById.mockResolvedValue(expectedGroup);

      // 関数実行
      const result = await getGroupById(mockGroupId);

      // 検証
      expect(result).toStrictEqual(expectedGroup);
      expect(mockGetCachedGroupById).toHaveBeenCalledTimes(1);
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(mockGroupId);
    });

    test("should return group data with empty members array when group has no members", async () => {
      // テストデータの準備（メンバーなし）
      const mockGroupId = "test-group-no-members";
      const expectedGroup: Group = {
        id: mockGroupId,
        name: "メンバーなしグループ",
        goal: "メンバーなしテスト",
        evaluationMethod: "手動評価",
        joinMemberCount: 0,
        maxParticipants: 5,
        depositPeriod: 7,
        members: [],
      };

      // モックの設定
      mockGetCachedGroupById.mockResolvedValue(expectedGroup);

      // 関数実行
      const result = await getGroupById(mockGroupId);

      // 検証
      expect(result).toStrictEqual(expectedGroup);
      expect(result.joinMemberCount).toBe(0);
      expect(result.members).toHaveLength(0);
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(mockGroupId);
    });

    test("should return group data with maximum members when group is full", async () => {
      // テストデータの準備（最大メンバー数）
      const mockGroupId = "test-group-full";
      const maxParticipants = 2;
      const expectedGroup: Group = {
        id: mockGroupId,
        name: "満員グループ",
        goal: "満員テスト",
        evaluationMethod: "自動評価",
        joinMemberCount: maxParticipants,
        maxParticipants,
        depositPeriod: 14,
        members: [{ userId: "user-1" }, { userId: "user-2" }],
      };

      // モックの設定
      mockGetCachedGroupById.mockResolvedValue(expectedGroup);

      // 関数実行
      const result = await getGroupById(mockGroupId);

      // 検証
      expect(result.joinMemberCount).toBe(maxParticipants);
      expect(result.maxParticipants).toBe(maxParticipants);
      expect(result.members).toHaveLength(maxParticipants);
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

    test("should handle very long groupId", async () => {
      // テストデータの準備（非常に長いID）
      const longGroupId = "a".repeat(1000);
      const notFoundError = new Error("グループが見つかりません");

      // モックの設定
      mockGetCachedGroupById.mockRejectedValue(notFoundError);

      // 関数実行と検証
      await expect(getGroupById(longGroupId)).rejects.toThrow("グループが見つかりません");

      // getCachedGroupByIdが正しく呼ばれたことを確認
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(longGroupId);
    });

    test("should handle special characters in groupId", async () => {
      // テストデータの準備（特殊文字を含むID）
      const specialCharGroupId = "test-group-!@#$%^&*()_+-=[]{}|;:,.<>?";
      const notFoundError = new Error("グループが見つかりません");

      // モックの設定
      mockGetCachedGroupById.mockRejectedValue(notFoundError);

      // 関数実行と検証
      await expect(getGroupById(specialCharGroupId)).rejects.toThrow("グループが見つかりません");

      // getCachedGroupByIdが正しく呼ばれたことを確認
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(specialCharGroupId);
    });

    test("should handle minimum depositPeriod value", async () => {
      // テストデータの準備（最小値）
      const mockGroupId = "test-group-min-deposit";
      const expectedGroup: Group = {
        id: mockGroupId,
        name: "最小預金期間グループ",
        goal: "最小値テスト",
        evaluationMethod: "自動評価",
        depositPeriod: 1,
        maxParticipants: 1,
        joinMemberCount: 1,
        members: [{ userId: "user-1" }],
      };

      // モックの設定
      mockGetCachedGroupById.mockResolvedValue(expectedGroup);

      // 関数実行
      const result = await getGroupById(mockGroupId);

      // 検証
      expect(result.depositPeriod).toBe(1);
      expect(result.maxParticipants).toBe(1);
      expect(result.joinMemberCount).toBe(1);
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(mockGroupId);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データ変換テスト", () => {
    test("should correctly pass through members array", async () => {
      // テストデータの準備（複数のメンバー）
      const mockGroupId = "test-group-members-mapping";
      const mockMembers = [
        { userId: "user-001" },
        { userId: "user-002" },
        { userId: "user-003" },
        { userId: "user-004" },
        { userId: "user-005" },
      ];

      const expectedGroup: Group = {
        id: mockGroupId,
        name: "メンバーマッピングテストグループ",
        goal: "メンバーマッピングテスト",
        evaluationMethod: "自動評価",
        depositPeriod: 21,
        maxParticipants: 10,
        joinMemberCount: 5,
        members: mockMembers,
      };

      // モックの設定
      mockGetCachedGroupById.mockResolvedValue(expectedGroup);

      // 関数実行
      const result = await getGroupById(mockGroupId);

      // 検証
      expect(result.members).toHaveLength(5);
      expect(result.joinMemberCount).toBe(5);
      expect(result.members).toStrictEqual(mockMembers);

      // 各メンバーの構造を確認
      result.members.forEach((member, index) => {
        expect(member).toHaveProperty("userId");
        expect(member.userId).toBe(`user-00${index + 1}`);
      });

      expect(mockGetCachedGroupById).toHaveBeenCalledWith(mockGroupId);
    });

    test("should correctly pass through joinMemberCount from getCachedGroupById", async () => {
      // テストデータの準備（メンバー数の計算確認）
      const mockGroupId = "test-group-member-count";
      const mockMembers = Array.from({ length: 7 }, (_, i) => ({ userId: `user-${i + 1}` }));

      const expectedGroup: Group = {
        id: mockGroupId,
        name: "メンバー数計算テストグループ",
        goal: "メンバー数計算テスト",
        evaluationMethod: "手動評価",
        depositPeriod: 15,
        maxParticipants: 10,
        joinMemberCount: 7,
        members: mockMembers,
      };

      // モックの設定
      mockGetCachedGroupById.mockResolvedValue(expectedGroup);

      // 関数実行
      const result = await getGroupById(mockGroupId);

      // 検証
      expect(result.joinMemberCount).toBe(7);
      expect(result.members).toHaveLength(7);
      expect(result.joinMemberCount).toBe(result.members.length);
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(mockGroupId);
    });

    test("should return exact same object as received from getCachedGroupById", async () => {
      // テストデータの準備（完全一致テスト）
      const mockGroupId = "test-group-exact-match";
      const expectedGroup: Group = {
        id: mockGroupId,
        name: "完全一致テストグループ",
        goal: "完全一致テスト",
        evaluationMethod: "自動評価",
        depositPeriod: 30,
        maxParticipants: 15,
        joinMemberCount: 3,
        members: [{ userId: "user-alpha" }, { userId: "user-beta" }, { userId: "user-gamma" }],
      };

      // モックの設定
      mockGetCachedGroupById.mockResolvedValue(expectedGroup);

      // 関数実行
      const result = await getGroupById(mockGroupId);

      // 検証（完全一致）
      expect(result).toBe(expectedGroup); // 同じオブジェクト参照であることを確認
      expect(result).toStrictEqual(expectedGroup); // 内容も同じであることを確認
      expect(mockGetCachedGroupById).toHaveBeenCalledWith(mockGroupId);
    });
  });
});
