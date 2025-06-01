import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";
// テストセットアップ
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { NotificationSendMethod, NotificationSendTiming, AuctionEventType as PrismaAuctionEventType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象の関数をインポート
import { executeBid, validateAuction } from "./bid-common";

// モック設定
vi.mock("@/lib/utils", () => ({
  getAuthSession: vi.fn(),
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

// モック関数の型定義
const mockGetAuthSession = vi.mocked(await import("@/lib/utils")).getAuthSession;
const mockSendAuctionNotification = vi.mocked(await import("@/lib/actions/notification/auction-notification")).sendAuctionNotification;
const mockSendEventToAuctionSubscribers = vi.mocked(await import("./server-sent-events-broadcast")).sendEventToAuctionSubscribers;
const mockProcessAutoBid = vi.mocked(await import("./auto-bid")).processAutoBid;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("validateAuction", () => {
  // テストデータの準備
  const mockUserId = "test-user-id";
  const mockAuctionId = "test-auction-id";
  const mockSession: Session = {
    user: { id: mockUserId, email: "test@example.com" },
    expires: "2024-12-31",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("認証チェック", () => {
    test("should return error when user is not authenticated", async () => {
      // モックの設定
      mockGetAuthSession.mockResolvedValue(null);

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
        message: "操作するには、ログインが必要です",
        userId: null,
        auction: null,
        session: null,
      });
      expect(mockGetAuthSession).toHaveBeenCalledOnce();
    });

    test("should return error when session has no user id", async () => {
      // モックの設定
      const sessionWithoutUserId: Session = {
        user: { email: "test@example.com" },
        expires: "2024-12-31",
      };
      mockGetAuthSession.mockResolvedValue(sessionWithoutUserId);

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
        message: "操作するには、ログインが必要です",
        userId: null,
        auction: null,
        session: null,
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("オークション存在チェック", () => {
    test("should return error when auction is not found", async () => {
      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.auction.findUnique.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

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
      expect(result.success).toBe(false);
      expect(result.message).toBe("オークションが見つかりません");
      expect(result.userId).toBe(mockUserId);
      expect(result.auction).toBeNull();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("自分の出品チェック", () => {
    test("should return error when user tries to bid on own auction", async () => {
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
          creator: { id: mockUserId }, // 自分が作成者
          task: "テストタスク",
          status: TaskStatus.AUCTION_ACTIVE,
          detail: "詳細",
        },
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

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
      expect(result.success).toBe(false);
      expect(result.message).toBe("自分の出品に対して操作はできません");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("終了時間チェック", () => {
    test("should return error when auction has ended", async () => {
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
          task: "テストタスク",
          status: TaskStatus.AUCTION_ACTIVE,
          detail: "詳細",
        },
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

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
      expect(result.success).toBe(false);
      expect(result.message).toBe("このオークションは終了しています");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アクティブ状態チェック", () => {
    test("should return error when auction is not active", async () => {
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
          task: "テストタスク",
          status: TaskStatus.PENDING, // アクティブでない
          detail: "詳細",
        },
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

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
      expect(result.success).toBe(false);
      expect(result.message).toBe("このオークションはアクティブではありません");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("現在の最高入札額チェック", () => {
    test("should return error when bid amount is not higher than current highest bid", async () => {
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
          task: "テストタスク",
          status: TaskStatus.AUCTION_ACTIVE,
          detail: "詳細",
        },
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // テスト実行（現在の最高入札額と同額で入札）
      const result = await validateAuction(mockAuctionId, {
        checkSelfListing: null,
        checkEndTime: null,
        checkCurrentBid: true,
        currentBid: 100, // 現在の最高入札額と同額
        requireActive: null,
        executeBid: null,
      });

      // 検証
      expect(result.success).toBe(false);
      expect(result.message).toBe("現在の最高入札額（100ポイント）より高い額で入札してください");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should return success when all validations pass", async () => {
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
          task: "テストタスク",
          status: TaskStatus.AUCTION_ACTIVE,
          detail: "詳細",
        },
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.auction.findUnique.mockResolvedValue(mockAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

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
      expect(result.success).toBe(true);
      expect(result.message).toBe("オークションの検証が完了しました");
      expect(result.userId).toBe(mockUserId);
      expect(result.auction).toBeDefined();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリング", () => {
    test("should handle database errors gracefully", async () => {
      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.auction.findUnique.mockRejectedValue(new Error("Database error"));

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
      expect(result.success).toBe(false);
      expect(result.message).toBe("オークションの検証中にエラーが発生しました");
      expect(result.userId).toBeNull();
      expect(result.auction).toBeNull();
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("executeBid", () => {
  const mockUserId = "test-user-id";
  const mockAuctionId = "test-auction-id";
  const mockSession: Session = {
    user: { id: mockUserId, email: "test@example.com" },
    expires: "2024-12-31",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("バリデーション失敗時", () => {
    test("should return error when validation fails", async () => {
      // モックの設定（認証失敗）
      mockGetAuthSession.mockResolvedValue(null);

      // テスト実行
      const result = await executeBid(mockAuctionId, 150);

      // 検証
      expect(result.success).toBe(false);
      expect(result.message).toBe("操作するには、ログインが必要です");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should execute bid successfully", async () => {
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
            isAutoBid: false,
            user: { settings: { username: "testuser" } },
          },
        ],
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);

      // validateAuction用のモック
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

      // テスト実行
      const result = await executeBid(mockAuctionId, 150);

      // 検証
      expect(result.success).toBe(true);
      expect(result.message).toBe("入札が完了しました");
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
      mockGetAuthSession.mockResolvedValue(mockSession);
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
      mockGetAuthSession.mockResolvedValue(mockSession);
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
      mockGetAuthSession.mockResolvedValue(mockSession);
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
      mockGetAuthSession.mockResolvedValue(mockSession);
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
      mockGetAuthSession.mockResolvedValue(mockSession);
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
      mockGetAuthSession.mockResolvedValue(mockSession);
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
      mockGetAuthSession.mockResolvedValue(mockSession);
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
      mockGetAuthSession.mockResolvedValue(mockSession);
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
});
