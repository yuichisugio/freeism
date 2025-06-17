import type { AuctionListingsConditions, Suggestion } from "@/types/auction-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupMembershipFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象の関数をインポート
import { cachedGetSearchSuggestions } from "./cache-auction-listing-suggestion";

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// テストデータの定義
const testUserId = "test-user-id";
const testGroupId = "test-group-id";
const testTaskId = "test-task-id";
const testAuctionId = "test-auction-id";

// 共通のテストデータ
const mockListingsConditions: AuctionListingsConditions = {
  categories: ["プログラミング"],
  status: ["not_ended"],
  statusConditionJoinType: "OR",
  minBid: 100,
  maxBid: 1000,
  minRemainingTime: 1,
  maxRemainingTime: 24,
  groupIds: [testGroupId],
  searchQuery: "テスト",
  sort: [{ field: "newest", direction: "desc" }],
  page: 1,
};

const mockSuggestion: Suggestion = {
  id: testTaskId,
  text: "テストタスク",
  highlighted: "<mark>テスト</mark>タスク",
  score: 0.95,
};

describe("cache-auction-listing", () => {
  describe("cachedGetSearchSuggestions", () => {
    test("should return search suggestions successfully", async () => {
      // Arrange
      const query = "テスト";
      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const mockSuggestions = [mockSuggestion];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValue(mockSuggestions);

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual(mockSuggestions);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        select: { groupId: true },
      });
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    test("should return empty array when query is empty", async () => {
      // Arrange
      const query = "";

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.groupMembership.findMany).not.toHaveBeenCalled();
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("should return empty array when query is only whitespace", async () => {
      // Arrange
      const query = "   ";

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.groupMembership.findMany).not.toHaveBeenCalled();
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("should return empty array when query length is less than 1", async () => {
      // Arrange
      const query = "";

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
    });

    test("should return empty array when user has no group memberships", async () => {
      // Arrange
      const query = "テスト";
      prismaMock.groupMembership.findMany.mockResolvedValue([]);

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        select: { groupId: true },
      });
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("should handle database error gracefully", async () => {
      // Arrange
      const query = "テスト";
      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockRejectedValue(new Error("Database connection error"));

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalled();
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });

    test("should handle multiple suggestions", async () => {
      // Arrange
      const query = "テスト";
      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
      const multipleSuggestions: Suggestion[] = [
        {
          id: "task-1",
          text: "テストタスク1",
          highlighted: "<mark>テスト</mark>タスク1",
          score: 0.95,
        },
        {
          id: "task-2",
          text: "テストタスク2",
          highlighted: "<mark>テスト</mark>タスク2",
          score: 0.85,
        },
      ];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValue(multipleSuggestions);

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual(multipleSuggestions);
      expect(result).toHaveLength(2);
    });

    test("should handle special characters in query", async () => {
      // Arrange
      const query = "!@#$%^&*()";
      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
    });

    test("should handle very long query string", async () => {
      // Arrange
      const longQuery = "a".repeat(1000);
      const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await cachedGetSearchSuggestions(longQuery, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
    });

    test("should handle null query", async () => {
      // Arrange
      const query = null as unknown as string;

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
    });

    test("should handle undefined query", async () => {
      // Arrange
      const query = undefined as unknown as string;

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
    });
  });
  test("should handle zero score in suggestions", async () => {
    // Arrange
    const query = "テスト";
    const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
    const zeroScoreSuggestions: Suggestion[] = [
      {
        id: "task-1",
        text: "テストタスク",
        highlighted: "テストタスク",
        score: 0,
      },
    ];

    prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
    prismaMock.$queryRaw.mockResolvedValue(zeroScoreSuggestions);

    // Act
    const result = await cachedGetSearchSuggestions(query, testUserId);

    // Assert
    expect(result[0].score).toBe(0);
  });

  test("should handle maximum score in suggestions", async () => {
    // Arrange
    const query = "テスト";
    const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
    const maxScoreSuggestions: Suggestion[] = [
      {
        id: "task-1",
        text: "テストタスク",
        highlighted: "<mark>テスト</mark>タスク",
        score: 1.0,
      },
    ];

    prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
    prismaMock.$queryRaw.mockResolvedValue(maxScoreSuggestions);

    // Act
    const result = await cachedGetSearchSuggestions(query, testUserId);

    // Assert
    expect(result[0].score).toBe(1.0);
  });
  test("should handle non-string query parameter", async () => {
    // Arrange
    const nonStringQuery = 123 as unknown as string;

    // Act & Assert
    // 非文字列のqueryに対してtrim()を呼び出すとエラーが発生することを確認
    await expect(cachedGetSearchSuggestions(nonStringQuery, testUserId)).rejects.toThrow("query.trim is not a function");
  });

  test("should handle non-string userId parameter in cachedGetSearchSuggestions", async () => {
    // Arrange
    const query = "テスト";
    const nonStringUserId = 123 as unknown as string;

    // 非文字列のuserIdでもgroupMembership.findManyが呼ばれることを想定
    prismaMock.groupMembership.findMany.mockResolvedValue([]);

    // Act
    const result = await cachedGetSearchSuggestions(query, nonStringUserId);

    // Assert
    expect(result).toStrictEqual([]);
    expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
      where: { userId: nonStringUserId },
      select: { groupId: true },
    });
  });
});
