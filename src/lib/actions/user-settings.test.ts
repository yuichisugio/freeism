import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { userSettingsFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { updateUserSettingToggle, updateUserSetup } from "./user-settings";

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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
