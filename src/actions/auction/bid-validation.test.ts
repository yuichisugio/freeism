import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { validateAuction } from "./bid-validation";

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
    bidHistories: null,
    version: null,
    status: TaskStatus.AUCTION_ACTIVE,
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("bid-common.test.ts", () => {
  describe("validateAuction", () => {
    // テストデータの準備
    const mockUserId = "test-user-id";
    const mockAuctionId = "test-auction-id";

    beforeEach(() => {
      vi.clearAllMocks();
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    describe("異常系", () => {
      describe("認証チェック", () => {
        test("should return error when user is not authenticated", async () => {
          // モックの設定（認証失敗時はredirectが呼ばれるため、エラーをthrowする）
          mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

          // テスト実行とエラーの検証
          await expect(
            validateAuction(mockAuctionId, {
              checkSelfListing: null,
              checkEndTime: null,
              checkCurrentBid: null,
              currentBid: null,
              requireActive: null,
              executeBid: null,
            }),
          ).rejects.toThrow("Authentication failed");

          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        });
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      describe("オークション存在チェック", () => {
        test("should return error when auction is not found", async () => {
          // モックの設定
          mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
          prismaMock.auction.findUnique.mockResolvedValue(
            null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
          );

          // テスト実行
          const result = await validateAuction(mockAuctionId, {
            checkSelfListing: null,
            checkEndTime: null,
            checkCurrentBid: null,
            currentBid: null,
            requireActive: null,
            executeBid: null,
          });

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "オークションが見つかりません",
            data: {
              userId: mockUserId,
              auction: null,
            },
          });
        });
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      describe("自分の出品チェック", () => {
        test("should return error when user tries to bid on own auction with checkSelfListing option", async () => {
          // テストデータの準備
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
              executors: [{ userId: mockUserId }], // 自分がexecutor
              task: "テストタスク",
              status: TaskStatus.AUCTION_ACTIVE,
              detail: "詳細",
            },
          };

          // モックの設定
          mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
          prismaMock.auction.findUnique.mockResolvedValue(
            mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
          );

          // テスト実行
          const result = await validateAuction(mockAuctionId, {
            checkSelfListing: true,
            checkEndTime: null,
            checkCurrentBid: null,
            currentBid: null,
            requireActive: null,
            executeBid: null,
          });

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "自分の出品に対して操作はできません",
            data: {
              userId: mockUserId,
              auction: null,
            },
          });
        });

        test("should return error when user tries to bid on own auction with executeBid option", async () => {
          // テストデータの準備
          const mockAuction = {
            currentHighestBid: 100,
            currentHighestBidderId: "other-user",
            endTime: new Date(Date.now() + 86400000), // 1日後
            startTime: new Date(Date.now() - 86400000), // 1日前
            isExtension: false,
            extensionTotalCount: 0,
            extensionLimitCount: 5,
            extensionTime: 10,
            remainingTimeForExtension: 5,
            task: {
              creator: { id: "other-user" },
              executors: [{ userId: mockUserId }], // 自分がexecutor
              task: "テストタスク",
              status: TaskStatus.AUCTION_ACTIVE,
              detail: "詳細",
            },
          };

          // モックの設定
          mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
          prismaMock.auction.findUnique.mockResolvedValue(
            mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
          );

          // テスト実行
          const result = await validateAuction(mockAuctionId, {
            checkSelfListing: null,
            checkEndTime: null,
            checkCurrentBid: null,
            currentBid: null,
            requireActive: null,
            executeBid: true,
          });

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "自分の出品に対して操作はできません",
            data: {
              userId: mockUserId,
              auction: null,
            },
          });
        });
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      describe("終了時間チェック", () => {
        test("should return error when auction has ended with checkEndTime option", async () => {
          // テストデータの準備
          const mockAuction = {
            currentHighestBid: 100,
            currentHighestBidderId: "other-user",
            endTime: new Date(Date.now() - 86400000), // 1日前（終了済み）
            startTime: new Date(Date.now() - 172800000), // 2日前
            taskId: "test-task-id",
            isExtension: false,
            extensionTotalCount: 0,
            extensionLimitCount: 5,
            extensionTime: 10,
            remainingTimeForExtension: 5,
            task: {
              creator: { id: "other-user" },
              executors: [{ userId: "another-user" }],
              task: "テストタスク",
              status: TaskStatus.AUCTION_ACTIVE,
              detail: "詳細",
            },
          };

          // モックの設定
          mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
          prismaMock.auction.findUnique.mockResolvedValue(
            mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
          );

          // テスト実行
          const result = await validateAuction(mockAuctionId, {
            checkSelfListing: null,
            checkEndTime: true,
            checkCurrentBid: null,
            currentBid: null,
            requireActive: null,
            executeBid: null,
          });

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "このオークションは終了しています",
            data: {
              userId: mockUserId,
              auction: null,
            },
          });
        });

        test("should return error when auction has ended with executeBid option", async () => {
          // テストデータの準備
          const mockAuction = {
            currentHighestBid: 100,
            currentHighestBidderId: "other-user",
            endTime: new Date(Date.now() - 86400000), // 1日前（終了済み）
            startTime: new Date(Date.now() - 172800000), // 2日前
            isExtension: false,
            extensionTotalCount: 0,
            extensionLimitCount: 5,
            extensionTime: 10,
            remainingTimeForExtension: 5,
            task: {
              creator: { id: "other-user" },
              executors: [{ userId: "another-user" }],
              task: "テストタスク",
              status: TaskStatus.AUCTION_ACTIVE,
              detail: "詳細",
            },
          };

          // モックの設定
          mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
          prismaMock.auction.findUnique.mockResolvedValue(
            mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
          );

          // テスト実行
          const result = await validateAuction(mockAuctionId, {
            checkSelfListing: null,
            checkEndTime: null,
            checkCurrentBid: null,
            currentBid: null,
            requireActive: null,
            executeBid: true,
          });

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "このオークションは終了しています",
            data: {
              userId: mockUserId,
              auction: null,
            },
          });
        });
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      describe("アクティブ状態チェック", () => {
        test("should return error when auction is not active with requireActive option", async () => {
          // テストデータの準備
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
              executors: [{ userId: "another-user" }],
              task: "テストタスク",
              status: TaskStatus.PENDING, // アクティブでない
              detail: "詳細",
            },
          };

          // モックの設定
          mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
          prismaMock.auction.findUnique.mockResolvedValue(
            mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
          );

          // テスト実行
          const result = await validateAuction(mockAuctionId, {
            checkSelfListing: null,
            checkEndTime: null,
            checkCurrentBid: null,
            currentBid: null,
            requireActive: true,
            executeBid: null,
          });

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "このオークションはアクティブではありません",
            data: {
              userId: mockUserId,
              auction: null,
            },
          });
        });

        test("should return error when auction is not active with executeBid option", async () => {
          // テストデータの準備
          const mockAuction = {
            currentHighestBid: 100,
            currentHighestBidderId: "other-user",
            endTime: new Date(Date.now() + 86400000), // 1日後
            startTime: new Date(Date.now() - 86400000), // 1日前
            isExtension: false,
            extensionTotalCount: 0,
            extensionLimitCount: 5,
            extensionTime: 10,
            remainingTimeForExtension: 5,
            task: {
              creator: { id: "other-user" },
              executors: [{ userId: "another-user" }],
              task: "テストタスク",
              status: TaskStatus.PENDING, // アクティブでない
              detail: "詳細",
            },
          };

          // モックの設定
          mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
          prismaMock.auction.findUnique.mockResolvedValue(
            mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
          );

          // テスト実行
          const result = await validateAuction(mockAuctionId, {
            checkSelfListing: null,
            checkEndTime: null,
            checkCurrentBid: null,
            currentBid: null,
            requireActive: null,
            executeBid: true,
          });

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "このオークションはアクティブではありません",
            data: {
              userId: mockUserId,
              auction: null,
            },
          });
        });
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      describe("現在の最高入札額チェック", () => {
        test("should return error when bid amount is not higher than current highest bid with checkCurrentBid option", async () => {
          // テストデータの準備
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
              executors: [{ userId: "another-user" }],
              task: "テストタスク",
              status: TaskStatus.AUCTION_ACTIVE,
              detail: "詳細",
            },
          };

          // モックの設定
          mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
          prismaMock.auction.findUnique.mockResolvedValue(
            mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
          );

          // テスト実行
          const result = await validateAuction(mockAuctionId, {
            checkSelfListing: null,
            checkEndTime: null,
            checkCurrentBid: true,
            currentBid: 50, // 現在の最高入札額より低い
            requireActive: null,
            executeBid: null,
          });

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "現在の最高入札額（100ポイント）より高い額で入札してください",
            data: {
              userId: mockUserId,
              auction: null,
            },
          });
        });

        test("should return error when bid amount is not higher than current highest bid with executeBid option", async () => {
          // テストデータの準備
          const mockAuction = {
            currentHighestBid: 100,
            currentHighestBidderId: "other-user",
            endTime: new Date(Date.now() + 86400000), // 1日後
            startTime: new Date(Date.now() - 86400000), // 1日前
            isExtension: false,
            extensionTotalCount: 0,
            extensionLimitCount: 5,
            extensionTime: 10,
            remainingTimeForExtension: 5,
            task: {
              creator: { id: "other-user" },
              executors: [{ userId: "another-user" }],
              task: "テストタスク",
              status: TaskStatus.AUCTION_ACTIVE,
              detail: "詳細",
            },
          };

          // モックの設定
          mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
          prismaMock.auction.findUnique.mockResolvedValue(
            mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
          );

          // テスト実行
          const result = await validateAuction(mockAuctionId, {
            checkSelfListing: null,
            checkEndTime: null,
            checkCurrentBid: null,
            currentBid: 50, // 現在の最高入札額より低い
            requireActive: null,
            executeBid: true,
          });

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "現在の最高入札額（100ポイント）より高い額で入札してください",
            data: {
              userId: mockUserId,
              auction: null,
            },
          });
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("正常系", () => {
      test("should return success when all validations pass with checkSelfListing, checkEndTime, checkCurrentBid, requireActive options", async () => {
        // テストデータの準備
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
            executors: [{ userId: "another-user" }],
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
          bidHistories: null,
          version: null,
          status: TaskStatus.AUCTION_ACTIVE,
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // テスト実行
        const result = await validateAuction(mockAuctionId, {
          checkSelfListing: true,
          checkEndTime: true,
          checkCurrentBid: true,
          currentBid: 150, // 現在の最高入札額より高い
          requireActive: true,
          executeBid: null,
        });

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "オークションの検証が完了しました",
          data: {
            userId: mockUserId,
            auction: mockAuction,
          },
        });
      });

      test("should return success when all validations pass with executeBid options", async () => {
        // テストデータの準備
        const mockAuction = {
          currentHighestBid: 100,
          currentHighestBidderId: "other-user",
          endTime: new Date(Date.now() + 86400000), // 1日後
          startTime: new Date(Date.now() - 86400000), // 1日前
          isExtension: false,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            creator: { id: "other-user" },
            executors: [{ userId: "another-user" }],
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
          bidHistories: null,
          version: null,
          status: TaskStatus.AUCTION_ACTIVE,
          taskId: "other-user",
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // テスト実行
        const result = await validateAuction(mockAuctionId, {
          checkSelfListing: null,
          checkEndTime: null,
          checkCurrentBid: null,
          currentBid: null,
          requireActive: null,
          executeBid: true,
        });

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "オークションの検証が完了しました",
          data: {
            userId: mockUserId,
            auction: mockAuction,
          },
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("エラーハンドリング", () => {
      test("should handle database errors gracefully", async () => {
        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockRejectedValue(new Error("Database error"));

        // テスト実行とエラーの検証
        await expect(
          validateAuction(mockAuctionId, {
            checkSelfListing: null,
            checkEndTime: null,
            checkCurrentBid: null,
            currentBid: null,
            requireActive: null,
            executeBid: null,
          }),
        ).rejects.toThrow("Database error");
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("境界値テスト", () => {
      test("should handle zero current bid amount", async () => {
        // テストデータの準備
        const mockAuction = {
          currentHighestBid: 0,
          currentHighestBidderId: null,
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
            executors: [{ userId: "another-user" }],
            task: "テストタスク",
            status: TaskStatus.AUCTION_ACTIVE,
            detail: "詳細",
          },
          bidHistories: null,
          version: null,
          status: TaskStatus.AUCTION_ACTIVE,
        };

        // モックの設定
        mockGetAuthenticatedSessionUserId.mockResolvedValue(mockUserId);
        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // テスト実行（現在の最高入札額が0の場合）
        const result = await validateAuction(mockAuctionId, {
          checkSelfListing: true,
          checkEndTime: true,
          checkCurrentBid: true,
          currentBid: 1, // 1ポイントで入札
          requireActive: true,
          executeBid: null,
        });

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "オークションの検証が完了しました",
          data: {
            userId: mockUserId,
            auction: mockAuction,
          },
        });
      });
    });
  });
});
