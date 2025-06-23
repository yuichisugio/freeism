import type { Suggestion } from "@/types/auction-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GetSearchSuggestionsParams } from "./cache-auction-suggestion";
import { cachedGetSearchSuggestions } from "./cache-auction-suggestion";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * テストデータの定義
 */
const CONSTS = {
  testUserId: "test-user-id",
  testGroupId: "test-group-id",
  testTaskId: "test-task-id",
  testUserGroupIds: ["test-group-id", "test-group-id-2"],
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通のテストデータ
 */
const mockSuggestion: Suggestion = {
  id: CONSTS.testTaskId,
  text: "テストタスク",
  highlighted: "<mark>テスト</mark>タスク",
  score: 0.95,
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通のテストパラメータ
 */
const createTestParams = (overrides: Partial<GetSearchSuggestionsParams> = {}): GetSearchSuggestionsParams => ({
  query: "テスト",
  userId: CONSTS.testUserId,
  userGroupIds: CONSTS.testUserGroupIds,
  limit: 10,
  ...overrides,
});

describe("cachedGetSearchSuggestions", () => {
  describe("正常系", () => {
    test("should return search suggestions successfully", async () => {
      // Arrange
      const params = createTestParams();
      const mockSuggestions = [mockSuggestion];
      prismaMock.$queryRaw.mockResolvedValue(mockSuggestions);

      // Act
      const result = await cachedGetSearchSuggestions(params);

      // Assert
      expect(result).toStrictEqual(mockSuggestions);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    test("should handle multiple suggestions", async () => {
      // Arrange
      const params = createTestParams();
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
      const result = await cachedGetSearchSuggestions(params);

      // Assert
      expect(result).toStrictEqual(multipleSuggestions);
      expect(result).toHaveLength(2);
    });

    test.each([
      { description: "zero score", score: 0 },
      { description: "maximum score", score: 1.0 },
    ])("should handle $description in suggestions", async ({ score }) => {
      // Arrange
      const params = createTestParams();
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
      const result = await cachedGetSearchSuggestions(params);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(score);
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });

    test("should handle custom limit parameter", async () => {
      // Arrange
      const params = createTestParams({ limit: 5 });
      const mockSuggestions = [mockSuggestion];
      prismaMock.$queryRaw.mockResolvedValue(mockSuggestions);

      // Act
      const result = await cachedGetSearchSuggestions(params);

      // Assert
      expect(result).toStrictEqual(mockSuggestions);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe("異常系", () => {
    test("should handle database error gracefully", async () => {
      // Arrange
      const params = createTestParams();
      prismaMock.$queryRaw.mockRejectedValue(new Error("Database connection error"));

      // Act
      const result = await cachedGetSearchSuggestions(params);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });

    test.each([
      { name: "query is null", query: null },
      { name: "query is undefined", query: undefined },
      { name: "query is number", query: 123 },
      { name: "query is empty string", query: "" },
      { name: "query is whitespace only", query: "   " },
      { name: "userId is null", userId: null },
      { name: "userId is undefined", userId: undefined },
      { name: "userId is number", userId: 123 },
      { name: "userId is empty string", userId: "" },
      { name: "userGroupIds is null", userGroupIds: null },
      { name: "userGroupIds is undefined", userGroupIds: undefined },
      { name: "userGroupIds is number", userGroupIds: 123 },
      { name: "userGroupIds is empty array", userGroupIds: [] },
      { name: "limit is less than 1", limit: 0 },
      { name: "limit is undefined", limit: undefined },
      { name: "limit is null", limit: null },
      { name: "limit is boolean", limit: true },
      { name: "limit is object", limit: { limit: 10 } },
    ])("should handle $name in query", async ({ query, userId, userGroupIds, limit }) => {
      // Arrange
      const params = createTestParams({
        query: query as string,
        userId: userId as string,
        userGroupIds: userGroupIds as string[],
        limit: limit as number,
      });

      // Act
      const result = await cachedGetSearchSuggestions(params);

      // Assert
      expect(result).toStrictEqual([]);
    });
  });
});
