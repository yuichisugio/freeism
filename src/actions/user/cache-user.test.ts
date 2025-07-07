import type { TaskParticipant } from "@/types/group-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedAllUsers } from "./cache-user";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * next/cacheのモック
 */
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Prismaレスポンス用の型定義
 */
type PrismaUserResponse = {
  id: string;
  settings: {
    username: string | null;
  } | null;
};

/**
 * ヘルパー関数: Prismaレスポンス形式のモックユーザーを作成
 */
const createMockPrismaUser = (id: string, username: string | null): PrismaUserResponse => ({
  id,
  settings: username === "NO_SETTINGS" ? null : { username: username === "NULL" ? null : username },
});

/**
 * ヘルパー関数: 期待値を作成
 */
const createExpectedResult = (users: { id: string; username: string | null }[]): TaskParticipant[] =>
  users.map((user) => ({
    appUserId: user.id,
    appUserName: user.username ?? `未設定_${user.id}`,
  }));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-user.ts_getCachedAllUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should return all users with username when users exist", async () => {
      // Arrange
      const mockUsers = [
        createMockPrismaUser("user-1", "テストユーザー1"),
        createMockPrismaUser("user-2", "テストユーザー2"),
        createMockPrismaUser("user-3", "テストユーザー3"),
      ];
      const expectedResult = createExpectedResult([
        { id: "user-1", username: "テストユーザー1" },
        { id: "user-2", username: "テストユーザー2" },
        { id: "user-3", username: "テストユーザー3" },
      ]);
      prismaMock.user.findMany.mockResolvedValue(
        mockUsers as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>,
      );

      // Act
      const result = await getCachedAllUsers();

      // Assert
      expect(result.data).toStrictEqual(expectedResult);
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

    test("should return empty array when no users exist", async () => {
      // Arrange
      prismaMock.user.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

      // Act
      const result = await getCachedAllUsers();

      // Assert
      expect(result.data).toStrictEqual([]);
      expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test.each([
      {
        description: "single user",
        users: [{ id: "single-user", username: "単一ユーザー" }],
      },
      {
        description: "large number of users",
        users: Array.from({ length: 100 }, (_, index) => ({
          id: `user-${index + 1}`,
          username: `ユーザー${index + 1}`,
        })),
      },
    ])("should handle $description correctly", async ({ users }) => {
      // Arrange
      const mockUsers = users.map((user) => createMockPrismaUser(user.id, user.username));
      const expectedResult = createExpectedResult(users);
      prismaMock.user.findMany.mockResolvedValue(
        mockUsers as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>,
      );

      // Act
      const result = await getCachedAllUsers();

      // Assert
      expect(result.data).toStrictEqual(expectedResult);
      expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    test.each([
      {
        description: "settings.username is null",
        users: [
          { id: "user-1", username: "NULL" },
          { id: "user-2", username: "設定済みユーザー" },
        ],
      },
      {
        description: "settings is null",
        users: [
          { id: "user-1", username: "NO_SETTINGS" },
          { id: "user-2", username: "設定済みユーザー" },
        ],
      },
      {
        description: "mixed data types",
        users: [
          { id: "user-1", username: "正常なユーザー" },
          { id: "user-2", username: "NO_SETTINGS" },
          { id: "user-3", username: "NULL" },
          { id: "user-4", username: "" },
          { id: "user-5", username: "もう一人の正常なユーザー" },
          { id: "user-6", username: null },
          { id: "user-7", username: undefined },
        ],
      },
    ])("should return users with default username when $description", async ({ users }) => {
      // Arrange
      const mockUsers = users.map((user) => createMockPrismaUser(user.id, user.username ?? null));
      const expectedResult = createExpectedResult(
        users.map((user) => {
          let finalUsername: string | null;
          if (user.username === "NO_SETTINGS") {
            finalUsername = null; // settings が null の場合
          } else if (user.username === "NULL") {
            finalUsername = null; // settings.username が null の場合
          } else if (user.username === null || user.username === undefined) {
            finalUsername = null; // username が null または undefined の場合
          } else {
            finalUsername = user.username;
          }
          return {
            id: user.id,
            username: finalUsername,
          };
        }),
      );
      prismaMock.user.findMany.mockResolvedValue(
        mockUsers as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>,
      );

      // Act
      const result = await getCachedAllUsers();

      // Assert
      expect(result.data).toStrictEqual(expectedResult);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test.each([
      {
        errorType: "database connection",
        error: new Error("Database connection failed"),
      },
      {
        errorType: "timeout",
        error: new Error("Query timeout"),
      },
      {
        errorType: "network",
        error: new Error("Network error"),
      },
      {
        errorType: "validation",
        error: new Error("Invalid query parameters"),
      },
    ])("should throw error and log when $errorType error occurs", async ({ error }) => {
      // Arrange
      prismaMock.user.findMany.mockRejectedValue(error);

      // Act & Assert
      await expect(getCachedAllUsers()).rejects.toThrow(error.message);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test.each([
      {
        description: "empty string username",
        username: "",
      },
      {
        description: "very long username",
        username: "a".repeat(1000),
      },
      {
        description: "special characters in username",
        username: "テスト@#$%^&*()_+-=[]{}|;':\",./<>?`~",
      },
      {
        description: "unicode characters in username",
        username: "🚀👨‍💻🌟テスト用户名用戶名",
      },
    ])("should handle user with $description", async ({ username }) => {
      // Arrange
      const mockUsers = [createMockPrismaUser("user-1", username)];
      const expectedResult = createExpectedResult([{ id: "user-1", username }]);

      prismaMock.user.findMany.mockResolvedValue(
        mockUsers as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>,
      );

      // Act
      const result = await getCachedAllUsers();

      // Assert
      expect(result.data).toStrictEqual(expectedResult);
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
