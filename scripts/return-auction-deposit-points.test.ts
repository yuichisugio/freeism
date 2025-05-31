import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionFactory, bidHistoryFactory, groupFactory, taskFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { BidStatus, NotificationSendMethod, NotificationSendTiming, PrismaClient, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

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
 */
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * process.exitのモック
 */
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("returnAuctionDepositPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAuctionNotification.mockResolvedValue({ success: true });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should return deposit points for eligible auctions", async () => {
      // テストデータの準備
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      // 7日前に終了したオークション（返還対象）
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: 100,
      });

      // Prismaモックの設定
      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: "テストタスク" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

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
      expect(mockSendAuctionNotification).toHaveBeenCalledWith({
        text: {
          first: "テストタスク",
          second: "100",
        },
        auctionEventType: "POINT_RETURNED",
        auctionId: auction.id,
        recipientUserId: [user.id],
        sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
        actionUrl: `/auction/${auction.id}`,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
      });
    });

    test("should handle multiple eligible auctions", async () => {
      // 複数のオークションのテストデータ準備
      const user1 = userFactory.build();
      const user2 = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 5 });

      const task1 = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "タスク1",
      });
      const task2 = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "タスク2",
      });

      // 6日前に終了したオークション（返還対象）
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 6);

      const auction1 = auctionFactory.build({
        endTime: pastDate,
        taskId: task1.id,
        groupId: group.id,
      });

      const auction2 = auctionFactory.build({
        endTime: pastDate,
        taskId: task2.id,
        groupId: group.id,
      });

      const bidHistory1 = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user1.id,
        auctionId: auction1.id,
        depositPoint: 150,
      });

      const bidHistory2 = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user2.id,
        auctionId: auction2.id,
        depositPoint: 200,
      });

      // Prismaモックの設定
      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction1,
          group: group,
          task: task1,
          bidHistories: [bidHistory1],
        },
        {
          ...auction2,
          group: group,
          task: task2,
          bidHistories: [bidHistory2],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

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
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: 0,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: "テストタスク" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          text: {
            first: "テストタスク",
            second: "0",
          },
        }),
      );
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should skip auctions with no winning bid history", async () => {
      // 落札者がいないオークション
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [], // 落札者なし
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(0);
      expect(mockConsoleLog).toHaveBeenCalledWith(`オークションID: ${auction.id} には落札者のレコードがありません。スキップします。`);
      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });

    test("should skip auctions with null deposit point", async () => {
      // depositPointがnullのケース
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: null,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(0);
      expect(mockConsoleLog).toHaveBeenCalledWith(`オークションID: ${auction.id} の落札者の預けポイントがありません。スキップします。`);
      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });

    test("should skip auctions with undefined deposit point", async () => {
      // depositPointがundefinedのケース
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: undefined,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(0);
      expect(mockConsoleLog).toHaveBeenCalledWith(`オークションID: ${auction.id} の落札者の預けポイントがありません。スキップします。`);
      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });

    test("should throw error when group point update fails", async () => {
      // GroupPointの更新に失敗するケース
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: 100,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }), // 更新対象なし
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: "テストタスク" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      await expect(returnAuctionDepositPoints()).rejects.toThrow(`ユーザーID: ${user.id} のグループポイントレコードが見つかりませんでした。`);
    });

    test("should throw error when task is not found", async () => {
      // タスクが見つからないケース
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: 100,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue(null), // タスクが見つからない
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      await expect(returnAuctionDepositPoints()).rejects.toThrow(`タスクID: ${task.id} が見つかりませんでした。`);
    });

    test("should handle database connection error", async () => {
      // データベース接続エラー
      vi.mocked(prismaMock.auction.findMany).mockRejectedValue(new Error("Database connection failed"));

      await expect(returnAuctionDepositPoints()).rejects.toThrow("Database connection failed");
      expect(mockConsoleError).toHaveBeenCalledWith("オークションポイント返還処理でエラーが発生しました:", expect.any(Error));
    });

    test("should handle notification sending failure", async () => {
      // 通知送信に失敗するケース
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: 100,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: "テストタスク" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

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
    test("should not process auction that ends exactly on deposit period boundary", async () => {
      // 預け期間ちょうどに終了したオークション（返還対象外）
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      // ちょうど7日前に終了（境界値）
      const boundaryDate = new Date();
      boundaryDate.setDate(boundaryDate.getDate() - 7);

      const auction = auctionFactory.build({
        endTime: boundaryDate,
        taskId: task.id,
        groupId: group.id,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(0);
    });

    test("should process auction that ends one day after deposit period", async () => {
      // 預け期間+1日後に終了したオークション（返還対象）
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      // 8日前に終了（境界値+1）
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: 100,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: "テストタスク" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(1);
    });

    test("should handle deposit period of 0 days", async () => {
      // 預け期間が0日のケース
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 0 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      // 1日前に終了
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: 100,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: "テストタスク" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(1);
    });

    test("should handle maximum deposit point value", async () => {
      // 最大値のdepositPoint
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: Number.MAX_SAFE_INTEGER,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: "テストタスク" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          text: {
            first: "テストタスク",
            second: String(Number.MAX_SAFE_INTEGER),
          },
        }),
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
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.PENDING, // AUCTION_ENDED以外
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
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

      // 未来の日付
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const auction = auctionFactory.build({
        endTime: futureDate,
        taskId: task.id,
        groupId: group.id,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
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
    test("should handle empty auction list", async () => {
      // オークションが存在しない場合
      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([]);

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(0);
      expect(mockConsoleLog).toHaveBeenCalledWith("ポイント返還対象のオークション数: 0件");
      expect(mockConsoleLog).toHaveBeenCalledWith("0件のオークションのポイント返還処理が完了しました。");
    });

    test("should handle auction with very large deposit period", async () => {
      // 非常に大きな預け期間のケース
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 365 }); // 1年
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      // 1年以上前に終了したオークション
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 400);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: 100,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: "テストタスク" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(1);
    });

    test("should handle auction with negative deposit period", async () => {
      // 負の預け期間のケース（異常なデータ）
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: -1 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: 100,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: "テストタスク" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(1);
    });

    test("should handle auction with very long task name", async () => {
      // 非常に長いタスク名のケース
      const user = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const longTaskName = "a".repeat(2000); // 2000文字
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: longTaskName,
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.WON,
        userId: user.id,
        auctionId: auction.id,
        depositPoint: 100,
      });

      vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
        {
          ...auction,
          group: group,
          task: task,
          bidHistories: [bidHistory],
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: longTaskName }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      const result = await returnAuctionDepositPoints();

      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          text: {
            first: longTaskName,
            second: "100",
          },
        }),
      );
    });

    test("should handle multiple bidHistories with same status", async () => {
      // 同じステータスの複数の入札履歴がある場合（通常は起こらないが）
      const user1 = userFactory.build();
      const user2 = userFactory.build();
      const group = groupFactory.build({ depositPeriod: 7 });
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
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
          group: group,
          task: task,
          bidHistories: [bidHistory1, bidHistory2], // 複数のWONステータス
        },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          task: {
            findUnique: vi.fn().mockResolvedValue({ task: "テストタスク" }),
          },
        };
        return await callback(mockTx as unknown as PrismaClient);
      });

      const result = await returnAuctionDepositPoints();

      // 最初の入札履歴のみが処理される
      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: [user1.id],
          text: {
            first: "テストタスク",
            second: "100",
          },
        }),
      );
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAuctionNotification.mockResolvedValue({ success: true });
  });

  test("should execute successfully and exit with code 0", async () => {
    // returnAuctionDepositPointsが成功するケース
    vi.mocked(prismaMock.auction.findMany).mockResolvedValue([]);

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleLog).toHaveBeenCalledWith("オークションのポイント返還処理を開始します...");
    expect(mockConsoleLog).toHaveBeenCalledWith("処理が完了しました。0件のオークションのポイント返還処理を実行しました。");
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
    const user1 = userFactory.build();
    const user2 = userFactory.build();
    const group = groupFactory.build({ depositPeriod: 7 });

    const task1 = taskFactory.build({
      status: TaskStatus.AUCTION_ENDED,
      groupId: group.id,
      task: "タスク1",
    });
    const task2 = taskFactory.build({
      status: TaskStatus.AUCTION_ENDED,
      groupId: group.id,
      task: "タスク2",
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 8);

    const auction1 = auctionFactory.build({
      endTime: pastDate,
      taskId: task1.id,
      groupId: group.id,
    });

    const auction2 = auctionFactory.build({
      endTime: pastDate,
      taskId: task2.id,
      groupId: group.id,
    });

    const bidHistory1 = bidHistoryFactory.build({
      status: BidStatus.WON,
      userId: user1.id,
      auctionId: auction1.id,
      depositPoint: 100,
    });

    const bidHistory2 = bidHistoryFactory.build({
      status: BidStatus.WON,
      userId: user2.id,
      auctionId: auction2.id,
      depositPoint: 200,
    });

    vi.mocked(prismaMock.auction.findMany).mockResolvedValue([
      {
        ...auction1,
        group: group,
        task: task1,
        bidHistories: [bidHistory1],
      },
      {
        ...auction2,
        group: group,
        task: task2,
        bidHistories: [bidHistory2],
      },
    ] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

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

    expect(mockConsoleLog).toHaveBeenCalledWith("処理が完了しました。2件のオークションのポイント返還処理を実行しました。");
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });
});
