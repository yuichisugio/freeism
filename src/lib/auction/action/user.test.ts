import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory, userFactory, userSettingsFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserGroups, getUserSettings } from "./user";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの準備
 */
const testUser = userFactory.build({ id: "test-user-1" });
const testGroup1 = groupFactory.build({ id: "test-group-1", name: "テストグループ1" });
const testGroup2 = groupFactory.build({ id: "test-group-2", name: "テストグループ2" });
const testUserSettings = userSettingsFactory.build({
  id: "test-settings-1",
  userId: testUser.id,
  username: "testuser",
  lifeGoal: "テスト目標",
  isEmailEnabled: true,
  isPushEnabled: false,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("user.ts", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserGroups", () => {
    describe("正常系", () => {
      test("should return user groups when user has multiple groups", async () => {
        // Arrange
        const expectedGroups = [
          {
            group: { id: testGroup1.id, name: testGroup1.name },
          },
          {
            group: { id: testGroup2.id, name: testGroup2.name },
          },
        ];

        prismaMock.groupMembership.findMany.mockResolvedValue(
          expectedGroups as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getUserGroups();

        // Assert
        expect(result).toStrictEqual(expectedGroups);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId: testUser.id },
          select: {
            group: { select: { id: true, name: true } },
          },
        });
      });

      test("should return empty array when user has no groups", async () => {
        // Arrange
        prismaMock.groupMembership.findMany.mockResolvedValue([]);

        // Act
        const result = await getUserGroups();

        // Assert
        expect(result).toStrictEqual([]);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId: testUser.id },
          select: {
            group: { select: { id: true, name: true } },
          },
        });
      });

      test("should return single group when user has one group", async () => {
        // Arrange
        const expectedGroups = [
          {
            group: { id: testGroup1.id, name: testGroup1.name },
          },
        ];

        prismaMock.groupMembership.findMany.mockResolvedValue(
          expectedGroups as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getUserGroups();

        // Assert
        expect(result).toStrictEqual(expectedGroups);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      });
    });

    describe("異常系", () => {
      test("should throw error when getAuthenticatedSessionUserId fails", async () => {
        // Arrange
        const errorMessage = "認証エラー";
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error(errorMessage));

        // Act & Assert
        await expect(getUserGroups()).rejects.toThrow(errorMessage);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.groupMembership.findMany).not.toHaveBeenCalled();
      });

      test("should throw error when prisma query fails", async () => {
        // Arrange
        const errorMessage = "データベースエラー";
        prismaMock.groupMembership.findMany.mockRejectedValue(new Error(errorMessage));

        // Act & Assert
        await expect(getUserGroups()).rejects.toThrow(errorMessage);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId: testUser.id },
          select: {
            group: { select: { id: true, name: true } },
          },
        });
      });

      test("should handle null userId from authentication", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(null as unknown as string);
        prismaMock.groupMembership.findMany.mockResolvedValue([]);

        // Act
        const result = await getUserGroups();

        // Assert
        expect(result).toStrictEqual([]);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId: null },
          select: {
            group: { select: { id: true, name: true } },
          },
        });
      });

      test("should handle undefined userId from authentication", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(undefined as unknown as string);
        prismaMock.groupMembership.findMany.mockResolvedValue([]);

        // Act
        const result = await getUserGroups();

        // Assert
        expect(result).toStrictEqual([]);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId: undefined },
          select: {
            group: { select: { id: true, name: true } },
          },
        });
      });

      test("should handle empty string userId from authentication", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue("");
        prismaMock.groupMembership.findMany.mockResolvedValue([]);

        // Act
        const result = await getUserGroups();

        // Assert
        expect(result).toStrictEqual([]);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId: "" },
          select: {
            group: { select: { id: true, name: true } },
          },
        });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserSettings", () => {
    describe("正常系", () => {
      test("should return user settings when settings exist", async () => {
        // Arrange
        prismaMock.userSettings.findUnique.mockResolvedValue(testUserSettings);

        // Act
        const result = await getUserSettings(testUser.id);

        // Assert
        expect(result).toStrictEqual(testUserSettings);
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: testUser.id },
        });
      });

      test("should return null when user settings do not exist", async () => {
        // Arrange
        prismaMock.userSettings.findUnique.mockResolvedValue(null);

        // Act
        const result = await getUserSettings(testUser.id);

        // Assert
        expect(result).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: testUser.id },
        });
      });

      test("should handle different userId formats", async () => {
        // Arrange
        const uuidUserId = "550e8400-e29b-41d4-a716-446655440000";
        const expectedSettings = userSettingsFactory.build({ userId: uuidUserId });
        prismaMock.userSettings.findUnique.mockResolvedValue(expectedSettings);

        // Act
        const result = await getUserSettings(uuidUserId);

        // Assert
        expect(result).toStrictEqual(expectedSettings);
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: uuidUserId },
        });
      });

      test("should handle user settings with all fields populated", async () => {
        // Arrange
        const fullUserSettings = userSettingsFactory.build({
          userId: testUser.id,
          username: "fulluser",
          lifeGoal: "完全な人生目標",
          isEmailEnabled: true,
          isPushEnabled: true,
        });
        prismaMock.userSettings.findUnique.mockResolvedValue(fullUserSettings);

        // Act
        const result = await getUserSettings(testUser.id);

        // Assert
        expect(result).toStrictEqual(fullUserSettings);
        expect(result?.username).toBe("fulluser");
        expect(result?.lifeGoal).toBe("完全な人生目標");
        expect(result?.isEmailEnabled).toBe(true);
        expect(result?.isPushEnabled).toBe(true);
      });

      test("should handle user settings with minimal fields", async () => {
        // Arrange
        const minimalUserSettings = userSettingsFactory.build({
          userId: testUser.id,
          username: undefined,
          lifeGoal: undefined,
          isEmailEnabled: false,
          isPushEnabled: false,
        });
        prismaMock.userSettings.findUnique.mockResolvedValue(minimalUserSettings);

        // Act
        const result = await getUserSettings(testUser.id);

        // Assert
        expect(result).toStrictEqual(minimalUserSettings);
        expect(result?.username).toBeUndefined();
        expect(result?.lifeGoal).toBeUndefined();
        expect(result?.isEmailEnabled).toBe(false);
        expect(result?.isPushEnabled).toBe(false);
      });
    });

    describe("異常系", () => {
      test("should throw error when prisma query fails", async () => {
        // Arrange
        const errorMessage = "データベース接続エラー";
        prismaMock.userSettings.findUnique.mockRejectedValue(new Error(errorMessage));

        // Act & Assert
        await expect(getUserSettings(testUser.id)).rejects.toThrow(errorMessage);
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: testUser.id },
        });
      });

      test("should handle null userId parameter", async () => {
        // Arrange
        prismaMock.userSettings.findUnique.mockResolvedValue(null);

        // Act
        const result = await getUserSettings(null as unknown as string);

        // Assert
        expect(result).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: null },
        });
      });

      test("should handle undefined userId parameter", async () => {
        // Arrange
        prismaMock.userSettings.findUnique.mockResolvedValue(null);

        // Act
        const result = await getUserSettings(undefined as unknown as string);

        // Assert
        expect(result).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: undefined },
        });
      });

      test("should handle empty string userId parameter", async () => {
        // Arrange
        prismaMock.userSettings.findUnique.mockResolvedValue(null);

        // Act
        const result = await getUserSettings("");

        // Assert
        expect(result).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: "" },
        });
      });

      test("should handle very long userId parameter", async () => {
        // Arrange
        const longUserId = "a".repeat(1000);
        prismaMock.userSettings.findUnique.mockResolvedValue(null);

        // Act
        const result = await getUserSettings(longUserId);

        // Assert
        expect(result).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: longUserId },
        });
      });

      test("should handle special characters in userId parameter", async () => {
        // Arrange
        const specialUserId = "user-123!@#$%^&*()";
        prismaMock.userSettings.findUnique.mockResolvedValue(null);

        // Act
        const result = await getUserSettings(specialUserId);

        // Assert
        expect(result).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: specialUserId },
        });
      });
    });

    describe("境界値テスト", () => {
      test("should handle userId with maximum typical length", async () => {
        // Arrange
        const maxLengthUserId = "user-" + "a".repeat(250); // 一般的な最大長
        prismaMock.userSettings.findUnique.mockResolvedValue(null);

        // Act
        const result = await getUserSettings(maxLengthUserId);

        // Assert
        expect(result).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: maxLengthUserId },
        });
      });

      test("should handle userId with single character", async () => {
        // Arrange
        const singleCharUserId = "a";
        prismaMock.userSettings.findUnique.mockResolvedValue(null);

        // Act
        const result = await getUserSettings(singleCharUserId);

        // Assert
        expect(result).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: singleCharUserId },
        });
      });

      test("should handle userId with only numbers", async () => {
        // Arrange
        const numericUserId = "123456789";
        prismaMock.userSettings.findUnique.mockResolvedValue(null);

        // Act
        const result = await getUserSettings(numericUserId);

        // Assert
        expect(result).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: numericUserId },
        });
      });

      test("should handle userId with Unicode characters", async () => {
        // Arrange
        const unicodeUserId = "ユーザー-123-テスト";
        prismaMock.userSettings.findUnique.mockResolvedValue(null);

        // Act
        const result = await getUserSettings(unicodeUserId);

        // Assert
        expect(result).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: unicodeUserId },
        });
      });
    });
  });
});
