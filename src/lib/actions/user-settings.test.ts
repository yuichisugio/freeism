import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { userFactory, userSettingsFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserSettings, updateUserSettingToggle, updateUserSetup } from "./user-settings";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック設定
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テストデータ・ヘルパー関数
const mockUserId = "test-user-id";
const mockUserSettings = userSettingsFactory.build({
  id: "test-settings-id",
  userId: mockUserId,
  username: "testuser",
  lifeGoal: "テスト目標",
  isEmailEnabled: true,
  isPushEnabled: false,
});

const mockSetupFormData = {
  username: "新しいユーザー名",
  lifeGoal: "新しい人生の目標",
};

const testUser = userFactory.build({ id: "test-user-1" });
const testUserSettings = userSettingsFactory.build({
  id: "test-settings-1",
  userId: testUser.id,
  username: "testuser",
  lifeGoal: "テスト目標",
  isEmailEnabled: true,
  isPushEnabled: false,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
describe("user-settings.test.ts", () => {
  describe("updateUserSettingToggle", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    // 正常系テスト
    describe("正常系", () => {
      test("should update email notification setting successfully", async () => {
        // モックの設定
        const updatedSettings = { ...mockUserSettings, isEmailEnabled: false };
        prismaMock.userSettings.update.mockResolvedValue(updatedSettings);

        // 関数の実行
        const result = await updateUserSettingToggle(mockUserId, false, "isEmailEnabled");

        // 検証
        expect(prismaMock.userSettings.update).toHaveBeenCalledWith({
          where: { userId: mockUserId },
          data: { isEmailEnabled: false },
        });

        expect(result).toStrictEqual({
          success: true,
          data: {
            id: updatedSettings.id,
            userId: updatedSettings.userId,
            isEmailEnabled: false,
          },
        });
      });

      test("should update push notification setting successfully", async () => {
        // モックの設定
        const updatedSettings = { ...mockUserSettings, isPushEnabled: true };
        prismaMock.userSettings.update.mockResolvedValue(updatedSettings);

        // 関数の実行
        const result = await updateUserSettingToggle(mockUserId, true, "isPushEnabled");

        // 検証
        expect(prismaMock.userSettings.update).toHaveBeenCalledWith({
          where: { userId: mockUserId },
          data: { isPushEnabled: true },
        });

        expect(result).toStrictEqual({
          success: true,
          data: {
            id: updatedSettings.id,
            userId: updatedSettings.userId,
            isPushEnabled: true,
          },
        });
      });

      test("should handle enabling notification settings", async () => {
        // モックの設定
        const updatedSettings = { ...mockUserSettings, isEmailEnabled: true };
        prismaMock.userSettings.update.mockResolvedValue(updatedSettings);

        // 関数の実行
        const result = await updateUserSettingToggle(mockUserId, true, "isEmailEnabled");

        // 検証
        expect(result.success).toBe(true);
        expect(result.data?.isEmailEnabled).toBe(true);
      });

      test("should handle disabling notification settings", async () => {
        // モックの設定
        const updatedSettings = { ...mockUserSettings, isPushEnabled: false };
        prismaMock.userSettings.update.mockResolvedValue(updatedSettings);

        // 関数の実行
        const result = await updateUserSettingToggle(mockUserId, false, "isPushEnabled");

        // 検証
        expect(result.success).toBe(true);
        expect(result.data?.isPushEnabled).toBe(false);
      });
    });

    // 異常系テスト
    describe("異常系", () => {
      test("should handle database error", async () => {
        // モックの設定
        const errorMessage = "Database connection failed";
        prismaMock.userSettings.update.mockRejectedValue(new Error(errorMessage));

        // 関数の実行
        const result = await updateUserSettingToggle(mockUserId, true, "isEmailEnabled");

        // 検証
        expect(result).toStrictEqual({
          success: false,
          error: errorMessage,
        });
      });

      test("should handle unknown error", async () => {
        // モックの設定
        prismaMock.userSettings.update.mockRejectedValue("Unknown error");

        // 関数の実行
        const result = await updateUserSettingToggle(mockUserId, false, "isPushEnabled");

        // 検証
        expect(result).toStrictEqual({
          success: false,
          error: "不明なエラーが発生しました",
        });
      });

      test("should handle Prisma record not found error", async () => {
        // モックの設定
        const prismaError = new Error("Record to update not found");
        prismaMock.userSettings.update.mockRejectedValue(prismaError);

        // 関数の実行
        const result = await updateUserSettingToggle("non-existent-user", true, "isEmailEnabled");

        // 検証
        expect(result.success).toBe(false);
        expect(result.error).toBe("Record to update not found");
      });
    });

    // 境界値テスト
    describe("境界値テスト", () => {
      test("should handle empty userId", async () => {
        // モックの設定
        const errorMessage = "Invalid user ID";
        prismaMock.userSettings.update.mockRejectedValue(new Error(errorMessage));

        // 関数の実行
        const result = await updateUserSettingToggle("", true, "isEmailEnabled");

        // 検証
        expect(result.success).toBe(false);
        expect(result.error).toBe(errorMessage);
      });

      test("should handle null userId", async () => {
        // モックの設定
        const errorMessage = "Invalid user ID";
        prismaMock.userSettings.update.mockRejectedValue(new Error(errorMessage));

        // 関数の実行
        const result = await updateUserSettingToggle(null as unknown as string, true, "isEmailEnabled");

        // 検証
        expect(result.success).toBe(false);
        expect(result.error).toBe(errorMessage);
      });

      test("should handle undefined userId", async () => {
        // モックの設定
        const errorMessage = "Invalid user ID";
        prismaMock.userSettings.update.mockRejectedValue(new Error(errorMessage));

        // 関数の実行
        const result = await updateUserSettingToggle(undefined as unknown as string, true, "isEmailEnabled");

        // 検証
        expect(result.success).toBe(false);
        expect(result.error).toBe(errorMessage);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateUserSetup", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    // 正常系テスト
    describe("正常系", () => {
      test("should create new user settings successfully", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockResolvedValue({
          ...mockUserSettings,
          username: mockSetupFormData.username,
          lifeGoal: mockSetupFormData.lifeGoal,
        });

        // 関数の実行
        const result = await updateUserSetup(mockSetupFormData);

        // 検証
        expect(getAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.userSettings.upsert).toHaveBeenCalledWith({
          where: { userId: mockUserId },
          update: {
            username: mockSetupFormData.username,
            lifeGoal: mockSetupFormData.lifeGoal,
          },
          create: {
            userId: mockUserId,
            username: mockSetupFormData.username,
            lifeGoal: mockSetupFormData.lifeGoal,
          },
        });

        expect(result).toStrictEqual({
          success: true,
          redirect: "/dashboard/grouplist",
        });
      });

      test("should update existing user settings successfully", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        const updatedSettings = {
          ...mockUserSettings,
          username: "更新されたユーザー名",
          lifeGoal: "更新された目標",
        };
        prismaMock.userSettings.upsert.mockResolvedValue(updatedSettings);

        // 関数の実行
        const result = await updateUserSetup({
          username: "更新されたユーザー名",
          lifeGoal: "更新された目標",
        });

        // 検証
        expect(result.success).toBe(true);
        expect(result.redirect).toBe("/dashboard/grouplist");
      });

      test("should handle minimum valid input", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockResolvedValue({
          ...mockUserSettings,
          username: "ab",
          lifeGoal: "cd",
        });

        // 関数の実行（最小文字数）
        const result = await updateUserSetup({
          username: "ab", // 2文字（最小）
          lifeGoal: "cd", // 2文字（最小）
        });

        // 検証
        expect(result.success).toBe(true);
      });

      test("should handle maximum valid input", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        const maxUsername = "a".repeat(40); // 40文字（最大）
        const maxLifeGoal = "b".repeat(200); // 200文字（最大）

        prismaMock.userSettings.upsert.mockResolvedValue({
          ...mockUserSettings,
          username: maxUsername,
          lifeGoal: maxLifeGoal,
        });

        // 関数の実行
        const result = await updateUserSetup({
          username: maxUsername,
          lifeGoal: maxLifeGoal,
        });

        // 検証
        expect(result.success).toBe(true);
      });
    });

    // 異常系テスト
    describe("異常系", () => {
      test("should handle authentication error", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockRejectedValue(new Error("Authentication failed"));

        // 関数の実行
        const result = await updateUserSetup(mockSetupFormData);

        // 検証
        expect(result).toStrictEqual({
          success: false,
          error: "設定の更新中にエラーが発生しました。",
        });
      });

      test("should handle redirect from getAuthenticatedSessionUserId", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockImplementation(() => {
          throw new Error("Redirect to signin");
        });

        // 関数の実行
        const result = await updateUserSetup(mockSetupFormData);

        // 検証
        expect(result).toStrictEqual({
          success: false,
          error: "設定の更新中にエラーが発生しました。",
        });
      });

      test("should handle database error during upsert", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockRejectedValue(new Error("Database error"));

        // 関数の実行
        const result = await updateUserSetup(mockSetupFormData);

        // 検証
        expect(result).toStrictEqual({
          success: false,
          error: "設定の更新中にエラーが発生しました。",
        });
      });

      test("should handle unknown error during upsert", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockRejectedValue("Unknown error");

        // 関数の実行
        const result = await updateUserSetup(mockSetupFormData);

        // 検証
        expect(result.success).toBe(false);
        expect(result.error).toBe("設定の更新中にエラーが発生しました。");
      });

      test("should handle Prisma constraint violation", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        const constraintError = new Error("Unique constraint failed");
        prismaMock.userSettings.upsert.mockRejectedValue(constraintError);

        // 関数の実行
        const result = await updateUserSetup(mockSetupFormData);

        // 検証
        expect(result.success).toBe(false);
        expect(result.error).toBe("設定の更新中にエラーが発生しました。");
      });
    });

    // 境界値テスト
    describe("境界値テスト", () => {
      test("should handle empty username", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockRejectedValue(new Error("Validation failed"));

        // 関数の実行
        const result = await updateUserSetup({
          username: "",
          lifeGoal: "有効な目標",
        });

        // 検証
        expect(result.success).toBe(false);
      });

      test("should handle empty lifeGoal", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockRejectedValue(new Error("Validation failed"));

        // 関数の実行
        const result = await updateUserSetup({
          username: "有効なユーザー名",
          lifeGoal: "",
        });

        // 検証
        expect(result.success).toBe(false);
      });

      test("should handle null values", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockRejectedValue(new Error("Validation failed"));

        // 関数の実行
        const result = await updateUserSetup({
          username: null as unknown as string,
          lifeGoal: null as unknown as string,
        });

        // 検証
        expect(result.success).toBe(false);
      });

      test("should handle undefined values", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockRejectedValue(new Error("Validation failed"));

        // 関数の実行
        const result = await updateUserSetup({
          username: undefined as unknown as string,
          lifeGoal: undefined as unknown as string,
        });

        // 検証
        expect(result.success).toBe(false);
      });

      test("should handle username exceeding maximum length", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockRejectedValue(new Error("Validation failed"));

        // 関数の実行（41文字 - 最大40文字を超える）
        const result = await updateUserSetup({
          username: "a".repeat(41),
          lifeGoal: "有効な目標",
        });

        // 検証
        expect(result.success).toBe(false);
      });

      test("should handle lifeGoal exceeding maximum length", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockRejectedValue(new Error("Validation failed"));

        // 関数の実行（201文字 - 最大200文字を超える）
        const result = await updateUserSetup({
          username: "有効なユーザー名",
          lifeGoal: "a".repeat(201),
        });

        // 検証
        expect(result.success).toBe(false);
      });

      test("should handle single character input (below minimum)", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockRejectedValue(new Error("Validation failed"));

        // 関数の実行（1文字 - 最小2文字未満）
        const result = await updateUserSetup({
          username: "a",
          lifeGoal: "b",
        });

        // 検証
        expect(result.success).toBe(false);
      });
    });

    // 特殊文字・エンコーディングテスト
    describe("特殊文字・エンコーディングテスト", () => {
      test("should handle Japanese characters", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockResolvedValue({
          ...mockUserSettings,
          username: "日本語ユーザー",
          lifeGoal: "日本語の目標です",
        });

        // 関数の実行
        const result = await updateUserSetup({
          username: "日本語ユーザー",
          lifeGoal: "日本語の目標です",
        });

        // 検証
        expect(result.success).toBe(true);
      });

      test("should handle special characters", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockResolvedValue({
          ...mockUserSettings,
          username: "user@123!",
          lifeGoal: "目標: 成功への道のり (2024年)",
        });

        // 関数の実行
        const result = await updateUserSetup({
          username: "user@123!",
          lifeGoal: "目標: 成功への道のり (2024年)",
        });

        // 検証
        expect(result.success).toBe(true);
      });

      test("should handle emoji characters", async () => {
        // モックの設定
        vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);
        prismaMock.userSettings.upsert.mockResolvedValue({
          ...mockUserSettings,
          username: "ユーザー😊",
          lifeGoal: "幸せになる🌟✨",
        });

        // 関数の実行
        const result = await updateUserSetup({
          username: "ユーザー😊",
          lifeGoal: "幸せになる🌟✨",
        });

        // 検証
        expect(result.success).toBe(true);
      });
    });
  });
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
