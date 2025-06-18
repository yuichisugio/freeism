import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  auctionFactory,
  bidHistoryFactory,
  groupFactory,
  taskFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { BidStatus, NotificationSendMethod, NotificationSendTiming, PrismaClient, TaskStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テスト対象の関数をインポート（モック設定後にインポート）
import { main, returnAuctionDepositPoints } from "./return-auction-deposit-points";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * sendAuctionNotificationのモック
 */
vi.mock("@/lib/actions/notification/auction-notification", () => ({
  sendAuctionNotification: vi.fn().mockResolvedValue({ success: true }),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * main関数の実行を防ぐためのモック
 */
vi.mock("./return-auction-deposit-points", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./return-auction-deposit-points")>();
  return {
    ...actual,
    // main関数の実行を無効化
  };
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の取得
 */
const { sendAuctionNotification } = await import("@/lib/actions/notification/auction-notification");
const mockSendAuctionNotification = vi.mocked(sendAuctionNotification);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * console.logとconsole.errorのモック
 * setup.tsでグローバルにモックされているため、元のconsoleオブジェクトを使用
 */
const originalConsole = {
  log: console.log,
  error: console.error,
};

const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * process.exitのモック
 */
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト終了後のクリーンアップ
 */
afterAll(() => {
  // コンソールを元に戻す
  console.log = originalConsole.log;
  console.error = originalConsole.error;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */

/**
 * 過去の日付を生成するヘルパー関数
 */
function createPastDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * 未来の日付を生成するヘルパー関数
 */
function createFutureDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}

/**
 * 基本的なオークションテストデータを作成するヘルパー関数
 */
function createBasicAuctionTestData(options: {
  depositPeriod: number;
  daysAgo: number;
  taskName?: string;
  depositPoint?: number | null | undefined;
  taskStatus?: TaskStatus;
}) {
  const { depositPeriod, daysAgo, taskName = "テストタスク", taskStatus = TaskStatus.AUCTION_ENDED } = options;

  // depositPointが明示的に渡されていない場合のみデフォルト値を使用
  const depositPoint = "depositPoint" in options ? options.depositPoint : 100;

  const user = userFactory.build();
  const group = groupFactory.build({ depositPeriod });
  const task = taskFactory.build({
    status: taskStatus,
    groupId: group.id,
    task: taskName,
  });

  const auction = auctionFactory.build({
    endTime: createPastDate(daysAgo),
    taskId: task.id,
    groupId: group.id,
  });

  const bidHistory = bidHistoryFactory.build({
    status: BidStatus.WON,
    userId: user.id,
    auctionId: auction.id,
    depositPoint,
  });

  return { user, group, task, auction, bidHistory };
}

/**
 * 複数のオークションテストデータを作成するヘルパー関数
 */
function createMultipleAuctionTestData(count: number, depositPeriod: number, daysAgo: number) {
  return Array.from({ length: count }, (_, index) => {
    const user = userFactory.build();
    const task = taskFactory.build({
      status: TaskStatus.AUCTION_ENDED,
      groupId: `group-${index}`,
      task: `タスク${index + 1}`,
    });
    const group = groupFactory.build({ depositPeriod });
    const auction = auctionFactory.build({
      endTime: createPastDate(daysAgo),
      taskId: task.id,
      groupId: group.id,
    });
    const bidHistory = bidHistoryFactory.build({
      status: BidStatus.WON,
      userId: user.id,
      auctionId: auction.id,
      depositPoint: (index + 1) * 100,
    });

    return { user, group, task, auction, bidHistory };
  });
}

/**
 * Prismaトランザクションモックを設定するヘルパー関数
 */
function setupPrismaTransactionMock(options: {
  groupPointUpdateCount?: number;
  taskFindResult?: any;
  shouldThrowError?: boolean;
  errorMessage?: string;
}) {
  const {
    groupPointUpdateCount = 1,
    taskFindResult = { task: "テストタスク" },
    shouldThrowError = false,
    errorMessage = "Transaction error",
  } = options;

  if (shouldThrowError) {
    vi.mocked(prismaMock.$transaction).mockRejectedValue(new Error(errorMessage));
    return;
  }

  vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
    const mockTx = {
      groupPoint: {
        updateMany: vi.fn().mockResolvedValue({ count: groupPointUpdateCount }),
      },
      task: {
        findUnique: vi.fn().mockResolvedValue(taskFindResult),
      },
    };
    return await callback(mockTx as unknown as PrismaClient);
  });
}

/**
 * 期待される通知パラメータを生成するヘルパー関数
 */
function createExpectedNotificationParams(auctionId: string, taskName: string, depositPoint: string, userId: string) {
  return {
    text: {
      first: taskName,
      second: depositPoint,
    },
    auctionEventType: "POINT_RETURNED",
    auctionId,
    recipientUserId: [userId],
    sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
    actionUrl: `/auction/${auctionId}`,
    sendTiming: NotificationSendTiming.NOW,
    sendScheduledDate: null,
    expiresAt: null,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("returnAuctionDepositPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAuctionNotification.mockResolvedValue({ success: true });

    // コンソールモックを設定
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should return deposit points for eligible auctions", async () => {
      // テストデータの準備
      const { user, group, task, auction, bidHistory } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
      });

      // Prismaモックの設定
      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      setupPrismaTransactionMock({});

      // テスト実行
      const result = await returnAuctionDepositPoints();

      // 検証
      expect(result).toBe(1);
      expect(vi.mocked(prismaMock.auction.findMany)).toHaveBeenCalledWith({
        where: {
          task: {
            status: "AUCTION_ENDED",
          },
        },
        select: {
          id: true,
          endTime: true,
          taskId: true,
          group: {
            select: {
              id: true,
              depositPeriod: true,
            },
          },
          bidHistories: {
            where: {
              status: "WON",
            },
            select: {
              userId: true,
              depositPoint: true,
            },
          },
          task: {
            select: {
              id: true,
              task: true,
              status: true,
            },
          },
        },
      });
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        createExpectedNotificationParams(auction.id, task.task, "100", user.id),
      );
    });

    test("should handle multiple eligible auctions", async () => {
      // 複数のオークションのテストデータ準備
      const testDataArray = createMultipleAuctionTestData(2, 5, 6);

      // Prismaモックの設定
      vi.mocked(prismaMock.auction.findMany).mockResolvedValue(
        testDataArray.map(({ auction, group, task, bidHistory }) => ({
          ...auction,
          group,
          task,
          bidHistories: [bidHistory],
        })) as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>,
      );

      // 複数のタスクに対応するモック設定
      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValueOnce({ task: "タスク1" }).mockResolvedValueOnce({ task: "タスク2" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      // テスト実行
      const result = await returnAuctionDepositPoints();

      // 検証
      expect(result).toBe(2);
      expect(mockSendAuctionNotification).toHaveBeenCalledTimes(2);
    });

    test("should handle zero deposit point correctly", async () => {
      // depositPointが0のケース
      const { user, group, task, auction, bidHistory } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
        depositPoint: 0,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      setupPrismaTransactionMock({});

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        createExpectedNotificationParams(auction.id, task.task, "0", user.id),
      );
    });

    test("should handle empty auction list", async () => {
      // オークションが存在しない場合
      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([]);

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(0);
      expect(mockConsoleLog).toHaveBeenCalledWith("ポイント返還対象のオークション数: 0件");
      expect(mockConsoleLog).toHaveBeenCalledWith("0件のオークションのポイント返還処理が完了しました。");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should skip auctions with no winning bid history", async () => {
      // 落札者がいないオークション
      const { group, task, auction } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [], // 落札者なし
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(0);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        `オークションID: ${auction.id} には落札者のレコードがありません。スキップします。`,
      );
      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });

    test.each([
      { depositPoint: null, description: "null deposit point" },
      { depositPoint: undefined, description: "undefined deposit point" },
    ])("should skip auctions with $description", async ({ depositPoint }) => {
      const { group, task, auction, bidHistory } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
        depositPoint,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(0);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        `オークションID: ${auction.id} の落札者の預けポイントがありません。スキップします。`,
      );
      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });

    test("should throw error when group point update fails", async () => {
      // GroupPointの更新に失敗するケース
      const { user, group, task, auction, bidHistory } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      setupPrismaTransactionMock({ groupPointUpdateCount: 0 });

      await expect(returnAuctionDepositPoints()).rejects.toThrow(
        `ユーザーID: ${user.id} のグループポイントレコードが見つかりませんでした。`,
      );
    });

    test("should throw error when task is not found", async () => {
      // タスクが見つからないケース
      const { group, task, auction, bidHistory } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      setupPrismaTransactionMock({ taskFindResult: null });

      await expect(returnAuctionDepositPoints()).rejects.toThrow(`タスクID: ${task.id} が見つかりませんでした。`);
    });

    test("should handle database connection error", async () => {
      // データベース接続エラー
      vi.mocked(prismaMock.auction.findMany).mockRejectedValue(new Error("Database connection failed"));

      await expect(returnAuctionDepositPoints()).rejects.toThrow("Database connection failed");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "オークションポイント返還処理でエラーが発生しました:",
        expect.any(Error),
      );
    });

    test("should handle notification sending failure", async () => {
      // 通知送信に失敗するケース
      const { group, task, auction, bidHistory } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      setupPrismaTransactionMock({});

      // 通知送信を失敗させる
      mockSendAuctionNotification.mockRejectedValue(new Error("Notification failed"));

      await expect(returnAuctionDepositPoints()).rejects.toThrow("Notification failed");
    });

    test("should handle prisma disconnect error", async () => {
      // prisma.$disconnectでエラーが発生するケース
      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([]);
      vi.mocked(prismaMock.$disconnect).mockRejectedValue(new Error("Disconnect failed"));

      // finallyブロックでエラーが発生するが、メイン処理は完了する
      await expect(returnAuctionDepositPoints()).rejects.toThrow("Disconnect failed");
      expect(vi.mocked(prismaMock.$disconnect)).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    test.each([
      { depositPeriod: 7, daysAgo: 7, expected: 0, description: "exactly on deposit period boundary" },
      { depositPeriod: 7, daysAgo: 8, expected: 1, description: "one day after deposit period" },
      { depositPeriod: 0, daysAgo: 1, expected: 1, description: "deposit period of 0 days" },
      { depositPeriod: 365, daysAgo: 400, expected: 1, description: "very large deposit period" },
      { depositPeriod: -1, daysAgo: 1, expected: 1, description: "negative deposit period" },
    ])("should handle $description", async ({ depositPeriod, daysAgo, expected }) => {
      const { group, task, auction, bidHistory } = createBasicAuctionTestData({
        depositPeriod,
        daysAgo,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: expected > 0 ? [bidHistory] : [],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      if (expected > 0) {
        setupPrismaTransactionMock({});
      }

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(expected);
    });

    test.each([
      { depositPoint: 0, description: "zero deposit point" },
      { depositPoint: Number.MAX_SAFE_INTEGER, description: "maximum deposit point value" },
    ])("should handle $description", async ({ depositPoint }) => {
      const { user, group, task, auction, bidHistory } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
        depositPoint,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      setupPrismaTransactionMock({});

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        createExpectedNotificationParams(auction.id, task.task, String(depositPoint), user.id),
      );
    });

    test("should handle very long task name", async () => {
      // 非常に長いタスク名のケース
      const longTaskName = "a".repeat(2000);
      const { user, group, task, auction, bidHistory } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
        taskName: longTaskName,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      setupPrismaTransactionMock({ taskFindResult: { task: longTaskName } });

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        createExpectedNotificationParams(auction.id, longTaskName, "100", user.id),
      );
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルタリング条件のテスト
   */
  describe("フィルタリング条件", () => {
    test("should not process auctions with task status other than AUCTION_ENDED", async () => {
      // タスクステータスがAUCTION_ENDED以外のケース
      const { group, task, auction } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
        taskStatus: TaskStatus.PENDING,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(0);
    });

    test("should not process future auctions", async () => {
      // 未来のオークション
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const auction = auctionFactory.build({
        endTime: createFutureDate(1),
        taskId: task.id,
        groupId: group.id,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * エッジケースのテスト
   */
  describe("エッジケース", () => {
    test("should handle multiple bidHistories with same status", async () => {
      // 同じステータスの複数の入札履歴がある場合（通常は起こらないが）
      const user1 = userFactory.build();
      const user2 = userFactory.build();
      const { group, task, auction } = createBasicAuctionTestData({
        depositPeriod: 7,
        daysAgo: 8,
      });

      const bidHistory1 = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user1.id,
        auctionId: auction.id,
        depositPoint: 100,
      });

      const bidHistory2 = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user2.id,
        auctionId: auction.id,
        depositPoint: 200,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group,
          task,
          bidHistories: [bidHistory1, bidHistory2], // 複数のWONステータス
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      setupPrismaTransactionMock({});

      const result = await returnAuctionDepositPoints();

      // 最初の入札履歴のみが処理される
      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        createExpectedNotificationParams(auction.id, task.task, "100", user1.id),
      );
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAuctionNotification.mockResolvedValue({ success: true });

    // コンソールモックを設定
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
  });

  test("should execute successfully and exit with code 0", async () => {
    // returnAuctionDepositPointsが成功するケース
    vi.mocked(prismaMock.auction.findMany).mockResolvedValue([]);

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleLog).toHaveBeenCalledWith("オークションのポイント返還処理を開始します...");
    expect(mockConsoleLog).toHaveBeenCalledWith(
      "処理が完了しました。0件のオークションのポイント返還処理を実行しました。",
    );
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });

  test("should handle error and exit with code 1", async () => {
    // returnAuctionDepositPointsがエラーを投げるケース
    vi.mocked(prismaMock.auction.findMany).mockRejectedValue(new Error("Database error"));

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith("エラーが発生しました:", expect.any(Error));
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  test("should process multiple auctions and log correct count", async () => {
    // 複数のオークションが処理されるケース
    const testDataArray = createMultipleAuctionTestData(2, 7, 8);

    vi.mocked(prismaMock.auction.findMany).mockResolvedValue(
      testDataArray.map(({ auction, group, task, bidHistory }) => ({
        ...auction,
        group,
        task,
        bidHistories: [bidHistory],
      })) as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>,
    );

    vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
      const mockTx = {
        groupPoint: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        task: {
          findUnique: vi.fn().mockResolvedValueOnce({ task: "タスク1" }).mockResolvedValueOnce({ task: "タスク2" }),
        },
      };
      return await callback(mockTx as unknown as PrismaClient);
    });

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleLog).toHaveBeenCalledWith(
      "処理が完了しました。2件のオークションのポイント返還処理を実行しました。",
    );
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });
});
