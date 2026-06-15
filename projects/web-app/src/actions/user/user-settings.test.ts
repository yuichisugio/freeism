import type { SetupForm } from "@/components/setting/setup-form";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { userFactory, userSettingsFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UpdateUserSettingToggleParams } from "./user-settings";
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateUserSettingToggle", () => {
    // 正常系テスト
    describe("正常系", () => {
      test.each([
        {
          name: "email notification-false",
          isEnabled: false,
          column: "isEmailEnabled",
        },
        {
          name: "email notification-true",
          isEnabled: true,
          column: "isEmailEnabled",
        },
        {
          name: "push notification-false",
          isEnabled: false,
          column: "isPushEnabled",
        },
        {
          name: "push notification-true",
          isEnabled: true,
          column: "isPushEnabled",
        },
      ])("should update $name setting successfully", async ({ isEnabled, column }) => {
        // モックの設定
        const updatedSettings = { ...mockUserSettings, [column]: isEnabled };
        prismaMock.userSettings.update.mockResolvedValue(updatedSettings);

        // 関数の実行
        const result = await updateUserSettingToggle({
          userId: mockUserId,
          isEnabled,
          column: column as "isEmailEnabled" | "isPushEnabled",
        });

        // 検証
        expect(prismaMock.userSettings.update).toHaveBeenCalledWith({
          where: { userId: mockUserId },
          data: { [column]: isEnabled },
        });

        expect(result).toStrictEqual({
          success: true,
          message: "ユーザー設定を更新しました",
          data: {
            id: updatedSettings.id,
            userId: updatedSettings.userId,
            [column]: isEnabled,
          },
        });
      });
    });

    // 異常系・境界値テスト（統合）
    describe("異常系・境界値テスト", () => {
      test("should throw error for null parameters", async () => {
        await expect(updateUserSettingToggle(null as unknown as UpdateUserSettingToggleParams)).rejects.toThrow(
          "無効なパラメータが指定されました",
        );
      });

      test("should throw error for undefined parameters", async () => {
        await expect(updateUserSettingToggle(undefined as unknown as UpdateUserSettingToggleParams)).rejects.toThrow(
          "無効なパラメータが指定されました",
        );
      });

      test.each([
        // 無効なuserId
        { userId: "", isEnabled: true, column: "isEmailEnabled", description: "empty userId" },
        { userId: null, isEnabled: true, column: "isEmailEnabled", description: "null userId" },
        { userId: undefined, isEnabled: true, column: "isEmailEnabled", description: "undefined userId" },
        // 無効なisEnabled
        { userId: mockUserId, isEnabled: null, column: "isEmailEnabled", description: "null isEnabled" },
        { userId: mockUserId, isEnabled: undefined, column: "isEmailEnabled", description: "undefined isEnabled" },
        // 無効なcolumn
        { userId: mockUserId, isEnabled: true, column: "invalidColumn", description: "invalid column" },
        { userId: mockUserId, isEnabled: true, column: null, description: "null column" },
        { userId: mockUserId, isEnabled: true, column: undefined, description: "undefined column" },
      ])("should throw error for invalid parameters: $description", async ({ userId, isEnabled, column }) => {
        await expect(
          updateUserSettingToggle({
            userId: userId!,
            isEnabled: isEnabled!,
            column: column as "isEmailEnabled" | "isPushEnabled",
          }),
        ).rejects.toThrow("無効なパラメータが指定されました");
      });

      test.each([
        { error: new Error("Database connection failed"), name: "connection error" },
        { error: new Error("Record to update not found"), name: "record not found" },
        { error: "Unknown error", name: "unknown error type" },
      ])("should handle $error database errors", async ({ error }) => {
        prismaMock.userSettings.update.mockRejectedValue(error);

        await expect(
          updateUserSettingToggle({
            userId: mockUserId,
            isEnabled: true,
            column: "isEmailEnabled",
          }),
        ).rejects.toThrow(error);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateUserSetup", () => {
    // 正常系テスト
    describe("正常系", () => {
      test("should create new user settings successfully", async () => {
        // モックの設定
        prismaMock.userSettings.upsert.mockResolvedValue({
          ...mockUserSettings,
          username: mockSetupFormData.username,
          lifeGoal: mockSetupFormData.lifeGoal,
        });

        // 関数の実行
        const result = await updateUserSetup(mockSetupFormData, mockUserId);

        // 検証
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
          data: null,
          message: "ユーザー設定を更新しました",
        });
      });
    });

    // 異常系・境界値テスト（統合）
    describe("異常系・境界値テスト", () => {
      test.each([
        { data: null, userId: mockUserId, name: "null data" },
        { data: undefined, userId: mockUserId, name: "undefined data" },
        { data: mockSetupFormData, userId: null, name: "null userId" },
        { data: mockSetupFormData, userId: undefined, name: "undefined userId" },
        { data: mockSetupFormData, userId: "", name: "empty userId" },
      ])("should throw error for invalid parameters $name", async (params) => {
        const { data, userId } = params as { data: SetupForm; userId: string };

        await expect(updateUserSetup(data, userId)).rejects.toThrow("無効なパラメータが指定されました");
      });

      test.each([
        { error: new Error("Database error"), name: "general database error" },
        { error: new Error("Unique constraint failed"), name: "constraint violation" },
        { error: "Unknown error", name: "unknown error type" },
      ])("should handle $error database errors", async ({ error }) => {
        prismaMock.userSettings.upsert.mockRejectedValue(error);

        await expect(updateUserSetup(mockSetupFormData, mockUserId)).rejects.toThrow(error);
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
        expect(result.data).toStrictEqual(testUserSettings);
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
        expect(result.data).toBeNull();
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: testUser.id },
        });
      });

      test("should handle various userId formats and settings states", async () => {
        const testCases = [
          {
            userId: "550e8400-e29b-41d4-a716-446655440000",
            settings: userSettingsFactory.build({ userId: "550e8400-e29b-41d4-a716-446655440000" }),
            description: "UUID format userId",
          },
          {
            userId: testUser.id,
            settings: userSettingsFactory.build({
              userId: testUser.id,
              username: "fulluser",
              lifeGoal: "完全な人生目標",
              isEmailEnabled: true,
              isPushEnabled: true,
            }),
            description: "fully populated settings",
          },
          {
            userId: testUser.id,
            settings: userSettingsFactory.build({
              userId: testUser.id,
              username: undefined,
              lifeGoal: undefined,
              isEmailEnabled: false,
              isPushEnabled: false,
            }),
            description: "minimal settings",
          },
        ];

        for (const testCase of testCases) {
          prismaMock.userSettings.findUnique.mockResolvedValue(testCase.settings);

          const result = await getUserSettings(testCase.userId);

          expect(result.data).toStrictEqual(testCase.settings);
          expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
            where: { userId: testCase.userId },
          });
        }
      });
    });

    describe("異常系", () => {
      test("should throw error when prisma query fails", async () => {
        // Arrange
        prismaMock.userSettings.findUnique.mockRejectedValue(new Error("データベース接続エラー"));

        // Act & Assert
        await expect(getUserSettings(testUser.id)).rejects.toThrow("データベース接続エラー");
        expect(prismaMock.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: testUser.id },
        });
      });

      test("should throw error for invalid userId parameter", async () => {
        // 無効なuserIdのテストケース
        const invalidUserIds = [null, undefined, ""];

        for (const invalidUserId of invalidUserIds) {
          await expect(getUserSettings(invalidUserId!)).rejects.toThrow("無効なパラメータが指定されました");
        }
      });
    });
  });
});
