// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数のインポート
import { cachedGetNotificationsAndUnreadCount } from "@/actions/notification/cache-notification-list";
import { cachedGetUnreadNotificationsCount } from "@/actions/notification/cache-notification-unread-count";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { NotificationTargetType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildCommonNotificationWhereClause,
  getNotificationsAndUnreadCount,
  getNotificationTargetUserIds,
  getUnreadNotificationsCount,
  updateNotificationStatus,
} from "./notification-utilities";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// SQL検証用のヘルパー関数

/**
 * SQL文字列を正規化する関数（空白文字の統一）
 * @param sqlString 正規化対象のSQL文字列
 * @returns 正規化されたSQL文字列
 */
function normalizeSqlString(sqlString: string): string {
  return sqlString
    .replace(/\s+/g, " ") // 連続する空白文字を単一スペースに変換
    .replace(/\n/g, " ") // 改行を単一スペースに変換
    .replace(/\t/g, " ") // タブを単一スペースに変換
    .trim(); // 前後の空白を除去
}

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
      } else if (Array.isArray(value)) {
        result += `ARRAY[${value.map((v) => (typeof v === "string" ? `'${v}'` : String(v))).join(",")}]`;
      } else {
        result += String(value);
      }
    }
  }
  return normalizeSqlString(result);
}

/**
 * モックされたPrisma.$executeRawの呼び出し引数からSQL情報を抽出する関数
 * @param callArgs prismaMock.$executeRaw.mock.calls[index]
 * @returns SQL文字列と値の配列、またはnull（抽出できない場合）
 */
