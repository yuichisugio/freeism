import type { TaskParticipant } from "@/types/group-types";
import { getAllUsers } from "@/actions/user/user";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// getCachedAllUsersをモック化
vi.mock("@/actions/user/cache-user", () => ({
  getCachedAllUsers: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの定義
 */
const mockUsers: TaskParticipant[] = [
  {
    appUserId: "user-1",
    appUserName: "テストユーザー1",
  },
  {
    appUserId: "user-2",
    appUserName: "テストユーザー2",
  },
  {
    appUserId: "user-3",
    appUserName: "未設定",
  },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getAllUsers", () => {
  let mockGetCachedAllUsers: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    // モック関数の取得
    const { getCachedAllUsers } = await import("@/actions/user/cache-user");
    mockGetCachedAllUsers = vi.mocked(getCachedAllUsers);
  });

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should return all users when getCachedAllUsers returns valid data", async () => {
      // Arrange
      mockGetCachedAllUsers.mockResolvedValue({
        success: true,
        message: "ユーザー一覧を取得しました",
        data: mockUsers,
      });

      // Act
      const result = await getAllUsers();

      // Assert
      expect(mockGetCachedAllUsers).toHaveBeenCalledTimes(1);
      expect(result.data).toStrictEqual(mockUsers);
      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toStrictEqual({
        appUserId: "user-1",
        appUserName: "テストユーザー1",
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should return empty array when getCachedAllUsers returns empty array", async () => {
      // Arrange
      mockGetCachedAllUsers.mockResolvedValue({
        success: true,
        message: "ユーザー一覧を取得しました",
        data: [],
      });

      // Act
      const result = await getAllUsers();

      // Assert
      expect(mockGetCachedAllUsers).toHaveBeenCalledTimes(1);
      expect(result.data).toStrictEqual([]);
    });

    test("should throw error when getCachedAllUsers throws an error", async () => {
      // Arrange
      mockGetCachedAllUsers.mockRejectedValue(new Error("テストエラー"));

      // Act & Assert
      await expect(getAllUsers()).rejects.toThrow("テストエラー");
      expect(mockGetCachedAllUsers).toHaveBeenCalledTimes(1);
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
