import { unstable_cacheTag as cacheTag } from "next/cache";
import { buildCommonNotificationWhereClause } from "@/actions/notification/notification-utilities";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { AuctionEventType, NotificationTargetType, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { RawNotificationFromDB } from "./cache-notification-list";
import { cachedGetNotificationsAndUnreadCount } from "./cache-notification-list";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Prisma.sqlオブジェクトから完全なSQL文字列を生成する関数
 * @param strings SQL文字列の配列
 * @param values 値の配列
 * @returns 完全なSQL文字列
 */
function buildFullSqlString(strings: readonly string[], values: readonly unknown[]): string {
  let result = "";
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      const value = values[i];
      if (typeof value === "string") {
        result += `'${value}'`;
      } else {
        result += String(value);
      }
    }
  }
  return result
    .replace(/\s+/g, " ") // 連続する空白文字を単一スペースに変換
    .replace(/\n/g, " ") // 改行を単一スペースに変換
    .replace(/\t/g, " ") // タブを単一スペースに変換
    .trim();
}

/**
 * モックされたPrisma.$queryRawの呼び出し引数を型安全に取得する関数
 * @param callArgs prismaMock.$queryRaw.mock.calls[index]
 * @returns SQL文字列と値の配列
 */
function extractSqlFromMockCall(callArgs: readonly unknown[]): {
  strings: readonly string[];
  values: readonly unknown[];
} {
  const firstArg = callArgs[0];

  // 通知クエリの場合 (Prisma.sql` ... `形式)
  if (firstArg && typeof firstArg === "object" && "strings" in firstArg && "values" in firstArg) {
    return {
      strings: (firstArg as { strings: readonly string[] }).strings,
      values: (firstArg as { values: readonly unknown[] }).values,
    };
  }

  // カウントクエリの場合 (配列形式の場合もある)
  throw new Error("予期しないSQL呼び出し形式です");
}

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