function extractSqlFromExecuteRawCall(
  callArgs: unknown[],
): { strings: readonly string[]; values: readonly unknown[] } | null {
  const firstArg = callArgs[0];

  // 配列形式の場合（Prismaのテンプレートリテラル）
  if (Array.isArray(firstArg)) {
    // 配列の最初の要素がstrings配列、残りの引数がvalues
    const strings = firstArg as readonly string[];
    const values = callArgs.slice(1) as readonly unknown[];

    return { strings, values };
  }

  // Prisma.sql`...`形式の場合
  if (firstArg && typeof firstArg === "object" && "strings" in firstArg && "values" in firstArg) {
    return {
      strings: (firstArg as { strings: readonly string[] }).strings,
      values: (firstArg as { values: readonly unknown[] }).values,
    };
  }

  return null;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 依存関数のモック
vi.mock("@/actions/notification/cache-notification-list", () => ({
  cachedGetNotificationsAndUnreadCount: vi.fn(),
}));

vi.mock("@/actions/notification/cache-notification-unread-count", () => ({
  cachedGetUnreadNotificationsCount: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数の型定義
const mockCachedGetUnreadNotificationsCount = vi.mocked(cachedGetUnreadNotificationsCount);
const mockCachedGetNotificationsAndUnreadCount = vi.mocked(cachedGetNotificationsAndUnreadCount);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 共通テストデータ
const TEST_DATA = {
  userIds: {
    user1: "test-user-1",
    user2: "test-user-2",
    user3: "test-user-3",
  },
  groupIds: {
    group1: "test-group-1",
    group2: "test-group-2",
  },
  taskIds: {
    task1: "test-task-1",
    task2: "test-task-2",
  },
  notificationIds: {
    notification1: "test-notification-1",
    notification2: "test-notification-2",
  },
} as const;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テストヘルパー関数
const createMockNotification = (overrides = {}) => ({
  id: TEST_DATA.notificationIds.notification1,
  title: "テスト通知",
  message: "テストメッセージ",
  NotificationTargetType: NotificationTargetType.USER,
  isRead: false,
  sentAt: new Date(),
  readAt: null,
  expiresAt: null,
  actionUrl: null,
  senderUserId: null,
  groupId: null,
  taskId: null,
  userName: null,
  groupName: null,
  taskName: null,
  auctionEventType: null,
  auctionId: null,
  ...overrides,
});

const createMockTask = (overrides = {}) => ({
  creatorId: TEST_DATA.userIds.user1,
  groupId: TEST_DATA.groupIds.group1,
  reporters: [{ userId: TEST_DATA.userIds.user2 }],
  executors: [{ userId: TEST_DATA.userIds.user3 }],
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("notification-utilities", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUnreadNotificationsCount", () => {
    const userId = TEST_DATA.userIds.user1;

    test.each([
      { hasUnread: true, expected: true, description: "未読通知がある場合はtrueを返す" },
      { hasUnread: false, expected: false, description: "未読通知がない場合はfalseを返す" },
    ])("$description", async ({ hasUnread, expected }) => {
      // Arrange
      mockCachedGetUnreadNotificationsCount.mockResolvedValue(hasUnread);

      // Act
      const result = await getUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(expected);
      expect(mockCachedGetUnreadNotificationsCount).toHaveBeenCalledWith(userId);
    });

    test("キャッシュ関数でエラーが発生した場合はエラーを再スローする", async () => {
      // Arrange
      const errorMessage = "キャッシュエラー";
      mockCachedGetUnreadNotificationsCount.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(getUnreadNotificationsCount(userId)).rejects.toThrow(errorMessage);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getNotificationsAndUnreadCount", () => {
    const userId = TEST_DATA.userIds.user1;
    const page = 1;
    const limit = 20;

    test("通知データと未読数を正常に取得する", async () => {
      // Arrange
      const mockNotifications = [createMockNotification()];
      const mockResult = {
        notifications: mockNotifications,
        totalCount: 1,
        unreadCount: 1,
        readCount: 0,
      };
      mockCachedGetNotificationsAndUnreadCount.mockResolvedValue(mockResult);

      // Act
      const result = await getNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result).toStrictEqual(mockResult);
      expect(mockCachedGetNotificationsAndUnreadCount).toHaveBeenCalledWith(userId, page, limit);
    });

    test("キャッシュ関数でエラーが発生した場合はエラーを再スローする", async () => {
      // Arrange
      const errorMessage = "データベースエラー";
      mockCachedGetNotificationsAndUnreadCount.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(getNotificationsAndUnreadCount(userId, page, limit)).rejects.toThrow(errorMessage);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateNotificationStatus", () => {
    const userId = TEST_DATA.userIds.user1;

    test.each([
      {
        description: "通知ステータスを正常に更新する",
        updates: [
          { notificationId: TEST_DATA.notificationIds.notification1, isRead: true },
          { notificationId: TEST_DATA.notificationIds.notification2, isRead: false },
        ],
      },
      {
        description: "空の更新配列を処理する",
        updates: [],
      },
    ])("$description", async ({ updates }) => {
      // Arrange
      const mockTransaction = vi
        .fn()
        .mockImplementation(async (callback: (tx: { $executeRaw: () => Promise<void> }) => Promise<unknown>) => {
          return await callback({
            $executeRaw: vi.fn().mockResolvedValue(undefined),
          });
        });
      prismaMock.$transaction.mockImplementation(mockTransaction);

      // Act
      const result = await updateNotificationStatus(updates, userId);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    test("トランザクションが失敗した場合はエラーレスポンスを返す", async () => {
      // Arrange
      const updates = [{ notificationId: TEST_DATA.notificationIds.notification1, isRead: true }];
      prismaMock.$transaction.mockRejectedValue(new Error("トランザクションエラー"));

      // Act
      const result = await updateNotificationStatus(updates, userId);

      // Assert
      expect(result).toStrictEqual({ success: false });
    });

    describe("SQL全文検証テスト", () => {
      test("既読にする場合のSQL文をtoStrictEqualで検証する", async () => {
        // Arrange
        const updates = [{ notificationId: TEST_DATA.notificationIds.notification1, isRead: true }];

        // 固定の日時を設定（テストの再現性のため）
        const fixedDate = new Date("2024-01-01T12:00:00.000Z");
        const mockDateSpy = vi.spyOn(global, "Date").mockImplementation(() => fixedDate);

        const mockExecuteRaw = vi.fn().mockResolvedValue(undefined);
        const mockTransaction = {
          $executeRaw: mockExecuteRaw,
        };
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
        });

        // Act
        await updateNotificationStatus(updates, userId);

        // Assert
        expect(mockExecuteRaw).toHaveBeenCalledTimes(1);

        // Prismaの$executeRawは、テンプレートリテラル形式で呼び出される
        // 実際の呼び出しを検証する
        const actualCall = mockExecuteRaw.mock.calls[0];
        expect(actualCall).toBeDefined();
        expect(actualCall.length).toBeGreaterThan(0);

        // SQL引数を抽出
        const sqlData = extractSqlFromExecuteRawCall(actualCall);
        expect(sqlData).not.toBeNull();

        if (sqlData) {
          // SQL文字列を再構築
          const actualSql = buildFullSqlString(sqlData.strings, sqlData.values);
          const expectedSql = normalizeSqlString(`
            UPDATE "Notification"
            SET "is_read" = COALESCE("is_read", '{}'::jsonb) || jsonb_build_object('${userId}', jsonb_build_object('isRead', true, 'readAt', '${fixedDate.toISOString()}'))
            WHERE id = '${TEST_DATA.notificationIds.notification1}'
          `);

          expect(actualSql).toStrictEqual(expectedSql);
        }

        // モックを復元
        mockDateSpy.mockRestore();
      });

      test("未読にする場合のSQL文をtoStrictEqualで検証する", async () => {
        // Arrange
        const updates = [{ notificationId: TEST_DATA.notificationIds.notification1, isRead: false }];

        const mockExecuteRaw = vi.fn().mockResolvedValue(undefined);
        const mockTransaction = {
          $executeRaw: mockExecuteRaw,
        };
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
        });

        // Act
        await updateNotificationStatus(updates, userId);

        // Assert
        expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
        const actualCall = mockExecuteRaw.mock.calls[0];
        const sqlData = extractSqlFromExecuteRawCall(actualCall);

        expect(sqlData).not.toBeNull();
        if (sqlData) {
          const actualSql = buildFullSqlString(sqlData.strings, sqlData.values);
          const expectedSql = normalizeSqlString(`
            UPDATE "Notification"
            SET "is_read" = COALESCE("is_read", '{}'::jsonb) || jsonb_build_object('${userId}', jsonb_build_object('isRead', false))
            WHERE id = '${TEST_DATA.notificationIds.notification1}'
          `);

          expect(actualSql).toStrictEqual(expectedSql);
        }
      });

      test("複数の更新（既読・未読混在）の場合のSQL文をtoStrictEqualで検証する", async () => {
        // Arrange
        const updates = [
          { notificationId: TEST_DATA.notificationIds.notification1, isRead: true },
          { notificationId: TEST_DATA.notificationIds.notification2, isRead: false },
        ];

        // 固定の日時を設定（テストの再現性のため）
        const fixedDate = new Date("2024-01-01T12:00:00.000Z");
        const mockDateSpy = vi.spyOn(global, "Date").mockImplementation(() => fixedDate);

        const mockExecuteRaw = vi.fn().mockResolvedValue(undefined);
        const mockTransaction = {
          $executeRaw: mockExecuteRaw,
        };
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
        });

        // Act
        await updateNotificationStatus(updates, userId);

        // Assert
        expect(mockExecuteRaw).toHaveBeenCalledTimes(2);

        // 1回目の呼び出し: 既読にする場合
        const firstCall = mockExecuteRaw.mock.calls[0];
        const firstSqlData = extractSqlFromExecuteRawCall(firstCall);
        expect(firstSqlData).not.toBeNull();
        if (firstSqlData) {
          const firstActualSql = buildFullSqlString(firstSqlData.strings, firstSqlData.values);
          const firstExpectedSql = normalizeSqlString(`
            UPDATE "Notification"
            SET "is_read" = COALESCE("is_read", '{}'::jsonb) || jsonb_build_object('${userId}', jsonb_build_object('isRead', true, 'readAt', '${fixedDate.toISOString()}'))
            WHERE id = '${TEST_DATA.notificationIds.notification1}'
          `);
          expect(firstActualSql).toStrictEqual(firstExpectedSql);
        }

        // 2回目の呼び出し: 未読にする場合
        const secondCall = mockExecuteRaw.mock.calls[1];
        const secondSqlData = extractSqlFromExecuteRawCall(secondCall);
        expect(secondSqlData).not.toBeNull();
        if (secondSqlData) {
          const secondActualSql = buildFullSqlString(secondSqlData.strings, secondSqlData.values);
          const secondExpectedSql = normalizeSqlString(`
            UPDATE "Notification"
            SET "is_read" = COALESCE("is_read", '{}'::jsonb) || jsonb_build_object('${userId}', jsonb_build_object('isRead', false))
            WHERE id = '${TEST_DATA.notificationIds.notification2}'
          `);
          expect(secondActualSql).toStrictEqual(secondExpectedSql);
        }

        // モックを復元
        mockDateSpy.mockRestore();
      });

      test("不正な更新データがある場合のエラーハンドリングを確認する", async () => {
        // Arrange
        const updates = [
          { notificationId: "", isRead: true }, // 不正な通知ID
        ];
        const mockExecuteRaw = vi.fn().mockResolvedValue(undefined);
        const mockTransaction = {
          $executeRaw: mockExecuteRaw,
        };
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
        });

        // Act
        const result = await updateNotificationStatus(updates, userId);

        // Assert
        expect(result).toStrictEqual({ success: false });
        expect(mockExecuteRaw).not.toHaveBeenCalled();
      });

      test("空の更新データでSQL実行されないことを確認する", async () => {
        // Arrange
        const updates: Array<{ notificationId: string; isRead: boolean }> = [];

        const mockExecuteRaw = vi.fn().mockResolvedValue(undefined);
        const mockTransaction = {
          $executeRaw: mockExecuteRaw,
        };
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
        });

        // Act
        const result = await updateNotificationStatus(updates, userId);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockExecuteRaw).not.toHaveBeenCalled();
      });

      test("同じ通知IDに対する複数の更新が正しいSQL文を生成することを確認する", async () => {
        // Arrange
        const updates = [
          { notificationId: TEST_DATA.notificationIds.notification1, isRead: true },
          { notificationId: TEST_DATA.notificationIds.notification1, isRead: false },
        ];

        // 固定の日時を設定（テストの再現性のため）
        const fixedDate = new Date("2024-01-01T12:00:00.000Z");
        const mockDateSpy = vi.spyOn(global, "Date").mockImplementation(() => fixedDate);

        const mockExecuteRaw = vi.fn().mockResolvedValue(undefined);
        const mockTransaction = {
          $executeRaw: mockExecuteRaw,
        };
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
        });

        // Act
        await updateNotificationStatus(updates, userId);

        // Assert
        expect(mockExecuteRaw).toHaveBeenCalledTimes(2);

        // 1回目の呼び出し: 既読にする場合
        const firstCall = mockExecuteRaw.mock.calls[0];
        const firstSqlData = extractSqlFromExecuteRawCall(firstCall);
        expect(firstSqlData).not.toBeNull();
        if (firstSqlData) {
          const firstActualSql = buildFullSqlString(firstSqlData.strings, firstSqlData.values);
          const firstExpectedSql = normalizeSqlString(`
            UPDATE "Notification"
            SET "is_read" = COALESCE("is_read", '{}'::jsonb) || jsonb_build_object('${userId}', jsonb_build_object('isRead', true, 'readAt', '${fixedDate.toISOString()}'))
            WHERE id = '${TEST_DATA.notificationIds.notification1}'
          `);
          expect(firstActualSql).toStrictEqual(firstExpectedSql);
        }

        // 2回目の呼び出し: 未読にする場合（同じ通知ID）
        const secondCall = mockExecuteRaw.mock.calls[1];
        const secondSqlData = extractSqlFromExecuteRawCall(secondCall);
        expect(secondSqlData).not.toBeNull();
        if (secondSqlData) {
          const secondActualSql = buildFullSqlString(secondSqlData.strings, secondSqlData.values);
          const secondExpectedSql = normalizeSqlString(`
            UPDATE "Notification"
            SET "is_read" = COALESCE("is_read", '{}'::jsonb) || jsonb_build_object('${userId}', jsonb_build_object('isRead', false))
            WHERE id = '${TEST_DATA.notificationIds.notification1}'
          `);
          expect(secondActualSql).toStrictEqual(secondExpectedSql);
        }

        // モックを復元
        mockDateSpy.mockRestore();
      });

      test("複数の異なる通知IDの既読更新SQL文を検証する", async () => {
        // Arrange
        const updates = [
          { notificationId: TEST_DATA.notificationIds.notification1, isRead: true },
          { notificationId: TEST_DATA.notificationIds.notification2, isRead: true },
        ];

        // 固定の日時を設定（テストの再現性のため）
        const fixedDate = new Date("2024-01-01T12:00:00.000Z");
        const mockDateSpy = vi.spyOn(global, "Date").mockImplementation(() => fixedDate);

        const mockExecuteRaw = vi.fn().mockResolvedValue(undefined);
        const mockTransaction = {
          $executeRaw: mockExecuteRaw,
        };
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
        });

        // Act
        await updateNotificationStatus(updates, userId);

        // Assert
        expect(mockExecuteRaw).toHaveBeenCalledTimes(2);

        // 1回目の呼び出し
        const firstCall = mockExecuteRaw.mock.calls[0];
        const firstSqlData = extractSqlFromExecuteRawCall(firstCall);
        expect(firstSqlData).not.toBeNull();
        if (firstSqlData) {
          const firstActualSql = buildFullSqlString(firstSqlData.strings, firstSqlData.values);
          const firstExpectedSql = normalizeSqlString(`
            UPDATE "Notification"
            SET "is_read" = COALESCE("is_read", '{}'::jsonb) || jsonb_build_object('${userId}', jsonb_build_object('isRead', true, 'readAt', '${fixedDate.toISOString()}'))
            WHERE id = '${TEST_DATA.notificationIds.notification1}'
          `);
          expect(firstActualSql).toStrictEqual(firstExpectedSql);
        }

        // 2回目の呼び出し
        const secondCall = mockExecuteRaw.mock.calls[1];
        const secondSqlData = extractSqlFromExecuteRawCall(secondCall);
        expect(secondSqlData).not.toBeNull();
        if (secondSqlData) {
          const secondActualSql = buildFullSqlString(secondSqlData.strings, secondSqlData.values);
          const secondExpectedSql = normalizeSqlString(`
            UPDATE "Notification"
            SET "is_read" = COALESCE("is_read", '{}'::jsonb) || jsonb_build_object('${userId}', jsonb_build_object('isRead', true, 'readAt', '${fixedDate.toISOString()}'))
            WHERE id = '${TEST_DATA.notificationIds.notification2}'
          `);
          expect(secondActualSql).toStrictEqual(secondExpectedSql);
        }

        // モックを復元
        mockDateSpy.mockRestore();
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getNotificationTargetUserIds", () => {
    describe("正常系テスト", () => {
      test("SYSTEM対象タイプの場合は全ユーザーIDを返す", async () => {
        // Arrange
        const targetType = NotificationTargetType.SYSTEM;
        const params = {};
        const mockUsers = [
          { id: TEST_DATA.userIds.user1 },
          { id: TEST_DATA.userIds.user2 },
          { id: TEST_DATA.userIds.user3 },
        ];
        prismaMock.user.findMany.mockResolvedValue(
          mockUsers as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>,
        );

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual([TEST_DATA.userIds.user1, TEST_DATA.userIds.user2, TEST_DATA.userIds.user3]);
        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
          select: { id: true },
        });
      });

      test("USER対象タイプの場合は指定されたユーザーIDを返す", async () => {
        // Arrange
        const targetType = NotificationTargetType.USER;
        const userIds = [TEST_DATA.userIds.user1, TEST_DATA.userIds.user2];
        const params = { userIds };

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual(userIds);
      });

      test("GROUP対象タイプの場合はグループメンバーIDを返す", async () => {
        // Arrange
        const targetType = NotificationTargetType.GROUP;
        const params = { groupId: TEST_DATA.groupIds.group1 };
        const mockGroupMembers = [{ userId: TEST_DATA.userIds.user1 }, { userId: TEST_DATA.userIds.user2 }];
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual([TEST_DATA.userIds.user1, TEST_DATA.userIds.user2]);
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { groupId: TEST_DATA.groupIds.group1 },
          select: { userId: true },
        });
      });

      test("TASK対象タイプの場合はタスク関連ユーザーIDを返す", async () => {
        // Arrange
        const targetType = NotificationTargetType.TASK;
        const params = { taskId: TEST_DATA.taskIds.task1 };
        const mockTask = createMockTask({
          reporters: [
            { userId: TEST_DATA.userIds.user2 },
            { userId: null }, // 未登録ユーザーは除外される
          ],
          executors: [
            { userId: TEST_DATA.userIds.user3 },
            { userId: null }, // 未登録ユーザーは除外される
          ],
        });
        const mockGroupMembers = [{ userId: TEST_DATA.userIds.user1 }, { userId: TEST_DATA.userIds.user2 }];

        prismaMock.task.findUnique.mockResolvedValue(
          mockTask as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        // 重複を除去して返される
        expect(result).toStrictEqual([TEST_DATA.userIds.user1, TEST_DATA.userIds.user2, TEST_DATA.userIds.user3]);
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: TEST_DATA.taskIds.task1 },
          select: {
            creatorId: true,
            groupId: true,
            reporters: {
              select: {
                userId: true,
              },
            },
            executors: {
              select: {
                userId: true,
              },
            },
          },
        });
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { groupId: TEST_DATA.groupIds.group1 },
          select: { userId: true },
        });
      });

      test("TASK対象タイプでタスクが見つからない場合は空配列を返す", async () => {
        // Arrange
        const targetType = NotificationTargetType.TASK;
        const params = { taskId: TEST_DATA.taskIds.task1 };
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual([]);
      });

      test("重複ユーザーIDを除去する", async () => {
        // Arrange
        const targetType = NotificationTargetType.TASK;
        const params = { taskId: TEST_DATA.taskIds.task1 };
        const mockTask = createMockTask({
          reporters: [{ userId: TEST_DATA.userIds.user1 }], // 重複
          executors: [{ userId: TEST_DATA.userIds.user2 }],
        });
        const mockGroupMembers = [
          { userId: TEST_DATA.userIds.user1 }, // 重複
          { userId: TEST_DATA.userIds.user2 }, // 重複
        ];

        prismaMock.task.findUnique.mockResolvedValue(
          mockTask as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual([TEST_DATA.userIds.user1, TEST_DATA.userIds.user2]);
      });
    });

    describe("異常系・境界値テスト", () => {
      test.each([
        {
          targetType: NotificationTargetType.USER,
          params: {},
          expectedError: "ユーザーIDが指定されていません",
          description: "USER対象タイプでuserIdsが提供されない場合",
        },
        {
          targetType: NotificationTargetType.GROUP,
          params: {},
          expectedError: "グループIDが指定されていません",
          description: "GROUP対象タイプでgroupIdが提供されない場合",
        },
        {
          targetType: NotificationTargetType.TASK,
          params: {},
          expectedError: "タスクIDが指定されていません",
          description: "TASK対象タイプでtaskIdが提供されない場合",
        },
      ])("$description", async ({ targetType, params, expectedError }) => {
        // Act & Assert
        await expect(getNotificationTargetUserIds(targetType, params)).rejects.toThrow(expectedError);
      });

      test("SYSTEM対象タイプでデータベースエラーが発生した場合", async () => {
        // Arrange
        const targetType = NotificationTargetType.SYSTEM;
        const params = {};
        const errorMessage = "データベースエラー";
        prismaMock.user.findMany.mockRejectedValue(new Error(errorMessage));

        // Act & Assert
        await expect(getNotificationTargetUserIds(targetType, params)).rejects.toThrow(errorMessage);
      });

      test.each([
        {
          targetType: NotificationTargetType.SYSTEM,
          setupMock: () => prismaMock.user.findMany.mockResolvedValue([]),
          params: {},
          description: "SYSTEM対象タイプで空のユーザーリスト",
        },
        {
          targetType: NotificationTargetType.USER,
          setupMock: () => {
            // USER対象タイプでは追加のモック設定は不要
          },
          params: { userIds: [] },
          description: "USER対象タイプで空のuserIds配列",
        },
        {
          targetType: NotificationTargetType.GROUP,
          setupMock: () => prismaMock.groupMembership.findMany.mockResolvedValue([]),
          params: { groupId: TEST_DATA.groupIds.group1 },
          description: "GROUP対象タイプで空のグループメンバー",
        },
      ])("$description の場合は空配列を返す", async ({ targetType, setupMock, params }) => {
        // Arrange
        setupMock();

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual([]);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("buildCommonNotificationWhereClause", () => {
    const userId = TEST_DATA.userIds.user1;

    describe("正常系テスト", () => {
      test.each([
        {
          includeTaskCondition: true,
          description: "タスク条件を含むWHERE句を構築する",
          expectTaskQuery: true,
        },
        {
          includeTaskCondition: false,
          description: "タスク条件を含まないWHERE句を構築する",
          expectTaskQuery: false,
        },
        {
          includeTaskCondition: undefined,
          description: "デフォルト値でWHERE句を構築する（タスク条件を含む）",
          expectTaskQuery: true,
        },
      ])("$description", async ({ includeTaskCondition, expectTaskQuery }) => {
        // Arrange
        const mockGroupMemberships = [{ groupId: TEST_DATA.groupIds.group1 }];
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        const mockTasks = [{ id: TEST_DATA.taskIds.task1 }];
        prismaMock.task.findMany.mockResolvedValue(
          mockTasks as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
        );

        // Act
        const result =
          includeTaskCondition === undefined
            ? await buildCommonNotificationWhereClause(userId)
            : await buildCommonNotificationWhereClause(userId, includeTaskCondition);

        // Assert
        expect(result).toBeDefined();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId },
          select: { groupId: true },
        });

        if (expectTaskQuery) {
          expect(prismaMock.task.findMany).toHaveBeenCalledWith({
            where: { groupId: { in: [TEST_DATA.groupIds.group1] } },
            select: { id: true },
          });
        } else {
          expect(prismaMock.task.findMany).not.toHaveBeenCalled();
        }
      });
    });

    describe("異常系・境界値テスト", () => {
      test("userIdが空の場合はエラーを投げる", async () => {
        // Act & Assert
        await expect(buildCommonNotificationWhereClause("")).rejects.toThrow("ユーザーIDがありません");
      });

      test.each([
        {
          errorSource: "groupMembership",
          setupError: () => prismaMock.groupMembership.findMany.mockRejectedValue(new Error("データベースエラー")),
          expectedError: "データベースエラー",
          description: "グループメンバーシップ取得でエラーが発生",
        },
        {
          errorSource: "task",
          setupError: () => {
            prismaMock.groupMembership.findMany.mockResolvedValue([
              { groupId: TEST_DATA.groupIds.group1 },
            ] as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>);
            prismaMock.task.findMany.mockRejectedValue(new Error("タスク取得エラー"));
          },
          expectedError: "タスク取得エラー",
          description: "タスク取得でエラーが発生",
        },
      ])("$description した場合", async ({ setupError, expectedError }) => {
        // Arrange
        setupError();

        // Act & Assert
        await expect(buildCommonNotificationWhereClause(userId, true)).rejects.toThrow(expectedError);
      });

      test.each([
        {
          description: "グループに所属していないユーザー",
          groupMemberships: [] as Array<{ groupId: string }>,
          expectedDummyGroupId: "00000000-0000-0000-0000-000000000000",
        },
        {
          description: "グループにタスクが存在しない",
          groupMemberships: [{ groupId: TEST_DATA.groupIds.group1 }] as Array<{ groupId: string }>,
          tasks: [] as Array<{ id: string }>,
        },
      ])("$description の場合も正常にWHERE句を構築する", async ({ groupMemberships, tasks, expectedDummyGroupId }) => {
        // Arrange
        prismaMock.groupMembership.findMany.mockResolvedValue(
          groupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );
        prismaMock.task.findMany.mockResolvedValue(
          (tasks ?? []) as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
        );

        // Act
        const result = await buildCommonNotificationWhereClause(userId);

        // Assert
        expect(result).toBeDefined();

        if (expectedDummyGroupId) {
          expect(prismaMock.task.findMany).toHaveBeenCalledWith({
            where: { groupId: { in: [expectedDummyGroupId] } },
            select: { id: true },
          });
        }
      });
    });

    describe("SQL全文検証テスト", () => {
      test("should generate correct SQL with task condition included", async () => {
        // Arrange
        const mockGroupMemberships = [{ groupId: TEST_DATA.groupIds.group1 }];
        const mockTasks = [{ id: TEST_DATA.taskIds.task1 }];

        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );
        prismaMock.task.findMany.mockResolvedValue(
          mockTasks as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
        );

        // Act
        const result = await buildCommonNotificationWhereClause(userId, true);

        // Assert
        const actualSqlString = result.sql.replace(/\s+/g, " ").trim();
        const expectedSqlString = `(
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = ?) OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(?))
      OR (n."target_type" = 'TASK' AND n."task_id" = ANY(?))
    ) AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`
          .replace(/\s+/g, " ")
          .trim();

        expect(actualSqlString).toStrictEqual(expectedSqlString);
      });

      test("should generate correct SQL without task condition", async () => {
        // Arrange
        const mockGroupMemberships = [{ groupId: TEST_DATA.groupIds.group1 }];

        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await buildCommonNotificationWhereClause(userId, false);

        // Assert
        const actualSqlString = result.sql.replace(/\s+/g, " ").trim();
        const expectedSqlString = `(
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = ?) OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(?))
    ) AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`
          .replace(/\s+/g, " ")
          .trim();

        expect(actualSqlString).toStrictEqual(expectedSqlString);
      });

      test("should generate correct SQL when no tasks exist", async () => {
        // Arrange
        const mockGroupMemberships = [{ groupId: TEST_DATA.groupIds.group1 }];
        const mockTasks = [] as Array<{ id: string }>;

        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );
        prismaMock.task.findMany.mockResolvedValue(
          mockTasks as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
        );

        // Act
        const result = await buildCommonNotificationWhereClause(userId, true);

        // Assert
        const actualSqlString = result.sql.replace(/\s+/g, " ").trim();
        const expectedSqlString = `(
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = ?) OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(?))
    ) AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`
          .replace(/\s+/g, " ")
          .trim();

        expect(actualSqlString).toStrictEqual(expectedSqlString);
      });

      test("should generate correct SQL with dummy group ID when user has no groups", async () => {
        // Arrange
        const mockGroupMemberships = [] as Array<{ groupId: string }>;
        const mockTasks = [] as Array<{ id: string }>;

        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );
        prismaMock.task.findMany.mockResolvedValue(
          mockTasks as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
        );

        // Act
        const result = await buildCommonNotificationWhereClause(userId, true);

        // Assert
        const actualSqlString = result.sql.replace(/\s+/g, " ").trim();
        const expectedSqlString = `(
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = ?) OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(?))
    ) AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`
          .replace(/\s+/g, " ")
          .trim();

        expect(actualSqlString).toStrictEqual(expectedSqlString);
      });

      test("should generate correct SQL with multiple groups and tasks", async () => {
        // Arrange
        const mockGroupMemberships = [{ groupId: TEST_DATA.groupIds.group1 }, { groupId: TEST_DATA.groupIds.group2 }];
        const mockTasks = [{ id: TEST_DATA.taskIds.task1 }, { id: TEST_DATA.taskIds.task2 }];

        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );
        prismaMock.task.findMany.mockResolvedValue(
          mockTasks as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
        );

        // Act
        const result = await buildCommonNotificationWhereClause(userId, true);

        // Assert
        const actualSqlString = result.sql.replace(/\s+/g, " ").trim();
        const expectedSqlString = `(
      (n."target_type" = 'SYSTEM') OR
      (n."target_type" = 'USER' AND n."sender_user_id" = ?) OR
      (n."target_type" = 'GROUP' AND n."group_id" = ANY(?))
      OR (n."target_type" = 'TASK' AND n."task_id" = ANY(?))
    ) AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`
          .replace(/\s+/g, " ")
          .trim();

        expect(actualSqlString).toStrictEqual(expectedSqlString);
      });
    });
  });
});
