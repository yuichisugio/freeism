import type { Suggestion } from "@/types/auction-types";
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

// 共通のテストデータ
const mockSuggestion: Suggestion = {
  id: testTaskId,
  text: "テストタスク",
  highlighted: "<mark>テスト</mark>タスク",
  score: 0.95,
};

// ヘルパー関数：正常なグループメンバーシップのモックセットアップ
const setupValidGroupMembership = () => {
  const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
  prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
  return mockGroupMemberships;
};

// ヘルパー関数：空のグループメンバーシップのモックセットアップ
const setupEmptyGroupMembership = () => {
  prismaMock.groupMembership.findMany.mockResolvedValue([]);
};

describe("cachedGetSearchSuggestions", () => {
  describe("正常系", () => {
    test("should return search suggestions successfully", async () => {
      // Arrange
      const query = "テスト";
      setupValidGroupMembership();
      const mockSuggestions = [mockSuggestion];
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

    test("should handle multiple suggestions", async () => {
      // Arrange
      const query = "テスト";
      setupValidGroupMembership();
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
      prismaMock.$queryRaw.mockResolvedValue(multipleSuggestions);

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual(multipleSuggestions);
      expect(result).toHaveLength(2);
    });

    test.each([
      { description: "zero score", score: 0 },
      { description: "maximum score", score: 1.0 },
    ])("should handle $description in suggestions", async ({ score }) => {
      // Arrange
      const query = "テスト";
      setupValidGroupMembership();
      const suggestionWithScore: Suggestion[] = [
        {
          id: "task-1",
          text: "テストタスク",
          highlighted: score > 0 ? "<mark>テスト</mark>タスク" : "テストタスク",
          score,
        },
      ];
      prismaMock.$queryRaw.mockResolvedValue(suggestionWithScore);

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(score);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalled();
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });
  });

  describe("異常系", () => {
    test("should handle database error gracefully", async () => {
      // Arrange
      const query = "テスト";
      setupValidGroupMembership();
      prismaMock.$queryRaw.mockRejectedValue(new Error("Database connection error"));

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalled();
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });

    test("should handle non-string query parameter", async () => {
      // Arrange
      const nonStringQuery = 123 as unknown as string;

      // Act & Assert
      // 非文字列のqueryに対してtrim()を呼び出すとエラーが発生することを確認
      await expect(cachedGetSearchSuggestions(nonStringQuery, testUserId)).rejects.toThrow("query.trim is not a function");
    });

    test("should handle non-string userId parameter", async () => {
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
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe("境界値テスト", () => {
    test.each([
      { description: "empty string", query: "" },
      { description: "whitespace only", query: "   " },
      { description: "null", query: null },
      { description: "undefined", query: undefined },
    ])("should return empty array when query is $description", async ({ query }) => {
      // Act
      const result = await cachedGetSearchSuggestions(query!, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.groupMembership.findMany).not.toHaveBeenCalled();
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("should return empty array when userId is empty string", async () => {
      // Arrange
      const query = "テスト";
      const emptyUserId = "";

      // Act
      const result = await cachedGetSearchSuggestions(query, emptyUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.groupMembership.findMany).not.toHaveBeenCalled();
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test.each([
      { description: "null userId", userId: null },
      { description: "undefined userId", userId: undefined },
    ])("should return empty array when $description", async ({ userId }) => {
      // Arrange
      const query = "テスト";

      // Act
      const result = await cachedGetSearchSuggestions(query, userId!);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.groupMembership.findMany).not.toHaveBeenCalled();
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test.each([
      { description: "special characters", query: "!@#$%^&*()" },
      { description: "very long string", query: "a".repeat(1000) },
    ])("should handle $description in query", async ({ query }) => {
      // Arrange
      setupValidGroupMembership();
      prismaMock.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await cachedGetSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        select: { groupId: true },
      });
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });

    test("should return empty array when user has no group memberships", async () => {
      // Arrange
      const query = "テスト";
      setupEmptyGroupMembership();

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
  });
});
