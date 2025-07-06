import type { UpdateAuctionWithDetails } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  NotificationSendMethod,
  NotificationSendTiming,
  AuctionEventType as PrismaAuctionEventType,
  TaskStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AuctionValidationData, ValidateAuctionResult } from "../bid-validation";
import { executeBid } from "./bid-common";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("@/actions/notification/auction-notification", () => ({
  sendAuctionNotification: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../server-sent-events-broadcast", () => ({
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

vi.mock("../auto-bid/auto-bid", () => ({
  executeAutoBid: vi.fn().mockResolvedValue({ success: true, message: "自動入札完了" }),
}));

vi.mock("../bid-validation", () => ({
  validateAuction: vi.fn(),
}));

vi.mock("./extend-auction-time", () => ({
  processAuctionExtension: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const { sendAuctionNotification: mockSendAuctionNotification } = vi.mocked(
  await import("@/actions/notification/auction-notification"),
);
const { sendEventToAuctionSubscribers: mockSendEventToAuctionSubscribers } = vi.mocked(
  await import("../server-sent-events-broadcast"),
);
const { executeAutoBid: mockProcessAutoBid } = vi.mocked(await import("../auto-bid/auto-bid"));
const { validateAuction: mockValidateAuction } = vi.mocked(await import("../bid-validation"));
const { processAuctionExtension: mockProcessAuctionExtension } = vi.mocked(await import("./extend-auction-time"));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通テストデータ
 */
const TEST_CONSTANTS = {
  USER_ID: "test-user-id",
  AUCTION_ID: "test-auction-id",
  TASK_ID: "test-task-id",
  OTHER_USER_ID: "other-user",
  PREVIOUS_BIDDER_ID: "previous-bidder",
  BID_AMOUNT: 150,
  CURRENT_HIGHEST_BID: 100,
} as const;

/**
 * 共通のオークションデータを生成するファクトリー関数
 */
function createMockAuctionData(overrides: Partial<AuctionValidationData> = {}): AuctionValidationData {
  const auctionData = {
    status: TaskStatus.AUCTION_ACTIVE,
    currentHighestBid: TEST_CONSTANTS.CURRENT_HIGHEST_BID,
    currentHighestBidderId: TEST_CONSTANTS.OTHER_USER_ID,
    endTime: new Date(Date.now() + 86400000), // 1日後
    startTime: new Date(Date.now() - 86400000), // 1日前
    taskId: TEST_CONSTANTS.TASK_ID,
    isExtension: false,
    extensionTotalCount: 0,
    extensionLimitCount: 5,
    extensionTime: 10,
    remainingTimeForExtension: 5,
    task: {
      creator: { id: TEST_CONSTANTS.OTHER_USER_ID },
      executors: [{ userId: TEST_CONSTANTS.OTHER_USER_ID }],
      task: "テストタスク",
      status: TaskStatus.AUCTION_ACTIVE,
      detail: "詳細",
    },
    bidHistories: null,
    version: null,
    ...overrides,
  };
  return auctionData;
}

/**
 * 共通の更新後オークションデータを生成するファクトリー関数
 */
function createMockUpdatedAuction(isAutoBid = false) {
  const updatedAuction = {
    id: TEST_CONSTANTS.AUCTION_ID,
    currentHighestBid: TEST_CONSTANTS.BID_AMOUNT,
    currentHighestBidderId: TEST_CONSTANTS.USER_ID,
    extensionTotalCount: 0,
    extensionLimitCount: 5,
    extensionTime: 10,
    remainingTimeForExtension: 5,
    task: { status: TaskStatus.AUCTION_ACTIVE },
    bidHistories: [
      {
        id: "bid-1",
        amount: TEST_CONSTANTS.BID_AMOUNT,
        createdAt: new Date(),
        isAutoBid,
        user: { settings: { username: "testuser" } },
      },
    ],
  };
  return updatedAuction;
}

/**
 * 共通のトランザクションモックを設定するヘルパー関数
 */
function setupTransactionMock(
  initialHighestBidderId: string | null = TEST_CONSTANTS.OTHER_USER_ID,
  shouldThrowError = false,
  errorMessage?: string,
  extensionResult?: { success: boolean; message: string },
) {
  // オークション延長処理のデフォルトモック設定
  const defaultExtensionResult = extensionResult ?? { success: true, message: "延長処理完了" };
  mockProcessAuctionExtension.mockResolvedValue({
    success: defaultExtensionResult.success,
    newEndTime: defaultExtensionResult.success ? new Date(Date.now() + 600000) : null,
    message: defaultExtensionResult.message,
  });

  if (shouldThrowError) {
    prismaMock.$transaction.mockRejectedValue(new Error(errorMessage ?? "Database transaction failed"));
    return;
  }

  const mockUpdatedAuction = createMockUpdatedAuction();

  prismaMock.$transaction.mockImplementation(async (callback) => {
    const mockTx = {
      auction: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ version: 1, currentHighestBidderId: initialHighestBidderId })
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
}

/**
 * 共通のバリデーション成功モックを設定するヘルパー関数
 */
function setupValidationSuccessMock(auctionDataOverrides: Partial<AuctionValidationData> = {}) {
  const mockAuctionData = createMockAuctionData(auctionDataOverrides);
  mockValidateAuction.mockResolvedValue({
    success: true,
    message: "オークションの検証が完了しました",
    userId: TEST_CONSTANTS.USER_ID,
    auction: mockAuctionData,
  });
}

/**
 * 共通のバリデーション失敗モックを設定するヘルパー関数
 */
function setupValidationFailureMock(message: string | null) {
  mockValidateAuction.mockResolvedValue({
    success: false,
    message: message ?? "入札に失敗しました",
    userId: TEST_CONSTANTS.USER_ID,
    auction: null,
  });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("bid-common.test.ts", () => {
  describe("executeBid", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      describe("バリデーション失敗時", () => {
        test("should return error when validateAuction throws error", async () => {
          // モックの設定（validateAuctionでエラー発生）
          mockValidateAuction.mockRejectedValue(new Error("Validation error"));

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "Validation error",
          });
        });

        // パラメータ化テスト：バリデーション失敗のケース
        test.each([
          {
            description: "オークションが見つからない場合",
            message: "オークションが見つかりません",
            expected: "オークションが見つかりません",
          },
          {
            description: "自分の出品に対する操作の場合",
            message: "自分の出品に対して操作はできません",
            expected: "自分の出品に対して操作はできません",
          },
          {
            description: "オークション終了の場合",
            message: "このオークションは終了しています",
            expected: "このオークションは終了しています",
          },
          {
            description: "非アクティブオークションの場合",
            message: "このオークションはアクティブではありません",
            expected: "このオークションはアクティブではありません",
          },
          {
            description: "入札額が低い場合",
            message: "現在の最高入札額（200ポイント）より高い額で入札してください",
            expected: "現在の最高入札額（200ポイント）より高い額で入札してください",
          },
          {
            description: "メッセージがnullの場合",
            message: null,
            expected: "入札に失敗しました",
          },
        ])("should return error when validateAuction returns failure - $description", async ({ message, expected }) => {
          // モックの設定
          setupValidationFailureMock(message);

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: expected,
          });
        });
      });

      describe("オークション延長処理エラー", () => {
        test("should handle auction extension error when processAuctionExtension returns failure", async () => {
          // モックの設定
          setupValidationSuccessMock();
          setupTransactionMock(TEST_CONSTANTS.OTHER_USER_ID, false, undefined, {
            success: false,
            message: "延長条件を満たしていません",
          });

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "延長条件を満たしていません",
          });

          // processAuctionExtensionが呼び出されたことを確認
          expect(mockProcessAuctionExtension).toHaveBeenCalledWith({
            auctionId: TEST_CONSTANTS.AUCTION_ID,
            auction: expect.any(Object) as AuctionValidationData,
            tx: expect.any(Object) as Prisma.TransactionClient,
          });
        });

        test("should handle auction extension error when processAuctionExtension throws error", async () => {
          // モックの設定
          setupValidationSuccessMock();

          // processAuctionExtensionでエラーを投げる
          mockProcessAuctionExtension.mockRejectedValue(new Error("延長処理中にエラーが発生しました"));

          prismaMock.$transaction.mockImplementation(async (callback) => {
            const mockTx = {
              auction: {
                findUnique: vi
                  .fn()
                  .mockResolvedValueOnce({ version: 1, currentHighestBidderId: TEST_CONSTANTS.OTHER_USER_ID })
                  .mockResolvedValueOnce(createMockUpdatedAuction())
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
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "延長処理中にエラーが発生しました",
          });
        });
      });

      describe("データベースエラー", () => {
        test("should handle database transaction errors", async () => {
          // モックの設定
          setupValidationSuccessMock();
          setupTransactionMock(TEST_CONSTANTS.OTHER_USER_ID, true, "Database transaction failed");

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "Database transaction failed",
          });
        });
      });

      describe("楽観的ロック/transactionエラー", () => {
        test("should handle transaction auction not found at start", async () => {
          // モックの設定
          setupValidationSuccessMock();
          prismaMock.$transaction.mockImplementation(async (callback) => {
            const mockTx = {
              auction: {
                findUnique: vi.fn().mockResolvedValueOnce(null),
              },
            };
            return await callback(mockTx as unknown as Prisma.TransactionClient);
          });

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "入札対象のオークションが見つかりません",
          });
        });

        test("should handle auction update returning null", async () => {
          // モックの設定
          setupValidationSuccessMock();

          // auction.updateがnullを返すケースをシミュレート
          prismaMock.$transaction.mockImplementation(async (callback) => {
            const mockTx = {
              auction: {
                findUnique: vi
                  .fn()
                  .mockResolvedValueOnce({ version: 1, currentHighestBidderId: TEST_CONSTANTS.OTHER_USER_ID }),
                update: vi.fn().mockResolvedValue(null), // updateがnullを返す
              },
              bidHistory: {
                create: vi.fn().mockResolvedValue({ id: "bid-1" }),
              },
            };
            return await callback(mockTx as unknown as Prisma.TransactionClient);
          });

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "オークション情報を更新できませんでした",
          });
        });

        test("should handle updated auction data not found", async () => {
          // モックの設定
          setupValidationSuccessMock();

          // 更新後のオークション情報取得でnullが返されるケースをシミュレート
          prismaMock.$transaction.mockImplementation(async (callback) => {
            const mockTx = {
              auction: {
                findUnique: vi
                  .fn()
                  .mockResolvedValueOnce({ version: 1, currentHighestBidderId: TEST_CONSTANTS.OTHER_USER_ID })
                  .mockResolvedValueOnce(null), // 更新後の情報取得でnullを返す
                update: vi.fn().mockResolvedValue({ version: 2 }),
              },
              bidHistory: {
                create: vi.fn().mockResolvedValue({ id: "bid-1" }),
              },
            };
            return await callback(mockTx as unknown as Prisma.TransactionClient);
          });

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "更新されたオークション情報を取得できませんでした",
          });
        });

        test("should handle optimistic lock end version not found", async () => {
          // モックの設定
          setupValidationSuccessMock();

          // 楽観的ロック終了時のバージョン取得でnullが返されるケースをシミュレート
          prismaMock.$transaction.mockImplementation(async (callback) => {
            const mockTx = {
              auction: {
                findUnique: vi
                  .fn()
                  .mockResolvedValueOnce({ version: 1, currentHighestBidderId: TEST_CONSTANTS.OTHER_USER_ID })
                  .mockResolvedValueOnce(createMockUpdatedAuction())
                  .mockResolvedValueOnce(null), // 終了時のバージョン取得でnullを返す
                update: vi.fn().mockResolvedValue({ version: 2 }),
              },
              bidHistory: {
                create: vi.fn().mockResolvedValue({ id: "bid-1" }),
              },
            };
            return await callback(mockTx as unknown as Prisma.TransactionClient);
          });

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "バージョン確認用のオークションが見つかりません",
          });
        });

        test("should handle version mismatch in optimistic lock", async () => {
          // モックの設定
          setupValidationSuccessMock();

          // バージョン不一致をシミュレート
          prismaMock.$transaction.mockImplementation(async (callback) => {
            const mockTx = {
              auction: {
                findUnique: vi
                  .fn()
                  .mockResolvedValueOnce({ version: 1, currentHighestBidderId: TEST_CONSTANTS.OTHER_USER_ID })
                  .mockResolvedValueOnce(createMockUpdatedAuction())
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
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "他者によってオークション情報が変更されています",
          });
        });
      });

      describe("不明なエラー", () => {
        test("should handle unknown error", async () => {
          // モックの設定
          setupValidationSuccessMock();
          setupTransactionMock(TEST_CONSTANTS.OTHER_USER_ID, true, "不明なエラーが発生しました");

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: false,
            message: "不明なエラーが発生しました",
          });
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("正常系", () => {
      // パラメータ化テスト：手動入札と自動入札
      test.each([
        {
          description: "手動入札",
          isAutoBid: false,
          expectedMessage: "入札が完了しました",
          shouldCallProcessAutoBid: true,
        },
        {
          description: "自動入札",
          isAutoBid: true,
          expectedMessage: `${TEST_CONSTANTS.BID_AMOUNT}ポイントで自動入札しました`,
          shouldCallProcessAutoBid: false,
        },
      ])(
        "should execute $description successfully",
        async ({ isAutoBid, expectedMessage, shouldCallProcessAutoBid }) => {
          // モックの設定
          setupValidationSuccessMock();
          setupTransactionMock(TEST_CONSTANTS.OTHER_USER_ID);

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT, isAutoBid);

          // 検証
          expect(result).toStrictEqual({
            success: true,
            message: expectedMessage,
          });

          // 共通の検証
          expect(mockValidateAuction).toHaveBeenCalledWith(TEST_CONSTANTS.AUCTION_ID, {
            checkSelfListing: null,
            checkEndTime: null,
            checkCurrentBid: null,
            currentBid: TEST_CONSTANTS.BID_AMOUNT,
            requireActive: null,
            executeBid: true,
          });
          expect(mockSendEventToAuctionSubscribers).toHaveBeenCalledWith(
            TEST_CONSTANTS.AUCTION_ID,
            expect.any(Object) as UpdateAuctionWithDetails,
          );

          // 自動入札処理の呼び出し確認
          if (shouldCallProcessAutoBid) {
            expect(mockProcessAutoBid).toHaveBeenCalled();
          } else {
            expect(mockProcessAutoBid).not.toHaveBeenCalled();
          }
        },
      );

      // パラメータ化テスト：境界値
      test.each([
        {
          description: "最小入札額",
          bidAmount: 1,
          currentHighestBid: 0,
          currentHighestBidderId: null,
        },
        {
          description: "大きな入札額",
          bidAmount: 999999999,
          currentHighestBid: 100,
          currentHighestBidderId: TEST_CONSTANTS.OTHER_USER_ID,
        },
      ])("should handle $description", async ({ bidAmount, currentHighestBid, currentHighestBidderId }) => {
        // モックの設定
        setupValidationSuccessMock({ currentHighestBid, currentHighestBidderId });
        setupTransactionMock(currentHighestBidderId);

        // テスト実行
        const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, bidAmount);

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "入札が完了しました",
        });
      });

      test("should successfully call processAuctionExtension and handle success result", async () => {
        // モックの設定
        setupValidationSuccessMock();
        setupTransactionMock(TEST_CONSTANTS.OTHER_USER_ID, false, undefined, {
          success: true,
          message: "オークションが10分延長されました",
        });

        // テスト実行
        const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "入札が完了しました",
        });

        // processAuctionExtensionが正しいパラメータで呼び出されたことを確認
        expect(mockProcessAuctionExtension).toHaveBeenCalled();
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      describe("通知送信", () => {
        test("should send notification to previous highest bidder", async () => {
          // モックの設定
          setupValidationSuccessMock({ currentHighestBidderId: TEST_CONSTANTS.PREVIOUS_BIDDER_ID });
          setupTransactionMock(TEST_CONSTANTS.PREVIOUS_BIDDER_ID);

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: true,
            message: "入札が完了しました",
          });
          expect(mockSendAuctionNotification).toHaveBeenCalledWith({
            text: {
              first: "テストタスク",
              second: TEST_CONSTANTS.BID_AMOUNT.toString(),
            },
            auctionEventType: PrismaAuctionEventType.OUTBID,
            auctionId: TEST_CONSTANTS.AUCTION_ID,
            recipientUserId: [TEST_CONSTANTS.PREVIOUS_BIDDER_ID],
            sendMethods: [NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH, NotificationSendMethod.IN_APP],
            actionUrl: `https://${process.env.DOMAIN}/dashboard/auction/${TEST_CONSTANTS.AUCTION_ID}`,
            sendTiming: NotificationSendTiming.NOW,
            sendScheduledDate: null,
            expiresAt: null,
          });
        });

        test("should not send notification when no previous bidder", async () => {
          // モックの設定（以前の入札者がいない場合）
          setupValidationSuccessMock({ currentHighestBid: 0, currentHighestBidderId: null });
          setupTransactionMock(null);

          // テスト実行
          const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

          // 検証
          expect(result).toStrictEqual({
            success: true,
            message: "入札が完了しました",
          });
          expect(mockSendAuctionNotification).not.toHaveBeenCalled();
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("自動入札", () => {
      test("should handle auto bid process errors gracefully", async () => {
        // モックの設定
        setupValidationSuccessMock();
        setupTransactionMock(TEST_CONSTANTS.OTHER_USER_ID);

        // 自動入札処理でエラーが発生
        mockProcessAutoBid.mockRejectedValue(new Error("Auto bid failed"));

        // テスト実行
        const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT);

        // 検証（入札自体は成功するが、自動入札処理のエラーは無視され、コンソールのみ行われる)
        // 入札は中断したくない、エラーは無視して入札を継続したい
        expect(result).toStrictEqual({
          success: true,
          message: "入札が完了しました",
        });
        expect(mockProcessAutoBid).toHaveBeenCalledWith({
          auctionId: TEST_CONSTANTS.AUCTION_ID,
          currentHighestBid: TEST_CONSTANTS.BID_AMOUNT,
          currentHighestBidderId: TEST_CONSTANTS.USER_ID,
          validationDone: true,
          paramsValidationResult: expect.objectContaining({
            success: true,
            userId: TEST_CONSTANTS.USER_ID,
            auction: expect.any(Object) as AuctionValidationData,
          }) as ValidateAuctionResult,
        });
        expect(console.error).toHaveBeenCalledWith("入札後の自動入札処理でエラーが発生しました");
      });

      test("should log auto bid process result when processAutoBid returns result", async () => {
        // モックの設定
        setupValidationSuccessMock();
        setupTransactionMock(TEST_CONSTANTS.OTHER_USER_ID);

        // 自動入札処理が結果を返すようにモック
        mockProcessAutoBid.mockResolvedValue({
          success: true,
          message: "自動入札が実行されました",
          data: {
            id: "auto-bid-1",
            maxBidAmount: 200,
            bidIncrement: 10,
          },
        });

        // テスト実行（手動入札）
        const result = await executeBid(TEST_CONSTANTS.AUCTION_ID, TEST_CONSTANTS.BID_AMOUNT, false);

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "入札が完了しました",
        });
        expect(mockProcessAutoBid).toHaveBeenCalled();
      });
    });
  });
});
