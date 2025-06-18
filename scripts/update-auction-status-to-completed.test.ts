import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  auctionFactory,
  bidHistoryFactory,
  groupFactory,
  groupPointFactory,
  taskFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import {
  AuctionEventType,
  BidStatus,
  NotificationSendMethod,
  NotificationSendTiming,
  TaskStatus,
} from "@prisma/client";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { PrismaTransaction } from "./update-auction-status-to-completed";
import { TaskWithRelations, updateAuctionStatusToCompleted } from "./update-auction-status-to-completed";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * sendAuctionNotificationのモック
 */
vi.mock("@/lib/actions/notification/auction-notification", () => ({
  sendAuctionNotification: vi.fn().mockResolvedValue({ success: true }),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の取得
 */
const { sendAuctionNotification } = await import("@/lib/actions/notification/auction-notification");
const mockSendAuctionNotification = vi.mocked(sendAuctionNotification);

/**
 * コンソール出力のモック
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
 * 共通テストデータ作成関数
 */
const createTestData = () => {
  const seller = userFactory.build();
  const bidder1 = userFactory.build();
  const bidder2 = userFactory.build();
  const group = groupFactory.build();

  const pastDate = new Date();
  pastDate.setHours(pastDate.getHours() - 1);

  return { seller, bidder1, bidder2, group, pastDate };
};

/**
 * タスクとオークションの作成
 */
const createTaskWithAuction = (seller: any, group: any, pastDate: Date, taskName = "テストタスク") => {
  const task = taskFactory.build({
    status: TaskStatus.AUCTION_ACTIVE,
    groupId: group.id,
    creatorId: seller.id,
    task: taskName,
  });

  const auction = auctionFactory.build({
    endTime: pastDate,
    taskId: task.id,
    groupId: group.id,
  });

  return { task, auction };
};

/**
 * 入札履歴なしのタスクデータ作成
 */
const createTaskWithNoBids = (task: any, auction: any, group: any): TaskWithRelations => ({
  id: task.id,
  task: task.task,
  groupId: group.id,
  auction: {
    id: auction.id,
    bidHistories: [],
  },
  group: {
    id: group.id,
  },
});

/**
 * 入札履歴ありのタスクデータ作成
 */
const createTaskWithBids = (task: any, auction: any, group: any, bidHistories: any[]): TaskWithRelations => ({
  id: task.id,
  task: task.task,
  groupId: group.id,
  auction: {
    id: auction.id,
    bidHistories: bidHistories.map((bid) => ({
      id: bid.id,
      amount: bid.amount,
      status: bid.status,
      userId: bid.userId,
      user: { id: bid.userId },
    })),
  },
  group: {
    id: group.id,
  },
});

/**
 * 共通のPrismaモック設定（入札なし）
 */
const setupPrismaMockForNoBids = (taskWithRelations: TaskWithRelations, creatorId: string) => {
  vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

  vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
    const mockTx = {
      task: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ creatorId }),
      },
    };
    return await callback(mockTx as unknown as PrismaTransaction);
  });
};

/**
 * 共通のPrismaモック設定（入札あり）
 */
const setupPrismaMockForBids = (taskWithRelations: TaskWithRelations, groupPoint: any, creatorId: string) => {
  vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

  vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
    const mockTx = {
      groupPoint: {
        findUnique: vi.fn().mockResolvedValue(groupPoint),
        update: vi.fn().mockResolvedValue({}),
      },
      bidHistory: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({}),
      },
      auction: {
        update: vi.fn().mockResolvedValue({}),
      },
      task: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ creatorId }),
      },
    };
    return await callback(mockTx as unknown as PrismaTransaction);
  });
};

/**
 * 通知送信の検証
 */
