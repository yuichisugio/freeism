import type { TaskParticipant } from "@/types/group-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedAllUsers } from "./cache-user";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用のユーザー型定義
 */
type MockUser = {
  id: string;
  settings: {
    username: string | null;
  } | null;
};

/**
 * PrismaのfindMany戻り値の型定義
 */
type PrismaUserFindManyResult = Awaited<ReturnType<typeof prismaMock.user.findMany>>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * next/cacheのモック
 */
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * console.errorのモック
 */
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
  // 空の実装
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getCachedAllUsers", () => {
  beforeEach(() => {
    /**
     * 各テスト前にモックをリセット
     */
    consoleErrorSpy.mockClear();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should return all users with username when users exist", async () => {
      /**
       * テストデータの準備
       */
      const mockUsers: MockUser[] = [
        {
          id: "user-1",
          settings: {
            username: "テストユーザー1",
          },
        },
        {
          id: "user-2",
          settings: {
            username: "テストユーザー2",
          },
        },
        {
          id: "user-3",
          settings: {
            username: "テストユーザー3",
          },
        },
      ];

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as PrismaUserFindManyResult);

      /**
       * 期待する結果
       */
      const expectedResult: TaskParticipant[] = [
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
          appUserName: "テストユーザー3",
        },
      ];

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual(expectedResult);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        select: {
          settings: {
            select: {
              username: true,
            },
          },
          id: true,
        },
        orderBy: {
          name: "asc",
        },
      });
      expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should return users with default username when settings.username is null", async () => {
      /**
       * テストデータの準備（usernameがnullの場合）
       */
      const mockUsers: MockUser[] = [
        {
          id: "user-1",
          settings: {
            username: null,
          },
        },
        {
          id: "user-2",
          settings: {
            username: "設定済みユーザー",
          },
        },
      ];

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as PrismaUserFindManyResult);

      /**
       * 期待する結果
       */
      const expectedResult: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: "未設定",
        },
        {
          appUserId: "user-2",
          appUserName: "設定済みユーザー",
        },
      ];

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual(expectedResult);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should return users with default username when settings is null", async () => {
      /**
       * テストデータの準備（settingsがnullの場合）
       */
      const mockUsers: MockUser[] = [
        {
          id: "user-1",
          settings: null,
        },
        {
          id: "user-2",
          settings: {
            username: "設定済みユーザー",
          },
        },
      ];

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as PrismaUserFindManyResult);

      /**
       * 期待する結果
       */
      const expectedResult: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: "未設定",
        },
        {
          appUserId: "user-2",
          appUserName: "設定済みユーザー",
        },
      ];

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual(expectedResult);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should return empty array when no users exist", async () => {
      /**
       * Prismaモックの設定（空の配列を返す）
       */
      prismaMock.user.findMany.mockResolvedValue([] as unknown as PrismaUserFindManyResult);

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual([]);
      expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should handle single user correctly", async () => {
      /**
       * テストデータの準備（単一ユーザー）
       */
      const mockUsers: MockUser[] = [
        {
          id: "single-user",
          settings: {
            username: "単一ユーザー",
          },
        },
      ];

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as PrismaUserFindManyResult);

      /**
       * 期待する結果
       */
      const expectedResult: TaskParticipant[] = [
        {
          appUserId: "single-user",
          appUserName: "単一ユーザー",
        },
      ];

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual(expectedResult);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should handle large number of users correctly", async () => {
      /**
       * テストデータの準備（大量のユーザー）
       */
      const mockUsers: MockUser[] = Array.from({ length: 1000 }, (_, index) => ({
        id: `user-${index + 1}`,
        settings: {
          username: `ユーザー${index + 1}`,
        },
      }));

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as PrismaUserFindManyResult);

      /**
       * 期待する結果
       */
      const expectedResult: TaskParticipant[] = mockUsers.map((user: MockUser) => ({
        appUserId: user.id,
        appUserName: user.settings?.username ?? "未設定",
      }));

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual(expectedResult);
      expect(result).toHaveLength(1000);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should throw error and log when database query fails", async () => {
      /**
       * データベースエラーの準備
       */
      const databaseError = new Error("Database connection failed");

      /**
       * Prismaモックの設定（エラーを投げる）
       */
      prismaMock.user.findMany.mockRejectedValue(databaseError);

      /**
       * 関数の実行とエラーの検証
       */
      await expect(getCachedAllUsers()).rejects.toThrow("Database connection failed");

      /**
       * console.errorが呼ばれたことを確認
       */
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching users:", databaseError);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should throw error when Prisma throws timeout error", async () => {
      /**
       * タイムアウトエラーの準備
       */
      const timeoutError = new Error("Query timeout");

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockRejectedValue(timeoutError);

      /**
       * 関数の実行とエラーの検証
       */
      await expect(getCachedAllUsers()).rejects.toThrow("Query timeout");

      /**
       * console.errorが呼ばれたことを確認
       */
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching users:", timeoutError);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should throw error when Prisma throws network error", async () => {
      /**
       * ネットワークエラーの準備
       */
      const networkError = new Error("Network error");

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockRejectedValue(networkError);

      /**
       * 関数の実行とエラーの検証
       */
      await expect(getCachedAllUsers()).rejects.toThrow("Network error");

      /**
       * console.errorが呼ばれたことを確認
       */
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching users:", networkError);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should throw error when Prisma throws validation error", async () => {
      /**
       * バリデーションエラーの準備
       */
      const validationError = new Error("Invalid query parameters");

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockRejectedValue(validationError);

      /**
       * 関数の実行とエラーの検証
       */
      await expect(getCachedAllUsers()).rejects.toThrow("Invalid query parameters");

      /**
       * console.errorが呼ばれたことを確認
       */
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching users:", validationError);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle user with empty string username", async () => {
      /**
       * テストデータの準備（空文字のusername）
       */
      const mockUsers: MockUser[] = [
        {
          id: "user-1",
          settings: {
            username: "",
          },
        },
      ];

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as PrismaUserFindManyResult);

      /**
       * 期待する結果（空文字はそのまま空文字として返される）
       */
      const expectedResult: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: "",
        },
      ];

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual(expectedResult);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should handle user with very long username", async () => {
      /**
       * テストデータの準備（非常に長いusername）
       */
      const longUsername = "a".repeat(1000);
      const mockUsers: MockUser[] = [
        {
          id: "user-1",
          settings: {
            username: longUsername,
          },
        },
      ];

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as PrismaUserFindManyResult);

      /**
       * 期待する結果
       */
      const expectedResult: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: longUsername,
        },
      ];

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual(expectedResult);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should handle user with special characters in username", async () => {
      /**
       * テストデータの準備（特殊文字を含むusername）
       */
      const specialUsername = "テスト@#$%^&*()_+-=[]{}|;':\",./<>?`~";
      const mockUsers: MockUser[] = [
        {
          id: "user-1",
          settings: {
            username: specialUsername,
          },
        },
      ];

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as PrismaUserFindManyResult);

      /**
       * 期待する結果
       */
      const expectedResult: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: specialUsername,
        },
      ];

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual(expectedResult);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test("should handle user with unicode characters in username", async () => {
      /**
       * テストデータの準備（Unicode文字を含むusername）
       */
      const unicodeUsername = "🚀👨‍💻🌟テスト用户名用戶名";
      const mockUsers: MockUser[] = [
        {
          id: "user-1",
          settings: {
            username: unicodeUsername,
          },
        },
      ];

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as PrismaUserFindManyResult);

      /**
       * 期待する結果
       */
      const expectedResult: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: unicodeUsername,
        },
      ];

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual(expectedResult);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データ型テスト", () => {
    test("should handle mixed data types correctly", async () => {
      /**
       * テストデータの準備（様々なパターンの混在）
       */
      const mockUsers: MockUser[] = [
        {
          id: "user-1",
          settings: {
            username: "正常なユーザー",
          },
        },
        {
          id: "user-2",
          settings: null,
        },
        {
          id: "user-3",
          settings: {
            username: null,
          },
        },
        {
          id: "user-4",
          settings: {
            username: "",
          },
        },
        {
          id: "user-5",
          settings: {
            username: "もう一人の正常なユーザー",
          },
        },
      ];

      /**
       * Prismaモックの設定
       */
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as PrismaUserFindManyResult);

      /**
       * 期待する結果
       */
      const expectedResult: TaskParticipant[] = [
        {
          appUserId: "user-1",
          appUserName: "正常なユーザー",
        },
        {
          appUserId: "user-2",
          appUserName: "未設定",
        },
        {
          appUserId: "user-3",
          appUserName: "未設定",
        },
        {
          appUserId: "user-4",
          appUserName: "",
        },
        {
          appUserId: "user-5",
          appUserName: "もう一人の正常なユーザー",
        },
      ];

      /**
       * 関数の実行
       */
      const result = await getCachedAllUsers();

      /**
       * 結果の検証
       */
      expect(result).toStrictEqual(expectedResult);
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
