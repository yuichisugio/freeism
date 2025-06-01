import type { TaskParticipant } from "@/types/group-types";
import { getAllUsers } from "@/lib/actions/user";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// getCachedAllUsersをモック化
vi.mock("@/lib/actions/cache/cache-user", () => ({
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

const emptyUsers: TaskParticipant[] = [];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getAllUsers", () => {
  let mockGetCachedAllUsers: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    // モック関数の取得
    const { getCachedAllUsers } = await import("@/lib/actions/cache/cache-user");
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
      // モックの戻り値を設定
      mockGetCachedAllUsers.mockResolvedValue(mockUsers);

      // 関数を実行
      const result = await getAllUsers();

      // 検証
      expect(mockGetCachedAllUsers).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(mockUsers);
      expect(result).toHaveLength(3);
      expect(result[0]).toStrictEqual({
        appUserId: "user-1",
        appUserName: "テストユーザー1",
      });
    });

    test("should return empty array when no users exist", async () => {
      // モックの戻り値を空配列に設定
      mockGetCachedAllUsers.mockResolvedValue(emptyUsers);

      // 関数を実行
      const result = await getAllUsers();

      // 検証
      expect(mockGetCachedAllUsers).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual([]);
      expect(result).toHaveLength(0);
    });

    test("should handle users with null appUserName", async () => {
      // nullのappUserNameを含むテストデータ
      const usersWithNull: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: null,
        },
        {
          appUserId: "user-2",
          appUserName: "テストユーザー2",
        },
      ];

      mockGetCachedAllUsers.mockResolvedValue(usersWithNull);

      // 関数を実行
      const result = await getAllUsers();

      // 検証
      expect(result).toStrictEqual(usersWithNull);
      expect(result[0].appUserName).toBeNull();
      expect(result[1].appUserName).toBe("テストユーザー2");
    });

    test("should handle users with null appUserId", async () => {
      // nullのappUserIdを含むテストデータ
      const usersWithNullId: TaskParticipant[] = [
        {
          appUserId: null,
          appUserName: "テストユーザー1",
        },
        {
          appUserId: "user-2",
          appUserName: "テストユーザー2",
        },
      ];

      mockGetCachedAllUsers.mockResolvedValue(usersWithNullId);

      // 関数を実行
      const result = await getAllUsers();

      // 検証
      expect(result).toStrictEqual(usersWithNullId);
      expect(result[0].appUserId).toBeNull();
      expect(result[1].appUserId).toBe("user-2");
    });

    test("should handle large number of users", async () => {
      // 大量のユーザーデータを生成
      const largeUserList: TaskParticipant[] = Array.from({ length: 1000 }, (_, index) => ({
        appUserId: `user-${index + 1}`,
        appUserName: `テストユーザー${index + 1}`,
      }));

      mockGetCachedAllUsers.mockResolvedValue(largeUserList);

      // 関数を実行
      const result = await getAllUsers();

      // 検証
      expect(result).toHaveLength(1000);
      expect(result[0]).toStrictEqual({
        appUserId: "user-1",
        appUserName: "テストユーザー1",
      });
      expect(result[999]).toStrictEqual({
        appUserId: "user-1000",
        appUserName: "テストユーザー1000",
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should throw error when getCachedAllUsers throws error", async () => {
      // エラーを投げるようにモックを設定
      const mockError = new Error("Database connection failed");
      mockGetCachedAllUsers.mockRejectedValue(mockError);

      // 関数実行時にエラーが投げられることを検証
      await expect(getAllUsers()).rejects.toThrow("Database connection failed");
      expect(mockGetCachedAllUsers).toHaveBeenCalledTimes(1);
    });

    test("should throw error when getCachedAllUsers throws generic error", async () => {
      // 一般的なエラーを投げるようにモックを設定
      const genericError = new Error("Something went wrong");
      mockGetCachedAllUsers.mockRejectedValue(genericError);

      // 関数実行時にエラーが投げられることを検証
      await expect(getAllUsers()).rejects.toThrow("Something went wrong");
      expect(mockGetCachedAllUsers).toHaveBeenCalledTimes(1);
    });

    test("should throw error when getCachedAllUsers throws network error", async () => {
      // ネットワークエラーを投げるようにモックを設定
      const networkError = new Error("Network timeout");
      mockGetCachedAllUsers.mockRejectedValue(networkError);

      // 関数実行時にエラーが投げられることを検証
      await expect(getAllUsers()).rejects.toThrow("Network timeout");
      expect(mockGetCachedAllUsers).toHaveBeenCalledTimes(1);
    });

    test("should handle undefined return value from getCachedAllUsers", async () => {
      // undefinedを返すようにモックを設定
      mockGetCachedAllUsers.mockResolvedValue(undefined as unknown as TaskParticipant[]);

      // 関数を実行
      const result = await getAllUsers();

      // 検証（undefinedがそのまま返される）
      expect(result).toBeUndefined();
      expect(mockGetCachedAllUsers).toHaveBeenCalledTimes(1);
    });

    test("should handle null return value from getCachedAllUsers", async () => {
      // nullを返すようにモックを設定
      mockGetCachedAllUsers.mockResolvedValue(null as unknown as TaskParticipant[]);

      // 関数を実行
      const result = await getAllUsers();

      // 検証（nullがそのまま返される）
      expect(result).toBeNull();
      expect(mockGetCachedAllUsers).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    test("should handle single user", async () => {
      // 1人のユーザーのみのテストデータ
      const singleUser: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: "単一ユーザー",
        },
      ];

      mockGetCachedAllUsers.mockResolvedValue(singleUser);

      // 関数を実行
      const result = await getAllUsers();

      // 検証
      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        appUserId: "user-1",
        appUserName: "単一ユーザー",
      });
    });

    test("should handle users with empty string values", async () => {
      // 空文字列を含むテストデータ
      const usersWithEmptyStrings: TaskParticipant[] = [
        {
          appUserId: "",
          appUserName: "",
        },
        {
          appUserId: "user-2",
          appUserName: "正常ユーザー",
        },
      ];

      mockGetCachedAllUsers.mockResolvedValue(usersWithEmptyStrings);

      // 関数を実行
      const result = await getAllUsers();

      // 検証
      expect(result).toStrictEqual(usersWithEmptyStrings);
      expect(result[0].appUserId).toBe("");
      expect(result[0].appUserName).toBe("");
    });

    test("should handle users with very long names", async () => {
      // 非常に長い名前を持つユーザー
      const longName = "a".repeat(1000);
      const usersWithLongNames: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: longName,
        },
      ];

      mockGetCachedAllUsers.mockResolvedValue(usersWithLongNames);

      // 関数を実行
      const result = await getAllUsers();

      // 検証
      expect(result[0].appUserName).toBe(longName);
      expect(result[0].appUserName?.length).toBe(1000);
    });

    test("should handle users with special characters in names", async () => {
      // 特殊文字を含むユーザー名
      const usersWithSpecialChars: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: "テスト@#$%^&*()ユーザー",
        },
        {
          appUserId: "user-2",
          appUserName: "🎉🎊絵文字ユーザー🚀",
        },
      ];

      mockGetCachedAllUsers.mockResolvedValue(usersWithSpecialChars);

      // 関数を実行
      const result = await getAllUsers();

      // 検証
      expect(result).toStrictEqual(usersWithSpecialChars);
      expect(result[0].appUserName).toBe("テスト@#$%^&*()ユーザー");
      expect(result[1].appUserName).toBe("🎉🎊絵文字ユーザー🚀");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 型安全性テスト
   */
  describe("型安全性テスト", () => {
    test("should return correct type structure", async () => {
      mockGetCachedAllUsers.mockResolvedValue(mockUsers);

      // 関数を実行
      const result = await getAllUsers();

      // 型構造の検証
      expect(result).toBeInstanceOf(Array);
      result.forEach((user) => {
        expect(user).toHaveProperty("appUserId");
        expect(user).toHaveProperty("appUserName");
        expect(typeof user.appUserId === "string" || user.appUserId === null).toBe(true);
        expect(typeof user.appUserName === "string" || user.appUserName === null).toBe(true);
      });
    });

    test("should maintain TaskParticipant interface compliance", async () => {
      mockGetCachedAllUsers.mockResolvedValue(mockUsers);

      // 関数を実行
      const result = await getAllUsers();

      // TaskParticipant型の要件を満たしているかチェック
      result.forEach((user: TaskParticipant) => {
        // TypeScriptの型チェックが通ることを確認
        const userId: string | null = user.appUserId;
        const userName: string | null = user.appUserName;

        // 実際の値の検証
        expect(userId === null || typeof userId === "string").toBe(true);
        expect(userName === null || typeof userName === "string").toBe(true);
      });
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
