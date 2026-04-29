import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserGroups } from "./user";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの準備
 */
const testUser = userFactory.build({ id: "test-user-1" });
const testGroup1 = groupFactory.build({ id: "test-group-1", name: "テストグループ1" });
const testGroup2 = groupFactory.build({ id: "test-group-2", name: "テストグループ2" });

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("user.ts", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserGroups", () => {
    describe("正常系", () => {
      test("should return user groups when user has multiple groups", async () => {
        // Arrange
        const expectedGroups = [
          { id: testGroup1.id, name: testGroup1.name },
          { id: testGroup2.id, name: testGroup2.name },
        ];

        prismaMock.group.findMany.mockResolvedValue(
          expectedGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
        );

        // Act
        const result = await getUserGroups(testUser.id);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "ユーザーの参加グループを取得しました",
          data: expectedGroups,
        });
      });

      test("should return empty array when user has no groups", async () => {
        // Arrange
        prismaMock.group.findMany.mockResolvedValue([]);

        // Act
        const result = await getUserGroups(testUser.id);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "ユーザーの参加グループを取得しました",
          data: [],
        });
      });
    });

    describe("異常系", () => {
      test("should throw error when prisma query fails", async () => {
        // Arrange
        const errorMessage = "データベースエラー";
        prismaMock.group.findMany.mockRejectedValue(new Error(errorMessage));

        // Act & Assert
        await expect(getUserGroups(testUser.id)).rejects.toThrow(errorMessage);
      });

      test("should handle null userId", async () => {
        // Act & Assert
        await expect(getUserGroups(null as unknown as string)).rejects.toThrow("userId is required");
      });

      test("should handle undefined userId", async () => {
        // Act & Assert
        await expect(getUserGroups(undefined as unknown as string)).rejects.toThrow("userId is required");
      });

      test("should handle empty string userId", async () => {
        // Act & Assert
        await expect(getUserGroups("")).rejects.toThrow("userId is required");
      });

      test("should handle database connection timeout", async () => {
        // Arrange
        const timeoutError = new Error("Connection timeout");
        timeoutError.name = "TimeoutError";
        prismaMock.group.findMany.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(getUserGroups(testUser.id)).rejects.toThrow("Connection timeout");
        expect(prismaMock.group.findMany).toHaveBeenCalledOnce();
      });

      test("should handle database constraint violation", async () => {
        // Arrange
        const constraintError = new Error("Foreign key constraint failed");
        constraintError.name = "PrismaClientKnownRequestError";
        prismaMock.group.findMany.mockRejectedValue(constraintError);

        // Act & Assert
        await expect(getUserGroups(testUser.id)).rejects.toThrow("Foreign key constraint failed");
      });

      describe("型安全性テスト", () => {
        test("should return correctly typed result", async () => {
          // Arrange
          const expectedGroups = [{ id: testGroup1.id, name: testGroup1.name }];

          prismaMock.group.findMany.mockResolvedValue(
            expectedGroups as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
          );

          // Act
          const result = await getUserGroups(testUser.id);

          // Assert - 型安全性の確認
          expect(typeof result).toBe("object");
          expect(result.success).toBe(true);
          expect(typeof result.message).toBe("string");
          expect(Array.isArray(result.data)).toBe(true);
          if (result.data && result.data.length > 0) {
            expect(typeof result.data[0].id).toBe("string");
            expect(typeof result.data[0].name).toBe("string");
            expect(result.data[0].id).toBe(testGroup1.id);
            expect(result.data[0].name).toBe(testGroup1.name);
          }
        });
      });
    });
  });
});
