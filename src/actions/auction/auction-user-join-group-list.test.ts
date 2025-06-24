import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { beforeEach, describe, expect, test } from "vitest";

import { getUserGroupIds } from "./auction-user-join-group-list";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの定数
 */
const TEST_CONSTANTS = {
  USER_ID: "test-user-id",
  GROUP_ID_1: "test-group-id-1",
  GROUP_ID_2: "test-group-id-2",
  GROUP_ID_3: "test-group-id-3",
} as const;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getUserGroupIds", () => {
  beforeEach(() => {
    // 各テスト前にPrismaモックをリセット
    prismaMock.groupMembership.findMany.mockReset();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should return user group IDs when user has joined groups", async () => {
      // Arrange
      const mockMemberships = [
        {
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID_1,
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID_2,
        },
      ];

      prismaMock.groupMembership.findMany.mockResolvedValue(
        mockMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
      );

      // Act
      const result = await getUserGroupIds(TEST_CONSTANTS.USER_ID);

      // Assert
      expect(result).toStrictEqual([TEST_CONSTANTS.GROUP_ID_1, TEST_CONSTANTS.GROUP_ID_2]);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_CONSTANTS.USER_ID },
        select: { groupId: true },
      });
    });

    test("should return empty array when user has no joined groups", async () => {
      // Arrange
      prismaMock.groupMembership.findMany.mockResolvedValue([]);

      // Act
      const result = await getUserGroupIds(TEST_CONSTANTS.USER_ID);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_CONSTANTS.USER_ID },
        select: { groupId: true },
      });
    });

    test("should return single group ID when user has joined one group", async () => {
      // Arrange
      const mockMembership = {
        userId: TEST_CONSTANTS.USER_ID,
        groupId: TEST_CONSTANTS.GROUP_ID_1,
      };

      prismaMock.groupMembership.findMany.mockResolvedValue([mockMembership] as unknown as Awaited<
        ReturnType<typeof prismaMock.groupMembership.findMany>
      >);

      // Act
      const result = await getUserGroupIds(TEST_CONSTANTS.USER_ID);

      // Assert
      expect(result).toStrictEqual([TEST_CONSTANTS.GROUP_ID_1]);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test.each([
      { name: "empty string", userId: "" },
      { name: "null", userId: null },
      { name: "undefined", userId: undefined },
      { name: "whitespace", userId: "   " },
      { name: "number", userId: 123 },
    ])("should throw error when userId is $name", async ({ userId }) => {
      // Act & Assert
      await expect(getUserGroupIds(userId as string)).rejects.toThrow("userId is required");
      expect(prismaMock.groupMembership.findMany).not.toHaveBeenCalled();
    });

    test("should handle database error gracefully", async () => {
      // Arrange
      const databaseError = new Error("Database connection failed");
      prismaMock.groupMembership.findMany.mockRejectedValue(databaseError);

      // Act & Assert
      await expect(getUserGroupIds(TEST_CONSTANTS.USER_ID)).rejects.toThrow("Database connection failed");
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_CONSTANTS.USER_ID },
        select: { groupId: true },
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データ整合性テスト", () => {
    test("should handle duplicate groupIds in response", async () => {
      // Arrange
      const mockMembershipsWithDuplicates = [
        {
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID_1,
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID_1, // 重複
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID_2,
        },
      ];

      prismaMock.groupMembership.findMany.mockResolvedValue(
        mockMembershipsWithDuplicates as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
      );

      // Act
      const result = await getUserGroupIds(TEST_CONSTANTS.USER_ID);

      // Assert
      expect(result).toStrictEqual([
        TEST_CONSTANTS.GROUP_ID_1,
        TEST_CONSTANTS.GROUP_ID_1, // 重複も含めて返される
        TEST_CONSTANTS.GROUP_ID_2,
      ]);
    });

    test("should preserve order of groups from database", async () => {
      // Arrange
      const mockMemberships = [
        {
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID_3,
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID_1,
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID_2,
        },
      ];

      prismaMock.groupMembership.findMany.mockResolvedValue(
        mockMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
      );

      // Act
      const result = await getUserGroupIds(TEST_CONSTANTS.USER_ID);

      // Assert
      expect(result).toStrictEqual([TEST_CONSTANTS.GROUP_ID_3, TEST_CONSTANTS.GROUP_ID_1, TEST_CONSTANTS.GROUP_ID_2]);
    });
  });
});