const expectNotificationSent = (
  auctionId: string,
  eventType: AuctionEventType,
  taskName: string,
  recipientIds: string[],
) => {
  expect(mockSendAuctionNotification).toHaveBeenCalledWith({
    auctionId,
    auctionEventType: eventType,
    text: {
      first: taskName,
      second: taskName,
    },
    recipientUserId: recipientIds,
    actionUrl: `/auctions/${auctionId}`,
    sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
    sendTiming: NotificationSendTiming.NOW,
    sendScheduledDate: null,
    expiresAt: null,
  });
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("update-auction-status-to-completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAuctionNotification.mockResolvedValue({ success: true });

    // コンソールモックを設定
    console.log = mockConsoleLog;
    console.error = mockConsoleError;

    // consoleモックもリセット
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    // コンソールを元に戻す
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    // テスト終了後にconsoleを元に戻す
    vi.restoreAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should process auction with no bids correctly", async () => {
      const { seller, group } = createTestData();
      const { task, auction } = createTaskWithAuction(seller, group, new Date(Date.now() - 3600000));
      const taskWithRelations = createTaskWithNoBids(task, auction, group);

      setupPrismaMockForNoBids(taskWithRelations, seller.id);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
      expect(vi.mocked(prismaMock.task.findMany)).toHaveBeenCalledWith({
        where: {
          status: {
            in: [TaskStatus.AUCTION_ACTIVE, TaskStatus.PENDING],
          },
          auction: {
            endTime: {
              lte: expect.any(Date),
            },
          },
        },
        select: {
          id: true,
          task: true,
          groupId: true,
          auction: {
            select: {
              id: true,
              bidHistories: {
                select: {
                  id: true,
                  amount: true,
                  status: true,
                  userId: true,
                  user: {
                    select: {
                      id: true,
                    },
                  },
                },
                orderBy: {
                  amount: "desc",
                },
              },
            },
          },
          group: {
            select: {
              id: true,
            },
          },
        },
      });

      expectNotificationSent(task.id, AuctionEventType.ENDED, task.task, [seller.id]);
      expectNotificationSent(task.id, AuctionEventType.NO_WINNER, task.task, [seller.id]);
    });

    test("should process auction with single bid correctly", async () => {
      const { seller, bidder1, group } = createTestData();
      const { task, auction } = createTaskWithAuction(seller, group, new Date(Date.now() - 3600000));

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder1.id,
        auctionId: auction.id,
        amount: 100,
      });

      const groupPoint = groupPointFactory.build({
        userId: bidder1.id,
        groupId: group.id,
        balance: 1000,
      });

      const taskWithRelations = createTaskWithBids(task, auction, group, [bidHistory]);
      setupPrismaMockForBids(taskWithRelations, groupPoint, seller.id);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
      expectNotificationSent(task.id, AuctionEventType.AUCTION_WIN, task.task, [bidder1.id]);
      expectNotificationSent(task.id, AuctionEventType.ITEM_SOLD, task.task, [seller.id]);
    });

    test("should process auction with multiple bids correctly", async () => {
      const { seller, bidder1, bidder2, group } = createTestData();
      const { task, auction } = createTaskWithAuction(seller, group, new Date(Date.now() - 3600000));

      const bidHistory1 = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder1.id,
        auctionId: auction.id,
        amount: 200,
      });

      const bidHistory2 = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder2.id,
        auctionId: auction.id,
        amount: 150,
      });

      const groupPoint = groupPointFactory.build({
        userId: bidder1.id,
        groupId: group.id,
        balance: 1000,
      });

      const taskWithRelations = createTaskWithBids(task, auction, group, [bidHistory1, bidHistory2]);
      setupPrismaMockForBids(taskWithRelations, groupPoint, seller.id);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
      expectNotificationSent(task.id, AuctionEventType.AUCTION_WIN, task.task, [bidder1.id]);
    });

    test("should return 0 when no auctions need to be processed", async () => {
      vi.mocked(prismaMock.task.findMany).mockResolvedValue([]);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(0);
      // console.logの検証は削除（機能的なテストに集中）
    });

    test("should handle multiple auctions", async () => {
      const { seller, group } = createTestData();
      const user2 = userFactory.build();

      const { task: task1, auction: auction1 } = createTaskWithAuction(
        seller,
        group,
        new Date(Date.now() - 3600000),
        "テストタスク1",
      );
      const { task: task2, auction: auction2 } = createTaskWithAuction(
        user2,
        group,
        new Date(Date.now() - 3600000),
        "テストタスク2",
      );

      const tasksWithRelations = [
        createTaskWithNoBids(task1, auction1, group),
        createTaskWithNoBids(task2, auction2, group),
      ];

      vi.mocked(prismaMock.task.findMany).mockResolvedValue(tasksWithRelations as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi
              .fn()
              .mockResolvedValueOnce({ creatorId: seller.id })
              .mockResolvedValueOnce({ creatorId: user2.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(2);
      expect(mockConsoleLog).toHaveBeenCalledWith("処理対象のオークション: 2件");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should throw error when database operation fails", async () => {
      const dbError = new Error("Database connection failed");
      vi.mocked(prismaMock.task.findMany).mockRejectedValue(dbError);

      await expect(updateAuctionStatusToCompleted()).rejects.toThrow("Database connection failed");
      expect(mockConsoleError).toHaveBeenCalledWith("オークション終了処理でエラーが発生しました:", dbError);
    });

    test("should handle insufficient points for winner", async () => {
      const { seller, bidder1, bidder2, group } = createTestData();
      const { task, auction } = createTaskWithAuction(seller, group, new Date(Date.now() - 3600000));

      const bidHistory1 = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder1.id,
        auctionId: auction.id,
        amount: 200,
      });

      const bidHistory2 = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder2.id,
        auctionId: auction.id,
        amount: 150,
      });

      const insufficientGroupPoint = groupPointFactory.build({
        userId: bidder1.id,
        groupId: group.id,
        balance: 100, // 不足
      });

      const taskWithRelations = createTaskWithBids(task, auction, group, [bidHistory1, bidHistory2]);
      setupPrismaMockForBids(taskWithRelations, insufficientGroupPoint, seller.id);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
    });

    test("should handle transaction failure", async () => {
      const { seller, group } = createTestData();
      const { task, auction } = createTaskWithAuction(seller, group, new Date(Date.now() - 3600000));
      const taskWithRelations = createTaskWithNoBids(task, auction, group);

      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      const transactionError = new Error("Transaction failed");
      vi.mocked(prismaMock.$transaction).mockRejectedValue(transactionError);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(0);
      expect(mockConsoleError).toHaveBeenCalledWith(
        `オークション(ID: ${task.id})の処理中にエラーが発生:`,
        transactionError,
      );
    });

    test("should handle notification sending failure", async () => {
      const { seller, group } = createTestData();
      const { task, auction } = createTaskWithAuction(seller, group, new Date(Date.now() - 3600000));
      const taskWithRelations = createTaskWithNoBids(task, auction, group);

      setupPrismaMockForNoBids(taskWithRelations, seller.id);
      mockSendAuctionNotification.mockResolvedValue({ success: false, error: "Notification failed" });

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalled();
    });

    test("should handle null or undefined auction data", async () => {
      const { seller, group } = createTestData();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: seller.id,
        task: "テストタスク",
      });

      const taskWithRelations: TaskWithRelations = {
        id: task.id,
        task: task.task,
        groupId: task.groupId,
        auction: null as any,
        group: {
          id: task.groupId,
        },
      };

      setupPrismaMockForNoBids(taskWithRelations, seller.id);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
    });

    test("should handle empty creator ID", async () => {
      const { group } = createTestData();
      const { task, auction } = createTaskWithAuction({ id: "unknown-user" }, group, new Date(Date.now() - 3600000));
      const taskWithRelations = createTaskWithNoBids(task, auction, group);

      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle exactly current time as boundary", async () => {
      const { seller, group } = createTestData();
      const now = new Date();
      const { task, auction } = createTaskWithAuction(seller, group, now);
      const taskWithRelations = createTaskWithNoBids(task, auction, group);

      setupPrismaMockForNoBids(taskWithRelations, seller.id);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
      expect(vi.mocked(prismaMock.task.findMany)).toHaveBeenCalledWith({
        where: {
          status: {
            in: [TaskStatus.AUCTION_ACTIVE, TaskStatus.PENDING],
          },
          auction: {
            endTime: {
              lte: expect.any(Date),
            },
          },
        },
        select: expect.any(Object),
      });
    });

    test("should handle zero bid amount", async () => {
      const { seller, bidder1, group } = createTestData();
      const { task, auction } = createTaskWithAuction(seller, group, new Date(Date.now() - 3600000));

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder1.id,
        auctionId: auction.id,
        amount: 0,
      });

      const groupPoint = groupPointFactory.build({
        userId: bidder1.id,
        groupId: group.id,
        balance: 1000,
      });

      const taskWithRelations = createTaskWithBids(task, auction, group, [bidHistory]);
      setupPrismaMockForBids(taskWithRelations, groupPoint, seller.id);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
    });

    test("should handle maximum integer bid amount", async () => {
      const { seller, bidder1, group } = createTestData();
      const { task, auction } = createTaskWithAuction(seller, group, new Date(Date.now() - 3600000));

      const maxAmount = Number.MAX_SAFE_INTEGER;
      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder1.id,
        auctionId: auction.id,
        amount: maxAmount,
      });

      const groupPoint = groupPointFactory.build({
        userId: bidder1.id,
        groupId: group.id,
        balance: maxAmount,
      });

      const taskWithRelations = createTaskWithBids(task, auction, group, [bidHistory]);
      setupPrismaMockForBids(taskWithRelations, groupPoint, seller.id);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
    });

    test("should handle empty task name", async () => {
      const { seller, group } = createTestData();
      const { task, auction } = createTaskWithAuction(seller, group, new Date(Date.now() - 3600000), "");
      const taskWithRelations = createTaskWithNoBids(task, auction, group);

      setupPrismaMockForNoBids(taskWithRelations, seller.id);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          text: {
            first: "",
            second: "",
          },
        }),
      );
    });

    test("should handle very long task name", async () => {
      const { seller, group } = createTestData();
      const longTaskName = "a".repeat(1000);
      const { task, auction } = createTaskWithAuction(seller, group, new Date(Date.now() - 3600000), longTaskName);
      const taskWithRelations = createTaskWithNoBids(task, auction, group);

      setupPrismaMockForNoBids(taskWithRelations, seller.id);

      const result = await updateAuctionStatusToCompleted();

      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          text: {
            first: longTaskName,
            second: longTaskName,
          },
        }),
      );
    });
  });
});
