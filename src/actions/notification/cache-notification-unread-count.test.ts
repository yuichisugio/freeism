import { unstable_cacheTag as cacheTag } from "next/cache";
import { buildCommonNotificationWhereClause } from "@/actions/notification/notification-utilities";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { RawNotificationFromDB } from "./cache-notification-unread-count";
import { cachedGetUnreadNotificationsCount } from "./cache-notification-unread-count";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 依存関数のモック
vi.mock("@/actions/notification/notification-utilities", () => ({
  buildCommonNotificationWhereClause: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cacheTag: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数の型定義
const mockBuildCommonNotificationWhereClause = vi.mocked(buildCommonNotificationWhereClause);
const mockCacheTag = vi.mocked(cacheTag);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cachedGetUnreadNotificationsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const sql = Prisma.sql`(
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = 'user-1') OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(${"[group-1]"}))
      OR (n."target_type" = 'TASK' AND n."task_id" = ANY(${"[task-1]"}))
    ) AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`;
    mockBuildCommonNotificationWhereClause.mockResolvedValue(sql);
    mockCacheTag.mockReturnValue(undefined);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should return true when unread notifications exist", async () => {
      // Arrange
      const userId = "user-1";
      const mockResult = [{ id: "notification-1" }];
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(true);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
      expect(mockCacheTag).toHaveBeenCalledWith(`notification:notificationByUserId:${userId}`);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    test("should return false when no unread notifications exist", async () => {
      // Arrange
      const userId = "user-1";
      const mockResult: RawNotificationFromDB[] = [];
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("SQL全文検証テスト", () => {
    test("should generate correct SQL with specific commonWhereClause", async () => {
      // Arrange
      const userId = "user-1";
      const mockResult = [{ id: "notification-1" }];

      // 具体的なcommonWhereClauseを設定
      const commonWhereClause = Prisma.sql`(
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = ${userId}) OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(${["group-1"]}))
      OR (n."target_type" = 'TASK' AND n."task_id" = ANY(${["task-1"]}))
    ) AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`;

      mockBuildCommonNotificationWhereClause.mockResolvedValue(commonWhereClause);
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);

      const actualCall = prismaMock.$queryRaw.mock.calls[0];
      expect(actualCall).toBeDefined();
      expect(actualCall.length).toBeGreaterThan(0);

      const actualSql = actualCall[0];
      expect(actualSql).toBeDefined();

      // actualSqlが配列（tagged template literalの strings 部分）の場合
      if (Array.isArray(actualSql)) {
        // strings配列を結合してSQL文字列を構築
        let actualSqlString = "";
        for (let i = 0; i < actualSql.length; i++) {
          actualSqlString += actualSql[i];
          if (i < actualSql.length - 1) {
            actualSqlString += `$${i + 1}`;
          }
        }

        // SQL文字列を正規化
        actualSqlString = actualSqlString.replace(/\s+/g, " ").trim();

        // 期待されるSQL全文を構築
        const expectedSqlString = `
          SELECT id
          FROM "Notification" n
          WHERE $1 -- 結合したWHERE句を使用
          LIMIT 1
        `
          .replace(/\s+/g, " ")
          .trim();

        expect(actualSqlString).toStrictEqual(expectedSqlString);
      } else if (actualSql && typeof actualSql === "object" && "strings" in actualSql && "values" in actualSql) {
        // Prisma.Sqlオブジェクトのstringsとvaluesプロパティがある場合
        let actualSqlString = "";
        const strings = actualSql.strings;
        const values = actualSql.values;

        for (let i = 0; i < strings.length; i++) {
          actualSqlString += strings[i];
          if (i < values.length) {
            actualSqlString += `$${i + 1}`;
          }
        }

        actualSqlString = actualSqlString.replace(/\s+/g, " ").trim();

        const expectedSqlString = `
          SELECT id
          FROM "Notification" n
          WHERE (
          (n."target_type" = 'SYSTEM') OR
          (n."target_type" = 'USER' AND n."sender_user_id" = $1) OR
          (n."target_type" = 'GROUP' AND n."group_id" = ANY($2))
          OR (n."target_type" = 'TASK' AND n."task_id" = ANY($3))
        ) AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW())) AND (NOT (n."is_read" ? $4 AND (n."is_read" -> $5 ->> 'isRead')::boolean = TRUE)) -- 結合したWHERE句を使用
          LIMIT 1
        `
          .replace(/\s+/g, " ")
          .trim();

        expect(actualSqlString).toStrictEqual(expectedSqlString);
      } else {
        // オブジェクトの構造を詳細に確認
        throw new Error(`Expected Array or Prisma.Sql object, but got: ${JSON.stringify(actualSql, null, 2)}`);
      }
    });

    test("should generate correct SQL for different user with multiple groups and tasks", async () => {
      // Arrange
      const userId = "user-123";
      const mockResult = [{ id: "notification-1" }];

      // 複数のグループとタスクを含むcommonWhereClause
      const commonWhereClause = Prisma.sql`(
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = ${userId}) OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(${["group-1", "group-2"]}))
      OR (n."target_type" = 'TASK' AND n."task_id" = ANY(${["task-1", "task-2"]}))
    ) AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`;

      mockBuildCommonNotificationWhereClause.mockResolvedValue(commonWhereClause);
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      const actualCall = prismaMock.$queryRaw.mock.calls[0];
      const actualSql = actualCall[0];

      if (Array.isArray(actualSql)) {
        let actualSqlString = "";
        for (let i = 0; i < actualSql.length; i++) {
          actualSqlString += actualSql[i];
          if (i < actualSql.length - 1) {
            actualSqlString += `$${i + 1}`;
          }
        }

        actualSqlString = actualSqlString.replace(/\s+/g, " ").trim();

        const expectedSqlString = `
          SELECT id
          FROM "Notification" n
          WHERE $1 -- 結合したWHERE句を使用
          LIMIT 1
        `
          .replace(/\s+/g, " ")
          .trim();

        expect(actualSqlString).toStrictEqual(expectedSqlString);
      } else {
        throw new Error(`Expected Array, but got: ${JSON.stringify(actualSql, null, 2)}`);
      }
    });

    test("should generate correct SQL when no groups or tasks exist", async () => {
      // Arrange
      const userId = "user-no-groups";
      const mockResult: RawNotificationFromDB[] = [];

      // グループやタスクが存在しない場合のcommonWhereClause（ダミーIDを使用、タスク条件なし）
      const commonWhereClause = Prisma.sql`(
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = ${userId}) OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(${["00000000-0000-0000-0000-000000000000"]}))
    ) AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`;

      mockBuildCommonNotificationWhereClause.mockResolvedValue(commonWhereClause);
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      const actualCall = prismaMock.$queryRaw.mock.calls[0];
      const actualSql = actualCall[0];

      if (Array.isArray(actualSql)) {
        let actualSqlString = "";
        for (let i = 0; i < actualSql.length; i++) {
          actualSqlString += actualSql[i];
          if (i < actualSql.length - 1) {
            actualSqlString += `$${i + 1}`;
          }
        }

        actualSqlString = actualSqlString.replace(/\s+/g, " ").trim();

        const expectedSqlString = `
          SELECT id
          FROM "Notification" n
          WHERE $1 -- 結合したWHERE句を使用
          LIMIT 1
        `
          .replace(/\s+/g, " ")
          .trim();

        expect(actualSqlString).toStrictEqual(expectedSqlString);
      } else {
        throw new Error(`Expected Array, but got: ${JSON.stringify(actualSql, null, 2)}`);
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should return false when database query throws error", async () => {
      // Arrange
      const userId = "user-1";
      prismaMock.$queryRaw.mockRejectedValue(new Error("データベースエラー"));

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
    });

    test("should return false when buildCommonNotificationWhereClause throws error", async () => {
      // Arrange
      const userId = "user-1";
      mockBuildCommonNotificationWhereClause.mockRejectedValue(new Error("WHERE句構築エラー"));

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
    });

    test("should handle null result from database", async () => {
      // Arrange
      const userId = "user-1";
      prismaMock.$queryRaw.mockResolvedValue(null as unknown as RawNotificationFromDB[]);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
    });

    test("should handle undefined result from database", async () => {
      // Arrange
      const userId = "user-1";
      prismaMock.$queryRaw.mockResolvedValue(undefined as unknown as RawNotificationFromDB[]);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty user ID by early return", async () => {
      // Arrange
      const userId = "";

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      // 空のユーザーIDの場合は早期リターンでfalseが返される
      expect(result).toBe(false);
      // buildCommonNotificationWhereClauseは呼び出されない（早期リターンのため）
      expect(mockBuildCommonNotificationWhereClause).not.toHaveBeenCalled();
      // prisma.$queryRawも呼び出されない（早期リターンのため）
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
