import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  auctionFactory,
  bidHistoryFactory,
  groupFactory,
  groupPointFactory,
  taskFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { AuctionEventType, BidStatus, NotificationSendMethod, NotificationSendTiming, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

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
 * main関数の実行を防ぐためのモック
 */
vi.mock("./update-auction-status-to-completed", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./update-auction-status-to-completed")>();
  return {
    ...actual,
    // main関数の実行を無効化
  };
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テスト対象の関数をインポート（モック設定後にインポート）

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

describe("update-auction-status-to-completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAuctionNotification.mockResolvedValue({ success: true });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should process auction with no bids correctly", async () => {
      // テストデータの準備
      const user = userFactory.build();
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: user.id,
        task: "テストタスク",
      });

      // 終了時刻が過去のオークション
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      // 入札履歴なしのタスクデータ
      const taskWithRelations: TaskWithRelations = {
        id: task.id,
        task: task.task,
        groupId: group.id,
        auction: {
          id: auction.id,
          bidHistories: [], // 入札なし
        },
        group: {
          id: group.id,
        },
      };

      // Prismaモックの設定
      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ creatorId: user.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証
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

      // 通知が送信されることを確認
      expect(mockSendAuctionNotification).toHaveBeenCalledWith({
        auctionId: task.id,
        auctionEventType: AuctionEventType.ENDED,
        text: {
          first: task.task,
          second: task.task,
        },
        recipientUserId: [user.id],
        actionUrl: `/auctions/${task.id}`,
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
      });

      expect(mockSendAuctionNotification).toHaveBeenCalledWith({
        auctionId: task.id,
        auctionEventType: AuctionEventType.NO_WINNER,
        text: {
          first: task.task,
          second: task.task,
        },
        recipientUserId: [user.id],
        actionUrl: `/auctions/${task.id}`,
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
      });
    });

    test("should process auction with single bid correctly", async () => {
      // テストデータの準備
      const seller = userFactory.build();
      const bidder = userFactory.build();
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: seller.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder.id,
        auctionId: auction.id,
        amount: 100,
      });

      const groupPoint = groupPointFactory.build({
        userId: bidder.id,
        groupId: group.id,
        balance: 1000, // 十分な残高
      });

      // 入札ありのタスクデータ
      const taskWithRelations: TaskWithRelations = {
        id: task.id,
        task: task.task,
        groupId: group.id,
        auction: {
          id: auction.id,
          bidHistories: [
            {
              id: bidHistory.id,
              amount: bidHistory.amount,
              status: bidHistory.status,
              userId: bidHistory.userId,
              user: { id: bidder.id },
            },
          ],
        },
        group: {
          id: group.id,
        },
      };

      // Prismaモックの設定
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
            findUnique: vi.fn().mockResolvedValue({ creatorId: seller.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証
      expect(result).toBe(1);

      // 落札者への通知が送信されることを確認
      expect(mockSendAuctionNotification).toHaveBeenCalledWith({
        auctionId: task.id,
        auctionEventType: AuctionEventType.AUCTION_WIN,
        text: {
          first: task.task,
          second: task.task,
        },
        recipientUserId: [bidder.id],
        actionUrl: `/auctions/${task.id}`,
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
      });

      // 出品者への通知が送信されることを確認
      expect(mockSendAuctionNotification).toHaveBeenCalledWith({
        auctionId: task.id,
        auctionEventType: AuctionEventType.ITEM_SOLD,
        text: {
          first: task.task,
          second: task.task,
        },
        recipientUserId: [seller.id],
        actionUrl: `/auctions/${task.id}`,
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
      });
    });

    test("should process auction with multiple bids correctly", async () => {
      // テストデータの準備
      const seller = userFactory.build();
      const bidder1 = userFactory.build();
      const bidder2 = userFactory.build();
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: seller.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      // 複数の入札履歴（金額の降順で並んでいる）
      const bidHistory1 = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder1.id,
        auctionId: auction.id,
        amount: 200, // 最高額
      });

      const bidHistory2 = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder2.id,
        auctionId: auction.id,
        amount: 150, // 次点
      });

      const groupPoint = groupPointFactory.build({
        userId: bidder1.id,
        groupId: group.id,
        balance: 1000, // 十分な残高
      });

      // 複数入札ありのタスクデータ
      const taskWithRelations: TaskWithRelations = {
        id: task.id,
        task: task.task,
        groupId: group.id,
        auction: {
          id: auction.id,
          bidHistories: [
            {
              id: bidHistory1.id,
              amount: bidHistory1.amount,
              status: bidHistory1.status,
              userId: bidHistory1.userId,
              user: { id: bidder1.id },
            },
            {
              id: bidHistory2.id,
              amount: bidHistory2.amount,
              status: bidHistory2.status,
              userId: bidder2.id,
              user: { id: bidder2.id },
            },
          ], // 金額降順
        },
        group: {
          id: group.id,
        },
      };

      // Prismaモックの設定
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
            findUnique: vi.fn().mockResolvedValue({ creatorId: seller.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証
      expect(result).toBe(1);

      // 落札者（bidder1）への通知が送信されることを確認
      expect(mockSendAuctionNotification).toHaveBeenCalledWith({
        auctionId: task.id,
        auctionEventType: AuctionEventType.AUCTION_WIN,
        text: {
          first: task.task,
          second: task.task,
        },
        recipientUserId: [bidder1.id],
        actionUrl: `/auctions/${task.id}`,
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
      });
    });

    test("should return 0 when no auctions need to be processed", async () => {
      // 処理対象のオークションがない場合
      vi.mocked(prismaMock.task.findMany).mockResolvedValue([]);

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証
      expect(result).toBe(0);
      expect(mockConsoleLog).toHaveBeenCalledWith("処理対象のオークション: 0件");
    });

    test("should handle multiple auctions", async () => {
      // 複数のオークションを処理する場合
      const user1 = userFactory.build();
      const user2 = userFactory.build();
      const group = groupFactory.build();

      const task1 = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: user1.id,
        task: "テストタスク1",
      });

      const task2 = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: user2.id,
        task: "テストタスク2",
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

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

      const tasksWithRelations: TaskWithRelations[] = [
        {
          id: task1.id,
          task: task1.task,
          groupId: group.id,
          auction: {
            id: auction1.id,
            bidHistories: [],
          },
          group: {
            id: group.id,
          },
        },
        {
          id: task2.id,
          task: task2.task,
          groupId: group.id,
          auction: {
            id: auction2.id,
            bidHistories: [],
          },
          group: {
            id: group.id,
          },
        },
      ];

      // Prismaモックの設定
      vi.mocked(prismaMock.task.findMany).mockResolvedValue(tasksWithRelations as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValueOnce({ creatorId: user1.id }).mockResolvedValueOnce({ creatorId: user2.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証
      expect(result).toBe(2);
      expect(mockConsoleLog).toHaveBeenCalledWith("処理対象のオークション: 2件");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should throw error when database operation fails", async () => {
      // データベースエラーをシミュレート
      const dbError = new Error("Database connection failed");
      vi.mocked(prismaMock.task.findMany).mockRejectedValue(dbError);

      // テスト実行と検証
      await expect(updateAuctionStatusToCompleted()).rejects.toThrow("Database connection failed");
      expect(mockConsoleError).toHaveBeenCalledWith("オークション終了処理でエラーが発生しました:", dbError);
    });

    test("should handle insufficient points for winner", async () => {
      // ポイント不足のテストデータ準備
      const seller = userFactory.build();
      const bidder1 = userFactory.build();
      const bidder2 = userFactory.build();
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: seller.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory1 = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder1.id,
        auctionId: auction.id,
        amount: 200, // 最高額
      });

      const bidHistory2 = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder2.id,
        auctionId: auction.id,
        amount: 150, // 次点
      });

      // ポイント不足のgroupPoint（落札額151ポイント必要だが100ポイントしかない）
      const insufficientGroupPoint = groupPointFactory.build({
        userId: bidder1.id,
        groupId: group.id,
        balance: 100, // 不足
      });

      const taskWithRelations: TaskWithRelations = {
        id: task.id,
        task: task.task,
        groupId: group.id,
        auction: {
          id: auction.id,
          bidHistories: [
            {
              id: bidHistory1.id,
              amount: bidHistory1.amount,
              status: bidHistory1.status,
              userId: bidHistory1.userId,
              user: { id: bidder1.id },
            },
            {
              id: bidHistory2.id,
              amount: bidHistory2.amount,
              status: bidHistory2.status,
              userId: bidder2.id,
              user: { id: bidder2.id },
            },
          ],
        },
        group: {
          id: group.id,
        },
      };

      // Prismaモックの設定
      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          groupPoint: {
            findUnique: vi.fn().mockResolvedValue(insufficientGroupPoint),
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
            findUnique: vi.fn().mockResolvedValue({ creatorId: seller.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証
      expect(result).toBe(1);
    });

    test("should handle transaction failure", async () => {
      // トランザクション内でエラーが発生する場合
      const user = userFactory.build();
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: user.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const taskWithRelations: TaskWithRelations = {
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
      };

      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      // トランザクション内でエラーを発生させる
      const transactionError = new Error("Transaction failed");
      vi.mocked(prismaMock.$transaction).mockRejectedValue(transactionError);

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証
      expect(result).toBe(0); // エラーが発生したオークションは処理されない
      expect(mockConsoleError).toHaveBeenCalledWith(`オークション(ID: ${task.id})の処理中にエラーが発生:`, transactionError);
    });

    test("should handle notification sending failure", async () => {
      // 通知送信が失敗する場合
      const user = userFactory.build();
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: user.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const taskWithRelations: TaskWithRelations = {
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
      };

      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ creatorId: user.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // 通知送信を失敗させる
      mockSendAuctionNotification.mockResolvedValue({ success: false, error: "Notification failed" });

      // テスト実行（通知失敗でもオークション処理は完了する）
      const result = await updateAuctionStatusToCompleted();

      // 検証
      expect(result).toBe(1);
      expect(mockSendAuctionNotification).toHaveBeenCalled();
    });

    test("should handle null or undefined auction data", async () => {
      // オークションデータがnullまたはundefinedの場合
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: "group-id",
        creatorId: "user-id",
        task: "テストタスク",
      });

      const taskWithRelations: TaskWithRelations = {
        id: task.id,
        task: task.task,
        groupId: task.groupId,
        auction: null as any, // nullのオークション
        group: {
          id: task.groupId,
        },
      };

      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ creatorId: "user-id" }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証（nullのオークションは入札なしとして処理される）
      expect(result).toBe(1);
    });

    test("should handle empty creator ID", async () => {
      // 作成者IDが取得できない場合
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const taskWithRelations: TaskWithRelations = {
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
      };

      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue(null), // 作成者が見つからない
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証
      expect(result).toBe(1);
      // 作成者が見つからない場合、通知は送信されない（sendNotification内でスキップされる）
      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    test("should handle exactly current time as boundary", async () => {
      // 現在時刻ちょうどの境界値テスト
      const user = userFactory.build();
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: user.id,
        task: "テストタスク",
      });

      // 現在時刻ちょうどに終了するオークション
      const now = new Date();
      const auction = auctionFactory.build({
        endTime: now,
        taskId: task.id,
        groupId: group.id,
      });

      const taskWithRelations: TaskWithRelations = {
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
      };

      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ creatorId: user.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証
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
      // 入札額が0の場合
      const seller = userFactory.build();
      const bidder = userFactory.build();
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: seller.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder.id,
        auctionId: auction.id,
        amount: 0, // 0ポイント入札
      });

      const groupPoint = groupPointFactory.build({
        userId: bidder.id,
        groupId: group.id,
        balance: 1000,
      });

      const taskWithRelations: TaskWithRelations = {
        id: task.id,
        task: task.task,
        groupId: group.id,
        auction: {
          id: auction.id,
          bidHistories: [
            {
              id: bidHistory.id,
              amount: bidHistory.amount,
              status: bidHistory.status,
              userId: bidHistory.userId,
              user: { id: bidder.id },
            },
          ],
        },
        group: {
          id: group.id,
        },
      };

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
            findUnique: vi.fn().mockResolvedValue({ creatorId: seller.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証（0ポイント入札でも処理される）
      expect(result).toBe(1);
    });

    test("should handle maximum integer bid amount", async () => {
      // 最大整数値の入札額
      const seller = userFactory.build();
      const bidder = userFactory.build();
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: seller.id,
        task: "テストタスク",
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const maxAmount = Number.MAX_SAFE_INTEGER;
      const bidHistory = bidHistoryFactory.build({
        status: BidStatus.BIDDING,
        userId: bidder.id,
        auctionId: auction.id,
        amount: maxAmount,
      });

      const groupPoint = groupPointFactory.build({
        userId: bidder.id,
        groupId: group.id,
        balance: maxAmount, // 十分な残高
      });

      const taskWithRelations: TaskWithRelations = {
        id: task.id,
        task: task.task,
        groupId: group.id,
        auction: {
          id: auction.id,
          bidHistories: [
            {
              id: bidHistory.id,
              amount: bidHistory.amount,
              status: bidHistory.status,
              userId: bidHistory.userId,
              user: { id: bidder.id },
            },
          ],
        },
        group: {
          id: group.id,
        },
      };

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
            findUnique: vi.fn().mockResolvedValue({ creatorId: seller.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証
      expect(result).toBe(1);
    });

    test("should handle empty task name", async () => {
      // タスク名が空文字の場合
      const user = userFactory.build();
      const group = groupFactory.build();
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: user.id,
        task: "", // 空文字
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const taskWithRelations: TaskWithRelations = {
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
      };

      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ creatorId: user.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証（空文字のタスク名でも処理される）
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
      // 非常に長いタスク名の場合
      const user = userFactory.build();
      const group = groupFactory.build();
      const longTaskName = "a".repeat(1000); // 1000文字のタスク名
      const task = taskFactory.build({
        status: TaskStatus.AUCTION_ACTIVE,
        groupId: group.id,
        creatorId: user.id,
        task: longTaskName,
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const auction = auctionFactory.build({
        endTime: pastDate,
        taskId: task.id,
        groupId: group.id,
      });

      const taskWithRelations: TaskWithRelations = {
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
      };

      vi.mocked(prismaMock.task.findMany).mockResolvedValue([taskWithRelations] as any);

      vi.mocked(prismaMock.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ creatorId: user.id }),
          },
        };
        return await callback(mockTx as unknown as PrismaTransaction);
      });

      // テスト実行
      const result = await updateAuctionStatusToCompleted();

      // 検証（長いタスク名でも処理される）
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
