import type { Suggestion } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
 * 期待される結果の構造を作成するヘルパー関数
 */
const createExpectedResult = (data: Suggestion[]) => ({
  success: true,
  data,
  message: "オークション検索提案を取得しました",
});

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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 期待されるSQL生成関数
 */
function generateExpectedSQL(): string {
  return `
        SELECT
          t.id,
          t.task as text,
          t.detail as detail,
          pgroonga_score(t.tableoid, t.ctid) as score,
          pgroonga_highlight_html(t.task, ARRAY[?]) as highlighted
        FROM
          "Task" t
        JOIN
          "Auction" a ON t.id = a."task_id"
        WHERE
          public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ?
        AND
          a."group_id" = ANY(?::text[])
        ORDER BY
          score DESC
        LIMIT
          ?
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
      expect(result).toStrictEqual(createExpectedResult(mockSuggestions));
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
      expect(result).toStrictEqual(createExpectedResult(multipleSuggestions));
      expect(result.data).toHaveLength(2);
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
      expect(result).toStrictEqual(createExpectedResult(suggestionWithScore));
      expect(result.data).toHaveLength(1);
      expect(result.data[0].score).toBe(score);
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
      expect(result).toStrictEqual(createExpectedResult(mockSuggestions));
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe("SQL生成テスト", () => {
    test("should generate correct SQL with basic query", async () => {
      // Arrange
      const params = createTestParams({ query: "テスト", limit: 10 });
      const mockSuggestions = [mockSuggestion];
      prismaMock.$queryRaw.mockResolvedValue(mockSuggestions);

      // Act
      await cachedGetSearchSuggestions(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      const actualCall = prismaMock.$queryRaw.mock.calls[0];
      const actualSql = actualCall[0] as Prisma.Sql;
      const actualSqlString = actualSql.sql.replace(/\s+/g, " ").trim();
      const expectedSqlString = generateExpectedSQL();

      expect(actualSqlString).toStrictEqual(expectedSqlString);
    });

    test("should generate correct SQL with multiple words query", async () => {
      // Arrange
      const multipleWordsQuery = "プログラミング 学習";
      const params = createTestParams({ query: multipleWordsQuery, limit: 5 });
      const mockSuggestions = [mockSuggestion];
      prismaMock.$queryRaw.mockResolvedValue(mockSuggestions);

      // Act
      await cachedGetSearchSuggestions(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      const actualCall = prismaMock.$queryRaw.mock.calls[0];
      const actualSql = actualCall[0] as Prisma.Sql;
      const actualSqlString = actualSql.sql.replace(/\s+/g, " ").trim();
      const expectedSqlString = generateExpectedSQL();

      expect(actualSqlString).toStrictEqual(expectedSqlString);
    });

    test("should generate correct SQL with single group", async () => {
      // Arrange
      const singleGroupIds = ["single-group-id"];
      const params = createTestParams({ userGroupIds: singleGroupIds, limit: 20 });
      const mockSuggestions = [mockSuggestion];
      prismaMock.$queryRaw.mockResolvedValue(mockSuggestions);

      // Act
      await cachedGetSearchSuggestions(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      const actualCall = prismaMock.$queryRaw.mock.calls[0];
      const actualSql = actualCall[0] as Prisma.Sql;
      const actualSqlString = actualSql.sql.replace(/\s+/g, " ").trim();
      const expectedSqlString = generateExpectedSQL();

      expect(actualSqlString).toStrictEqual(expectedSqlString);
    });
  });

  describe("normalizedQueryテスト", () => {
    test.each([
      {
        description: "single word query",
        input: "テスト",
        expected: "テスト",
      },
      {
        description: "multiple words query",
        input: "プログラミング 学習",
        expected: "プログラミング OR 学習",
      },
      {
        description: "query with extra spaces",
        input: "  テスト   プログラミング  ",
        expected: "テスト OR プログラミング",
      },
      {
        description: "query with multiple consecutive spaces",
        input: "テスト    プログラミング    学習",
        expected: "テスト OR プログラミング OR 学習",
      },
      {
        description: "query with consecutive spaces",
        input: "テストプログラミング    学習",
        expected: "テストプログラミング OR 学習",
      },
      {
        description: "query with tabs and newlines",
        input: "テスト\t\nプログラミング",
        expected: "テスト OR プログラミング",
      },
    ])("should normalize query correctly for $description", async ({ input, expected }) => {
      // Arrange
      const params = createTestParams({ query: input });
      const mockSuggestions = [mockSuggestion];
      prismaMock.$queryRaw.mockResolvedValue(mockSuggestions);

      // Act
      await cachedGetSearchSuggestions(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      const actualCall = prismaMock.$queryRaw.mock.calls[0];
      const actualSql = actualCall[0] as Prisma.Sql;

      // SQLクエリ内で正規化されたクエリが使用されていることを確認
      // normalizedQueryは第2パラメータとして渡される
      expect(actualSql.values[1]).toBe(expected);
    });

    test("should handle query normalization in SQL generation", async () => {
      // Arrange
      const originalQuery = "テスト プログラミング";
      const params = createTestParams({ query: originalQuery });
      const mockSuggestions = [mockSuggestion];
      prismaMock.$queryRaw.mockResolvedValue(mockSuggestions);

      // Act
      await cachedGetSearchSuggestions(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      const actualCall = prismaMock.$queryRaw.mock.calls[0];
      const actualSql = actualCall[0] as Prisma.Sql;

      // 元のクエリがARRAY[]内で使用され、正規化されたクエリが&@~演算子で使用されることを確認
      expect(actualSql.values[0]).toBe(originalQuery); // ARRAY[]内の元のクエリ
      expect(actualSql.values[1]).toBe("テスト OR プログラミング"); // 正規化されたクエリ
      expect(actualSql.values[2]).toStrictEqual(CONSTS.testUserGroupIds); // userGroupIds
      expect(actualSql.values[3]).toBe(10); // limit
    });
  });

  describe("異常系", () => {
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
      expect(result).toStrictEqual(createExpectedResult([]));
    });
  });
});
