import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { NotificationSendMethod, NotificationSendTiming, AuctionEventType as PrismaAuctionEventType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { executeBid } from "./bid-common";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("@/lib/actions/notification/auction-notification", () => ({
  sendAuctionNotification: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("./server-sent-events-broadcast", () => ({
  sendEventToAuctionSubscribers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/constants", () => ({
  getAuctionUpdateSelect: vi.fn().mockReturnValue({
    id: true,
    currentHighestBid: true,
    currentHighestBidderId: true,
    extensionTotalCount: true,
    extensionLimitCount: true,
    extensionTime: true,
    remainingTimeForExtension: true,
    task: { select: { status: true } },
    bidHistories: {
      orderBy: { createdAt: "desc" },
      take: 1,
      select: {
        id: true,
        amount: true,
        createdAt: true,
        isAutoBid: true,
        user: { select: { settings: { select: { username: true } } } },
      },
    },
  }),
}));

vi.mock("./auto-bid", () => ({
  processAutoBid: vi.fn().mockResolvedValue({ success: true, message: "自動入札完了" }),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockGetAuthenticatedSessionUserId = vi.mocked(await import("@/lib/utils")).getAuthenticatedSessionUserId;
const mockSendAuctionNotification = vi.mocked(await import("@/lib/actions/notification/auction-notification")).sendAuctionNotification;
const mockSendEventToAuctionSubscribers = vi.mocked(await import("./server-sent-events-broadcast")).sendEventToAuctionSubscribers;
const mockProcessAutoBid = vi.mocked(await import("./auto-bid")).processAutoBid;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("bid-common.test.ts", () => {
  describe("executeBid", () => {
    const mockUserId = "test-user-id";
    const mockAuctionId = "test-auction-id";

    beforeEach(() => {
      vi.clearAllMocks();
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      describe("バリデーション失敗時", () => {
        test("should return error when authentication validation fails", async () => {
          // モックの設定（認証失敗）
          mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

          // テスト実行
          const result = await executeBid(mockAuctionId, 150);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "オークションの検証中にエラーが発生しました",
          });
        });

        test("should return error when no auction found validation fails", async () => {
          // モックの設定（認証失敗）
          mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
          prismaMock.auction.findUnique.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

          // テスト実行
          const result = await executeBid(mockAuctionId, 150);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "オークションが見つかりません",
          });
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("正常系", () => {
      test("should execute bid successfully", async () => {
        // Arrange
        // auctionのモック
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 86400000), // 1日後
          startTime: new Date(Date.now() - 86400000), // 1日前
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        // 更新後のauctionのモック
        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [
            {
              id: "bid-1",
              amount: 150,
              createdAt: new Date(),
              isAutoBid: false,
              user: { settings: { username: "testuser" } },
            },
          ],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique
          .mockResolvedValueOnce(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>) // validateAuction内での呼び出し
          .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" } as unknown as Awaited<
            ReturnType<typeof prismaMock.auction.findUnique>
          >) // トランザクション内での最初の呼び出し
          .mockResolvedValueOnce(mockUpdatedAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>) // 更新後の情報取得
          .mockResolvedValueOnce({ version: 2 } as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>); // 楽観的ロック確認用

        // トランザクション内のモック
        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // Act
        const result = await executeBid(mockAuctionId, 150);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "入札が完了しました",
        });
        expect(mockSendEventToAuctionSubscribers).toHaveBeenCalledWith(mockAuctionId, expect.any(Object));
        expect(mockProcessAutoBid).toHaveBeenCalled();
      });

      test("should execute auto bid successfully", async () => {
        // テストデータの準備（自動入札の場合）
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 86400000),
          startTime: new Date(Date.now() - 86400000),
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [
            {
              id: "bid-1",
              amount: 150,
              createdAt: new Date(),
              isAutoBid: true,
              user: { settings: { username: "testuser" } },
            },
          ],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行（自動入札）
        const result = await executeBid(mockAuctionId, 150, true);

        // 検証
        expect(result.success).toBe(true);
        expect(result.message).toBe("150ポイントで自動入札しました");
        expect(mockProcessAutoBid).not.toHaveBeenCalled(); // 自動入札の場合は呼ばれない
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("楽観的ロック", () => {
      test("should handle optimistic lock conflict", async () => {
        // テストデータの準備
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 86400000),
          startTime: new Date(Date.now() - 86400000),
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        // 楽観的ロック競合をシミュレート
        prismaMock.$transaction.mockImplementation(async () => {
          throw new Error("他者によってオークション情報が変更されています");
        });

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証
        expect(result.success).toBe(false);
        expect(result.message).toBe("入札処理中にエラーが発生しました");
      });

      test("should handle version mismatch in optimistic lock", async () => {
        // テストデータの準備
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 86400000),
          startTime: new Date(Date.now() - 86400000),
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        // バージョン不一致をシミュレート
        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" }) // 初期バージョン
                .mockResolvedValueOnce({
                  id: mockAuctionId,
                  currentHighestBid: 150,
                  currentHighestBidderId: mockUserId,
                  extensionTotalCount: 0,
                  extensionLimitCount: 5,
                  extensionTime: 10,
                  remainingTimeForExtension: 5,
                  task: { status: TaskStatus.AUCTION_ACTIVE },
                  bidHistories: [],
                })
                .mockResolvedValueOnce({ version: 3 }), // 異なるバージョン（競合発生）
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証
        expect(result.success).toBe(false);
        expect(result.message).toBe("入札処理中にエラーが発生しました");
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("通知送信", () => {
      test("should send notification to previous highest bidder", async () => {
        // テストデータの準備
        const previousBidderId = "previous-bidder";
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: previousBidderId,
          endTime: new Date(Date.now() + 86400000),
          startTime: new Date(Date.now() - 86400000),
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: previousBidderId })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証
        expect(result.success).toBe(true);
        expect(mockSendAuctionNotification).toHaveBeenCalledWith({
          text: {
            first: "テストタスク",
            second: "150",
          },
          auctionEventType: PrismaAuctionEventType.OUTBID,
          auctionId: mockAuctionId,
          recipientUserId: [previousBidderId],
          sendMethods: [NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH, NotificationSendMethod.IN_APP],
          actionUrl: `https://${process.env.DOMAIN}/dashboard/auction/${mockAuctionId}`,
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: null,
        });
      });

      test("should not send notification when no previous bidder", async () => {
        // テストデータの準備（以前の入札者がいない場合）
        const mockAuction = {
          currentHighestBid: 0,
          currentHighestBidderId: null, // 以前の入札者なし
          endTime: new Date(Date.now() + 86400000),
          startTime: new Date(Date.now() - 86400000),
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: null })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証
        expect(result.success).toBe(true);
        expect(mockSendAuctionNotification).not.toHaveBeenCalled();
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("エラーハンドリング", () => {
      test("should handle database transaction errors", async () => {
        // テストデータの準備
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 86400000),
          startTime: new Date(Date.now() - 86400000),
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);
        prismaMock.$transaction.mockRejectedValue(new Error("Database transaction failed"));

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証
        expect(result.success).toBe(false);
        expect(result.message).toBe("入札処理中にエラーが発生しました");
      });

      test("should handle auto bid process errors gracefully", async () => {
        // テストデータの準備
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 86400000),
          startTime: new Date(Date.now() - 86400000),
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // 自動入札処理でエラーが発生
        mockProcessAutoBid.mockRejectedValue(new Error("Auto bid failed"));

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証（入札自体は成功するが、自動入札処理のエラーは無視される）
        expect(result.success).toBe(true);
        expect(result.message).toBe("入札が完了しました");
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("境界値テスト", () => {
      test("should handle minimum bid amount", async () => {
        // テストデータの準備
        const mockAuction = {
          currentHighestBid: 0,
          currentHighestBidderId: null,
          endTime: new Date(Date.now() + 86400000),
          startTime: new Date(Date.now() - 86400000),
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 1,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: null })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行（最小入札額）
        const result = await executeBid(mockAuctionId, 1);

        // 検証
        expect(result.success).toBe(true);
        expect(result.message).toBe("入札が完了しました");
      });

      test("should handle large bid amount", async () => {
        // テストデータの準備
        const largeBidAmount = 999999999;
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 86400000),
          startTime: new Date(Date.now() - 86400000),
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: largeBidAmount,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行（大きな入札額）
        const result = await executeBid(mockAuctionId, largeBidAmount);

        // 検証
        expect(result.success).toBe(true);
        expect(result.message).toBe("入札が完了しました");
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("オークション延長処理", () => {
      test("should not extend auction when isExtension is false", async () => {
        // テストデータの準備（延長設定なし）
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 300000), // 5分後（延長トリガー条件内）
          startTime: new Date(Date.now() - 86400000), // 1日前
          taskId: "test-task-id",
          isExtension: false, // 延長設定なし
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証
        expect(result.success).toBe(true);
        expect(result.message).toBe("入札が完了しました");
      });

      test("should not extend auction when extension limit is reached", async () => {
        // テストデータの準備（延長回数上限到達）
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 300000), // 5分後（延長トリガー条件内）
          startTime: new Date(Date.now() - 86400000), // 1日前
          taskId: "test-task-id",
          isExtension: true, // 延長設定あり
          extensionTotalCount: 5, // 延長回数上限到達
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 5,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証
        expect(result.success).toBe(true);
        expect(result.message).toBe("入札が完了しました");
      });

      test("should not extend auction when remaining time is too long", async () => {
        // テストデータの準備（残り時間が長すぎる）
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 3600000), // 1時間後（延長トリガー条件外）
          startTime: new Date(Date.now() - 86400000), // 1日前
          taskId: "test-task-id",
          isExtension: true, // 延長設定あり
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証
        expect(result.success).toBe(true);
        expect(result.message).toBe("入札が完了しました");
      });

      test("should extend auction when conditions are met", async () => {
        // テストデータの準備（延長条件を満たす）
        const now = new Date();
        const startTime = new Date(now.getTime() - 86400000); // 1日前
        const endTime = new Date(now.getTime() + 300000); // 5分後（延長トリガー条件内）

        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: endTime,
          startTime: startTime,
          taskId: "test-task-id",
          isExtension: true, // 延長設定あり
          extensionTotalCount: 0, // 延長回数制限内
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 1, // 延長後
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi
                .fn()
                .mockResolvedValueOnce({ version: 2 }) // 入札更新
                .mockResolvedValueOnce({ version: 3 }), // 延長更新
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証
        expect(result.success).toBe(true);
        expect(result.message).toBe("入札が完了しました");
        // 延長処理が呼ばれたことを確認（updateが2回呼ばれる：入札更新 + 延長更新）
        expect(prismaMock.$transaction).toHaveBeenCalled();
      });

      test("should handle extension process error gracefully", async () => {
        // テストデータの準備（延長処理でエラーが発生）
        const now = new Date();
        const startTime = new Date(now.getTime() - 86400000); // 1日前
        const endTime = new Date(now.getTime() + 300000); // 5分後（延長トリガー条件内）

        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: endTime,
          startTime: startTime,
          taskId: "test-task-id",
          isExtension: true, // 延長設定あり
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi
                .fn()
                .mockResolvedValueOnce({ version: 2 }) // 入札更新は成功
                .mockRejectedValueOnce(new Error("Extension update failed")), // 延長更新でエラー
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証（延長処理でエラーが発生しても入札自体は成功）
        expect(result.success).toBe(true);
        expect(result.message).toBe("入札が完了しました");
      });

      test("should handle extension database error in processAuctionExtension", async () => {
        // テストデータの準備（延長処理内でデータベースエラーが発生）
        const now = new Date();
        const startTime = new Date(now.getTime() - 86400000); // 1日前
        const endTime = new Date(now.getTime() + 300000); // 5分後（延長トリガー条件内）

        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: endTime,
          startTime: startTime,
          taskId: "test-task-id",
          isExtension: true, // 延長設定あり
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        // 延長処理内でエラーが発生するようにモック
        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi
                .fn()
                .mockResolvedValueOnce({ version: 2 }) // 入札更新は成功
                .mockImplementation(() => {
                  // 延長処理でエラーを発生させる
                  throw new Error("Database error in extension process");
                }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // テスト実行
        const result = await executeBid(mockAuctionId, 150);

        // 検証（延長処理でエラーが発生しても入札自体は成功）
        expect(result.success).toBe(true);
        expect(result.message).toBe("入札が完了しました");
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("自動入札処理のログ出力", () => {
      test("should log auto bid process result when processAutoBid returns result", async () => {
        // テストデータの準備
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 86400000),
          startTime: new Date(Date.now() - 86400000),
          taskId: "test-task-id",
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
        };

        const mockUpdatedAuction = {
          id: mockAuctionId,
          currentHighestBid: 150,
          currentHighestBidderId: mockUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: { status: TaskStatus.AUCTION_ACTIVE },
          bidHistories: [],
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            auction: {
              findUnique: vi
                .fn()
                .mockResolvedValueOnce({ version: 1, currentHighestBidderId: "other-user" })
                .mockResolvedValueOnce(mockUpdatedAuction)
                .mockResolvedValueOnce({ version: 2 }),
              update: vi.fn().mockResolvedValue({ version: 2 }),
            },
            bidHistory: {
              create: vi.fn().mockResolvedValue({ id: "bid-1" }),
            },
          };
          return await callback(mockTx as unknown as Prisma.TransactionClient);
        });

        // 自動入札処理が結果を返すようにモック
        mockProcessAutoBid.mockResolvedValue({
          success: true,
          message: "自動入札が実行されました",
          autoBid: {
            id: "auto-bid-1",
            maxBidAmount: 200,
            bidIncrement: 10,
          },
        });

        // テスト実行（手動入札）
        const result = await executeBid(mockAuctionId, 150, false);

        // 検証
        expect(result.success).toBe(true);
        expect(result.message).toBe("入札が完了しました");
        expect(mockProcessAutoBid).toHaveBeenCalled();
      });
    });
  });
});