// テストデータのファクトリー関数
function createMockRawNotificationFromDB(overrides: Partial<RawNotificationFromDB> = {}) {
  return {
    id: overrides.hasOwnProperty("id") ? overrides.id : "notification-1",
    title: overrides.hasOwnProperty("title") ? overrides.title : "テスト通知",
    message: overrides.hasOwnProperty("message") ? overrides.message : "テストメッセージ",
    NotificationTargetType: overrides.hasOwnProperty("NotificationTargetType")
      ? overrides.NotificationTargetType
      : NotificationTargetType.USER,
    isRead: overrides.hasOwnProperty("isRead") ? overrides.isRead : false,
    sentAt: overrides.hasOwnProperty("sentAt") ? overrides.sentAt : new Date("2024-01-01T00:00:00Z"),
    readAt: overrides.hasOwnProperty("readAt") ? overrides.readAt : null,
    expiresAt: overrides.hasOwnProperty("expiresAt") ? overrides.expiresAt : null,
    actionUrl: overrides.hasOwnProperty("actionUrl") ? overrides.actionUrl : "https://example.com",
    senderUserId: overrides.hasOwnProperty("senderUserId") ? overrides.senderUserId : "sender-1",
    groupId: overrides.hasOwnProperty("groupId") ? overrides.groupId : null,
    taskId: overrides.hasOwnProperty("taskId") ? overrides.taskId : null,
    auctionEventType: overrides.hasOwnProperty("auctionEventType") ? overrides.auctionEventType : null,
    auctionId: overrides.hasOwnProperty("auctionId") ? overrides.auctionId : null,
    userName: overrides.hasOwnProperty("userName") ? overrides.userName : "送信者名",
    groupName: overrides.hasOwnProperty("groupName") ? overrides.groupName : null,
    taskName: overrides.hasOwnProperty("taskName") ? overrides.taskName : null,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cachedGetNotificationsAndUnreadCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    const sql = Prisma.sql`(n."target_type" = 'USER' AND n."sender_user_id" = 'user-1') AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`;
    mockBuildCommonNotificationWhereClause.mockResolvedValue({
      success: true,
      message: "通知対象のユーザーIDを取得しました",
      data: sql,
    });
    mockCacheTag.mockReturnValue(undefined);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should return notifications and counts successfully", async () => {
      // Arrange
      const userId = "user-1";
      const page = 1;
      const limit = 20;

      const mockNotifications = [
        createMockRawNotificationFromDB({ id: "notification-1", isRead: false }),
        createMockRawNotificationFromDB({ id: "notification-2", isRead: true }),
      ];

      const mockUnreadCount = [{ count: BigInt(2) }];
      const mockTotalCount = [{ count: BigInt(2) }];

      // 通知取得クエリのモック（2回呼ばれる：未読と既読）
      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "通知リストを取得しました",
        data: {
          notifications: [
            {
              id: "notification-1",
              title: "テスト通知",
              message: "テストメッセージ",
              NotificationTargetType: NotificationTargetType.USER,
              isRead: false,
              sentAt: new Date("2024-01-01T00:00:00Z"),
              readAt: null,
              expiresAt: null,
              actionUrl: "https://example.com",
              senderUserId: "sender-1",
              groupId: null,
              taskId: null,
              auctionEventType: null,
              auctionId: null,
              userName: "送信者名",
              groupName: null,
              taskName: null,
            },
            {
              id: "notification-2",
              title: "テスト通知",
              message: "テストメッセージ",
              NotificationTargetType: NotificationTargetType.USER,
              isRead: true,
              sentAt: new Date("2024-01-01T00:00:00Z"),
              readAt: null,
              expiresAt: null,
              actionUrl: "https://example.com",
              senderUserId: "sender-1",
              groupId: null,
              taskId: null,
              auctionEventType: null,
              auctionId: null,
              userName: "送信者名",
              groupName: null,
              taskName: null,
            },
          ],
          totalCount: 2,
          unreadCount: 2,
          readCount: 0,
        },
      });

      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
      expect(mockCacheTag).toHaveBeenCalledWith(`notification:notificationByUserId:${userId}`);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(4);
    });

    test("should call prisma.$queryRaw with correct SQL statements", async () => {
      // Arrange
      const userId = "user-1";
      const page = 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      const mockNotifications = [createMockRawNotificationFromDB({ id: "notification-1", isRead: false })];
      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert - 各prisma.$queryRawの呼び出しでのSQL文をチェック
      expect(prismaMock.$queryRaw).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining("SELECT"),
            expect.stringContaining('FROM "Notification" n'),
            expect.stringContaining("WHERE"),
            expect.stringContaining("ORDER BY"),
            expect.stringContaining("LIMIT"),
          ]) as readonly string[],
          values: expect.arrayContaining([
            userId,
            userId,
            userId,
            userId,
            userId,
            userId,
            userId,
            limit,
            offset,
          ]) as readonly unknown[],
        }),
      );

      expect(prismaMock.$queryRaw).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining("SELECT"),
            expect.stringContaining('FROM "Notification" n'),
            expect.stringContaining("WHERE"),
            expect.stringContaining("ORDER BY"),
            expect.stringContaining("LIMIT"),
          ]) as readonly string[],
          values: expect.arrayContaining([
            userId,
            userId,
            userId,
            userId,
            userId,
            userId,
            userId,
            limit,
            offset,
          ]) as readonly unknown[],
        }),
      );

      // 3番目の呼び出し: 未読カウントクエリ - テンプレートリテラル形式
      expect(prismaMock.$queryRaw).toHaveBeenNthCalledWith(
        3,
        expect.any(Array) as readonly unknown[],
        expect.objectContaining({
          strings: expect.any(Array) as readonly string[],
          values: expect.arrayContaining([userId, userId]) as readonly unknown[],
        }),
      );

      // 4番目の呼び出し: 全体カウントクエリ - テンプレートリテラル形式
      // 実際のコードではPrisma.sqlオブジェクトが渡されるため、
      // テンプレートリテラル形式で期待値を設定
      expect(prismaMock.$queryRaw).toHaveBeenNthCalledWith(
        4,
        expect.any(Array) as readonly unknown[],
        expect.objectContaining({
          strings: expect.any(Array) as readonly string[],
          values: expect.any(Array) as readonly unknown[],
        }),
      );
    });

    test("should call prisma.$queryRaw with exact SQL strings using toStrictEqual", async () => {
      // Arrange
      const userId = "user-1";
      const page = 1;
      const limit = 20;

      const mockNotifications = [createMockRawNotificationFromDB({ id: "notification-1", isRead: false })];
      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert - SQL全文をtoStrictEqualでチェック
      // 1回目の呼び出し: 未読通知クエリ
      const firstCallArgs = prismaMock.$queryRaw.mock.calls[0] as readonly unknown[];
      const firstCallSqlData = extractSqlFromMockCall(firstCallArgs);
      const firstCallSql = buildFullSqlString(firstCallSqlData.strings, firstCallSqlData.values);
      let expectedFirstSql = `
          SELECT
            n.id,
            n.title,
            n.message,
            n."target_type" as "NotificationTargetType",
            CASE -- isRead を動的に設定
              WHEN n."is_read" ? 'user-1' AND (n."is_read" -> 'user-1' ->> 'isRead')::boolean = TRUE
              THEN TRUE
              ELSE FALSE
            END as "isRead",
            n."sent_at" as "sentAt",
            CASE -- readAt を動的に設定
              WHEN n."is_read" ? 'user-1' AND (n."is_read" -> 'user-1' ->> 'isRead')::boolean = TRUE
              THEN (n."is_read" -> 'user-1' ->> 'readAt')::timestamp
              ELSE null
            END as "readAt",
            n."expires_at" as "expiresAt",
            n."action_url" as "actionUrl",
            n."sender_user_id" as "senderUserId",
            n."group_id" as "groupId",
            n."task_id" as "taskId",
            n."auction_event_type" as "auctionEventType",
            n."auction_id" as "auctionId",
            u.name as "userName",
            g.name as "groupName",
            t.task as "taskName"
          FROM "Notification" n
          LEFT JOIN "User" u ON n."sender_user_id" = u.id
          LEFT JOIN "Group" g ON n."group_id" = g.id
          LEFT JOIN "Task" t ON n."task_id" = t.id
          WHERE (n."target_type" = 'USER' AND n."sender_user_id" = 'user-1') AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW())) AND (NOT (n."is_read" ? 'user-1' AND (n."is_read" -> 'user-1' ->> 'isRead')::boolean = TRUE))
          ORDER BY n."sent_at" DESC, n.id DESC
          LIMIT 20 OFFSET 0
      `;
      expectedFirstSql = expectedFirstSql
        .replace(/\s+/g, " ") // 連続する空白文字を単一スペースに変換
        .replace(/\n/g, " ") // 改行を単一スペースに変換
        .replace(/\t/g, " ") // タブを単一スペースに変換
        .trim();
      expect(firstCallSql).toStrictEqual(expectedFirstSql);

      // 2回目の呼び出し: 既読通知クエリ
      const secondCallArgs = prismaMock.$queryRaw.mock.calls[1] as readonly unknown[];
      const secondCallSqlData = extractSqlFromMockCall(secondCallArgs);
      const secondCallSql = buildFullSqlString(secondCallSqlData.strings, secondCallSqlData.values);
      let expectedSecondSql = `
          SELECT
            n.id,
            n.title,
            n.message,
            n."target_type" as "NotificationTargetType",
            CASE -- isRead を動的に設定
              WHEN n."is_read" ? 'user-1' AND (n."is_read" -> 'user-1' ->> 'isRead')::boolean = TRUE
              THEN TRUE
              ELSE FALSE
            END as "isRead",
            n."sent_at" as "sentAt",
            CASE -- readAt を動的に設定
              WHEN n."is_read" ? 'user-1' AND (n."is_read" -> 'user-1' ->> 'isRead')::boolean = TRUE
              THEN (n."is_read" -> 'user-1' ->> 'readAt')::timestamp
              ELSE null
            END as "readAt",
            n."expires_at" as "expiresAt",
            n."action_url" as "actionUrl",
            n."sender_user_id" as "senderUserId",
            n."group_id" as "groupId",
            n."task_id" as "taskId",
            n."auction_event_type" as "auctionEventType",
            n."auction_id" as "auctionId",
            u.name as "userName",
            g.name as "groupName",
            t.task as "taskName"
          FROM "Notification" n
          LEFT JOIN "User" u ON n."sender_user_id" = u.id
          LEFT JOIN "Group" g ON n."group_id" = g.id
          LEFT JOIN "Task" t ON n."task_id" = t.id
          WHERE (n."target_type" = 'USER' AND n."sender_user_id" = 'user-1') AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW())) AND (n."is_read" ? 'user-1' AND (n."is_read" -> 'user-1' ->> 'isRead')::boolean = TRUE)
          ORDER BY n."sent_at" DESC, n.id DESC
          LIMIT 20 OFFSET 0
      `;
      expectedSecondSql = expectedSecondSql
        .replace(/\s+/g, " ") // 連続する空白文字を単一スペースに変換
        .replace(/\n/g, " ") // 改行を単一スペースに変換
        .replace(/\t/g, " ") // タブを単一スペースに変換
        .trim();
      expect(secondCallSql).toStrictEqual(expectedSecondSql);
    });

    test("should handle empty notifications list", async () => {
      // Arrange
      const userId = "user-1";
      const mockUnreadCount = [{ count: BigInt(0) }];
      const mockTotalCount = [{ count: BigInt(0) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "通知リストを取得しました",
        data: {
          notifications: [],
          totalCount: 0,
          unreadCount: 0,
          readCount: 0,
        },
      });
    });

    test("should handle pagination correctly", async () => {
      // Arrange
      const userId = "user-1";
      const page = 2;
      const limit = 5;

      const mockNotifications = [createMockRawNotificationFromDB({ id: "notification-6" })];

      const mockUnreadCount = [{ count: BigInt(3) }];
      const mockTotalCount = [{ count: BigInt(10) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result.data.notifications).toHaveLength(1);
      expect(result.data.totalCount).toBe(10);
      expect(result.data.unreadCount).toBe(3);
      expect(result.data.readCount).toBe(7);
    });

    test("should handle notifications with all fields populated", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [
        createMockRawNotificationFromDB({
          id: "notification-1",
          title: "完全な通知",
          message: "すべてのフィールドが設定された通知",
          NotificationTargetType: NotificationTargetType.GROUP,
          isRead: true,
          sentAt: new Date("2024-01-01T10:00:00Z"),
          readAt: new Date("2024-01-01T11:00:00Z"),
          expiresAt: new Date("2024-12-31T23:59:59Z"),
          actionUrl: "https://example.com/action",
          senderUserId: "sender-1",
          groupId: "group-1",
          taskId: "task-1",
          auctionEventType: "AUCTION_WIN",
          auctionId: "auction-1",
          userName: "送信者名",
          groupName: "テストグループ",
          taskName: "テストタスク",
        }),
      ];

      const mockUnreadCount = [{ count: BigInt(0) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.data.notifications[0]).toStrictEqual({
        id: "notification-1",
        title: "完全な通知",
        message: "すべてのフィールドが設定された通知",
        NotificationTargetType: NotificationTargetType.GROUP,
        isRead: true,
        sentAt: new Date("2024-01-01T10:00:00Z"),
        readAt: new Date("2024-01-01T11:00:00Z"),
        expiresAt: new Date("2024-12-31T23:59:59Z"),
        actionUrl: "https://example.com/action",
        senderUserId: "sender-1",
        groupId: "group-1",
        taskId: "task-1",
        auctionEventType: AuctionEventType.AUCTION_WIN,
        auctionId: "auction-1",
        userName: "送信者名",
        groupName: "テストグループ",
        taskName: "テストタスク",
      });
    });

    test("should handle notifications with null/empty fields", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [
        createMockRawNotificationFromDB({
          id: "notification-1",
          title: null,
          message: null,
          actionUrl: null,
          senderUserId: null,
          groupId: null,
          taskId: null,
          auctionEventType: null,
          auctionId: null,
          userName: null,
          groupName: null,
          taskName: null,
          sentAt: null,
          readAt: null,
          expiresAt: null,
        }),
      ];

      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.data.notifications[0]).toStrictEqual({
        id: "notification-1",
        title: "",
        message: "",
        NotificationTargetType: NotificationTargetType.USER,
        isRead: false,
        sentAt: null,
        readAt: null,
        expiresAt: null,
        actionUrl: null,
        senderUserId: null,
        groupId: null,
        taskId: null,
        auctionEventType: null,
        auctionId: null,
        userName: null,
        groupName: null,
        taskName: null,
      });
    });

    test("should handle duplicate notifications correctly", async () => {
      // Arrange
      const userId = "user-1";
      const duplicateNotification = createMockRawNotificationFromDB({ id: "notification-1" });
      const mockNotifications = [duplicateNotification, duplicateNotification];

      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知（重複あり）
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.data.notifications).toHaveLength(1); // 重複が除去されている
      expect(result.data.notifications[0].id).toBe("notification-1");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should return empty result when database query throws error", async () => {
      // Arrange
      const userId = "user-1";

      // buildCommonNotificationWhereClauseがエラーを返す場合をテスト
      mockBuildCommonNotificationWhereClause.mockRejectedValue(new Error("データベースエラー"));

      // Act & Assert
      await expect(cachedGetNotificationsAndUnreadCount(userId)).rejects.toThrow("データベースエラー");
    });

    test("should return empty result when buildCommonNotificationWhereClause throws error", async () => {
      // Arrange
      const userId = "user-1";
      mockBuildCommonNotificationWhereClause.mockRejectedValue(new Error("WHERE句構築エラー"));

      // Act & Assert
      await expect(cachedGetNotificationsAndUnreadCount(userId)).rejects.toThrow("WHERE句構築エラー");
    });

    test("should handle null count results", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [createMockRawNotificationFromDB()];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce([]) // 未読カウント（空配列）
        .mockResolvedValueOnce([{ count: null }]); // 総カウント（null）

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.data.unreadCount).toBe(0);
      expect(result.data.totalCount).toBe(0);
      expect(result.data.readCount).toBe(0);
    });

    test("should handle non-array result from database", async () => {
      // Arrange
      const userId = "user-1";

      prismaMock.$queryRaw
        .mockResolvedValueOnce(null as unknown as RawNotificationFromDB[]) // 未読通知（null）
        .mockResolvedValueOnce(undefined as unknown as RawNotificationFromDB[]) // 既読通知（undefined）
        .mockResolvedValueOnce([{ count: BigInt(0) }]) // 未読カウント
        .mockResolvedValueOnce([{ count: BigInt(0) }]); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.data.notifications).toStrictEqual([]);
      expect(result.data.totalCount).toBe(0);
      expect(result.data.unreadCount).toBe(0);
      expect(result.data.readCount).toBe(0);
    });

    test.each([
      { page: 0, limit: 20, userId: "user-1" },
      { page: -1, limit: 20, userId: "user-1" },
      { page: null as unknown as number, limit: 20, userId: "user-1" },
      { page: 1, limit: -1, userId: "user-1" },
      { page: 1, limit: 0, userId: "user-1" },
      { page: 1, limit: null as unknown as number, userId: "user-1" },
      { page: 1, limit: 20, userId: "" },
      { page: 1, limit: 20, userId: null as unknown as string },
      { page: 1, limit: 20, userId: undefined as unknown as string },
    ])(
      "should handle invalid parameters: page $page, limit $limit, userId $userId",
      async ({ page, limit, userId }) => {
        // Act & Assert
        await expect(cachedGetNotificationsAndUnreadCount(userId, page, limit)).rejects.toThrow("Invalid parameters");
      },
    );

    test("should handle undefined limit parameter", async () => {
      // Act & Assert
      await expect(cachedGetNotificationsAndUnreadCount("user-1", 1, undefined as unknown as number)).rejects.toThrow();
    });

    test("should handle default parameters", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [createMockRawNotificationFromDB()];
      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act - pageとlimitを指定しない
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.data.notifications).toHaveLength(1);
      expect(result.data.totalCount).toBe(1);
      expect(result.data.unreadCount).toBe(1);
      expect(result.data.readCount).toBe(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("引数パターンテスト", () => {
    test("should handle all NotificationTargetType values", async () => {
      // Arrange
      const userId = "user-1";
      const targetTypes = [
        NotificationTargetType.USER,
        NotificationTargetType.GROUP,
        NotificationTargetType.TASK,
        NotificationTargetType.SYSTEM,
      ];

      for (const targetType of targetTypes) {
        const mockNotifications = [createMockRawNotificationFromDB({ NotificationTargetType: targetType })];
        const mockUnreadCount = [{ count: BigInt(1) }];
        const mockTotalCount = [{ count: BigInt(1) }];

        prismaMock.$queryRaw
          .mockResolvedValueOnce(mockNotifications) // 未読通知
          .mockResolvedValueOnce([]) // 既読通知
          .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
          .mockResolvedValueOnce(mockTotalCount); // 総カウント

        // Act
        const result = await cachedGetNotificationsAndUnreadCount(userId);

        // Assert
        expect(result.data.notifications[0].NotificationTargetType).toBe(targetType);

        // モックをリセット
        vi.clearAllMocks();
        const sql = Prisma.sql`(n."target_type" = 'USER' AND n."sender_user_id" = 'user-1') AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`;
        mockBuildCommonNotificationWhereClause.mockResolvedValue({
          success: true,
          message: "通知対象のユーザーIDを取得しました",
          data: sql,
        });
      }
    });

    test("should handle all AuctionEventType values", async () => {
      // Arrange
      const userId = "user-1";
      const auctionEventTypes = Object.values(AuctionEventType);

      for (const eventType of auctionEventTypes) {
        const mockNotifications = [createMockRawNotificationFromDB({ auctionEventType: eventType })];
        const mockUnreadCount = [{ count: BigInt(1) }];
        const mockTotalCount = [{ count: BigInt(1) }];

        prismaMock.$queryRaw
          .mockResolvedValueOnce(mockNotifications) // 未読通知
          .mockResolvedValueOnce([]) // 既読通知
          .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
          .mockResolvedValueOnce(mockTotalCount); // 総カウント

        // Act
        const result = await cachedGetNotificationsAndUnreadCount(userId);

        // Assert
        expect(result.data.notifications[0].auctionEventType).toBe(eventType);

        // モックをリセット
        vi.clearAllMocks();
        const sql = Prisma.sql`(n."target_type" = 'USER' AND n."sender_user_id" = 'user-1') AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`;
        mockBuildCommonNotificationWhereClause.mockResolvedValue({
          success: true,
          message: "通知対象のユーザーIDを取得しました",
          data: sql,
        });
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("複合条件テスト", () => {
    test("should handle mixed read and unread notifications", async () => {
      // Arrange
      const userId = "user-1";
      const unreadNotifications = [
        createMockRawNotificationFromDB({ id: "notification-1", isRead: false }),
        createMockRawNotificationFromDB({ id: "notification-2", isRead: false }),
      ];
      const readNotifications = [createMockRawNotificationFromDB({ id: "notification-3", isRead: true })];

      const mockUnreadCount = [{ count: BigInt(2) }];
      const mockTotalCount = [{ count: BigInt(3) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(unreadNotifications) // 未読通知
        .mockResolvedValueOnce(readNotifications) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "通知リストを取得しました",
        data: {
          notifications: [
            {
              id: "notification-1",
              title: "テスト通知",
              message: "テストメッセージ",
              NotificationTargetType: NotificationTargetType.USER,
              isRead: false,
              sentAt: new Date("2024-01-01T00:00:00Z"),
              readAt: null,
              expiresAt: null,
              actionUrl: "https://example.com",
              senderUserId: "sender-1",
              groupId: null,
              taskId: null,
              auctionEventType: null,
              auctionId: null,
              userName: "送信者名",
              groupName: null,
              taskName: null,
            },
            {
              id: "notification-2",
              title: "テスト通知",
              message: "テストメッセージ",
              NotificationTargetType: NotificationTargetType.USER,
              isRead: false,
              sentAt: new Date("2024-01-01T00:00:00Z"),
              readAt: null,
              expiresAt: null,
              actionUrl: "https://example.com",
              senderUserId: "sender-1",
              groupId: null,
              taskId: null,
              auctionEventType: null,
              auctionId: null,
              userName: "送信者名",
              groupName: null,
              taskName: null,
            },
            {
              id: "notification-3",
              title: "テスト通知",
              message: "テストメッセージ",
              NotificationTargetType: NotificationTargetType.USER,
              isRead: true,
              sentAt: new Date("2024-01-01T00:00:00Z"),
              readAt: null,
              expiresAt: null,
              actionUrl: "https://example.com",
              senderUserId: "sender-1",
              groupId: null,
              taskId: null,
              auctionEventType: null,
              auctionId: null,
              userName: "送信者名",
              groupName: null,
              taskName: null,
            },
          ],
          totalCount: 3,
          unreadCount: 2,
          readCount: 1,
        },
      });
    });

    test("should handle large dataset with pagination", async () => {
      // Arrange
      const userId = "user-1";
      const page = 5;
      const limit = 50;

      const mockNotifications = Array.from({ length: 50 }, (_, i) =>
        createMockRawNotificationFromDB({ id: `notification-${200 + i}` }),
      );
      const mockUnreadCount = [{ count: BigInt(150) }];
      const mockTotalCount = [{ count: BigInt(500) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "通知リストを取得しました",
        data: {
          notifications: mockNotifications,
          totalCount: 500,
          unreadCount: 150,
          readCount: 350,
        },
      });
      expect(result.data.notifications).toHaveLength(50);
    });
  });
});
