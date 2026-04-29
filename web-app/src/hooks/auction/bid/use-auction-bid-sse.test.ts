// 型定義
import type { AuctionWithDetails } from "@/types/auction-types";
// テストセットアップ
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { faker } from "@faker-js/faker";
import { TaskStatus } from "@prisma/client";
import { act, renderHook } from "@testing-library/react";
import { Factory } from "fishery";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象
import { useAuctionBidSSE } from "./use-auction-bid-sse";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * EventSourceのモック設定
 */
class MockEventSource {
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 0;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    this.readyState = this.CONNECTING;
    // 非同期で接続状態をシミュレート
    setTimeout(() => {
      this.readyState = this.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 0);
  }

  close() {
    this.readyState = this.CLOSED;
  }

  // テスト用のメッセージ送信メソッド
  simulateMessage(data: string) {
    if (this.onmessage) {
      const event = new MessageEvent("message", { data });
      this.onmessage(event);
    }
  }

  // テスト用のエラー送信メソッド
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }
}

// グローバルなEventSourceをモック
global.EventSource = MockEventSource as unknown as typeof EventSource;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// AuctionWithDetailsファクトリー
const auctionWithDetailsFactory = Factory.define<AuctionWithDetails>(({ sequence, params }) => {
  const defaultTask = {
    task: faker.lorem.sentence(),
    detail: faker.lorem.paragraph(),
    imageUrl: faker.image.url(),
    status: TaskStatus.AUCTION_ACTIVE,
    category: "プログラミング",
    group: {
      id: `group-${sequence}`,
      name: faker.company.name(),
      depositPeriod: 7,
    },
    executors: [
      {
        user: {
          id: `executor-${sequence}`,
          image: faker.image.avatar(),
          settings: {
            username: faker.person.fullName(),
          },
        },
      },
    ],
    creator: {
      id: `creator-${sequence}`,
      image: faker.image.avatar(),
      settings: {
        username: faker.person.fullName(),
      },
    },
    reporters: [
      {
        user: {
          id: `reporter-${sequence}`,
          image: faker.image.avatar(),
          settings: {
            username: faker.person.fullName(),
          },
        },
      },
    ],
  };

  return {
    id: params.id ?? `auction-${sequence}`,
    currentHighestBid: params.currentHighestBid ?? faker.number.int({ min: 100, max: 10000 }),
    currentHighestBidderId: params.currentHighestBidderId ?? null,
    status: params.status ?? TaskStatus.AUCTION_ACTIVE,
    extensionTotalCount: params.extensionTotalCount ?? 0,
    extensionLimitCount: params.extensionLimitCount ?? 3,
    extensionTime: params.extensionTime ?? 10,
    remainingTimeForExtension: params.remainingTimeForExtension ?? 5,
    startTime: params.startTime ?? faker.date.past(),
    endTime: params.endTime ?? faker.date.future(),
    bidHistories: params.bidHistories ?? [
      {
        id: `bid-${sequence}`,
        amount: faker.number.int({ min: 100, max: 1000 }),
        createdAt: faker.date.recent(),
        isAutoBid: false,
        user: {
          settings: {
            username: faker.person.fullName(),
          },
        },
      },
    ],
    task: params.task ?? defaultTask,
  } as AuctionWithDetails;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createTestAuction = (overrides: Partial<AuctionWithDetails> = {}): AuctionWithDetails => {
  return auctionWithDetailsFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストセットアップ
 */

// モック変数
let mockEventSource: MockEventSource;

// document.visibilityStateのモック
let mockVisibilityState = "visible";

Object.defineProperty(document, "visibilityState", {
  get: () => mockVisibilityState,
  configurable: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  // EventSourceのインスタンスを追跡するためのモック
  global.EventSource = vi.fn().mockImplementation((url: string) => {
    mockEventSource = new MockEventSource(url);
    return mockEventSource;
  }) as unknown as typeof EventSource;

  // document.visibilityStateをリセット
  mockVisibilityState = "visible";
});

afterEach(() => {
  // 各テスト後にEventSourceをクリーンアップ
  if (mockEventSource) {
    mockEventSource.close();
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストケース
 */

describe("useAuctionBidSSE", () => {
  describe("正常系", () => {
    test("should initialize with initial auction data", () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.auction).toStrictEqual(initialAuction);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.lastMsg).toBeNull();
    });

    test("should establish SSE connection on mount", async () => {
      // Arrange
      const initialAuction = createTestAuction({ id: "test-auction-123" });

      // Act
      renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(global.EventSource).toHaveBeenCalledWith("/api/auctions/test-auction-123/sse-server-sent-events");
    });

    test("should handle successful connection", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      // EventSourceの接続が確立されるまで待機
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Assert
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("異常系", () => {
    test("should handle connection error", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後にエラーをシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockEventSource.simulateError();
      });

      // Assert
      expect(result.current.error).toBe("接続が中断されました。再接続を試行します…");
    });

    test("should handle multiple connection errors and show reload message", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後に複数回エラーをシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));

        // 4回エラーを発生させる
        for (let i = 0; i < 4; i++) {
          mockEventSource.simulateError();
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      });

      // Assert
      expect(result.current.error).toBe("再接続に失敗しました。ページをリロードしてください。");
    });

    test("should not reconnect when already connected", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後に再度接続を試行
        await new Promise((resolve) => setTimeout(resolve, 10));
        result.current.reconnect();
      });

      // Assert
      // EventSourceは1回だけ作成される（初回のみ）
      expect(global.EventSource).toHaveBeenCalledTimes(1);
    });
  });

  describe("メッセージ処理", () => {
    test("should process valid SSE message", async () => {
      // Arrange
      const initialAuction = createTestAuction();
      const newBidHistory = {
        id: "new-bid-123",
        amount: 1500,
        createdAt: new Date().toISOString(),
        isAutoBid: false,
        user: {
          settings: {
            username: "新しい入札者",
          },
        },
      };

      const sseMessage = {
        id: initialAuction.id,
        currentHighestBid: 1500,
        currentHighestBidderId: "new-bidder-123",
        status: TaskStatus.AUCTION_ACTIVE,
        extensionTotalCount: 1,
        extensionLimitCount: 3,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        bidHistories: [newBidHistory],
      };

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後にメッセージをシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockEventSource.simulateMessage(`data: ${JSON.stringify(sseMessage)}`);
      });

      // Assert
      expect(result.current.auction?.currentHighestBid).toBe(1500);
      expect(result.current.auction?.currentHighestBidderId).toBe("new-bidder-123");
      expect(result.current.auction?.bidHistories[0]).toStrictEqual(newBidHistory);
      expect(result.current.lastMsg).toBe(`data: ${JSON.stringify(sseMessage)}`);
    });

    test("should handle invalid JSON message", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後に無効なJSONメッセージをシミュレート（JSONの開始は見つかるが無効）
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockEventSource.simulateMessage("data: {invalid json");
      });

      // Assert
      expect(result.current.error).toBe("受信データの解析に失敗しました");
    });

    test("should handle message without JSON content", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後にJSONが含まれないメッセージをシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockEventSource.simulateMessage("no json content");
      });

      // Assert
      // エラーは発生せず、メッセージは無視される
      expect(result.current.error).toBeNull();
    });

    test("should handle message with data property", async () => {
      // Arrange
      const initialAuction = createTestAuction();
      const newBidHistory = {
        id: "new-bid-456",
        amount: 2000,
        createdAt: new Date().toISOString(),
        isAutoBid: true,
        user: {
          settings: {
            username: "自動入札者",
          },
        },
      };

      const sseMessage = {
        data: {
          id: initialAuction.id,
          currentHighestBid: 2000,
          currentHighestBidderId: "auto-bidder-456",
          status: TaskStatus.AUCTION_ACTIVE,
          extensionTotalCount: 2,
          extensionLimitCount: 3,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          bidHistories: [newBidHistory],
        },
      };

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後にdataプロパティを持つメッセージをシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockEventSource.simulateMessage(`data: ${JSON.stringify(sseMessage)}`);
      });

      // Assert
      expect(result.current.auction?.currentHighestBid).toBe(2000);
      expect(result.current.auction?.currentHighestBidderId).toBe("auto-bidder-456");
      expect(result.current.auction?.bidHistories[0]).toStrictEqual(newBidHistory);
    });

    test("should handle empty payload", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後に空のペイロードをシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockEventSource.simulateMessage("data: null");
      });

      // Assert
      // 空のペイロードは無視される
      expect(result.current.auction).toStrictEqual(initialAuction);
    });
  });

  describe("ページ可視性の処理", () => {
    test("should disconnect when page becomes hidden", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後にページを非表示にする
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockVisibilityState = "hidden";
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Assert
      expect(result.current.loading).toBe(false);
    });

    test("should reconnect when page becomes visible", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後にページを非表示にしてから再表示
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockVisibilityState = "hidden";
        document.dispatchEvent(new Event("visibilitychange"));
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockVisibilityState = "visible";
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Assert
      // 初回接続 + 再接続で2回呼ばれる
      expect(global.EventSource).toHaveBeenCalledTimes(2);
    });
  });

  describe("bidHistories処理", () => {
    test("should merge bid histories correctly", async () => {
      // Arrange
      const existingBidHistory = {
        id: "existing-bid-1",
        amount: 1000,
        createdAt: new Date("2024-01-01").toISOString(),
        isAutoBid: false,
        user: {
          settings: {
            username: "既存入札者",
          },
        },
      };

      const initialAuction = createTestAuction({
        bidHistories: [existingBidHistory],
      });

      const newBidHistory = {
        id: "new-bid-2",
        amount: 1500,
        createdAt: new Date("2024-01-02").toISOString(),
        isAutoBid: false,
        user: {
          settings: {
            username: "新規入札者",
          },
        },
      };

      const sseMessage = {
        id: initialAuction.id,
        currentHighestBid: 1500,
        currentHighestBidderId: "new-bidder-2",
        status: TaskStatus.AUCTION_ACTIVE,
        extensionTotalCount: 1,
        extensionLimitCount: 3,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        bidHistories: [newBidHistory],
      };

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後にメッセージをシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockEventSource.simulateMessage(`data: ${JSON.stringify(sseMessage)}`);
      });

      // Assert
      expect(result.current.auction?.bidHistories).toHaveLength(1);
      expect(result.current.auction?.bidHistories[0]).toStrictEqual(newBidHistory);
    });

    test("should handle empty bid histories", async () => {
      // Arrange
      const initialAuction = createTestAuction({
        bidHistories: [],
      });

      const sseMessage = {
        id: initialAuction.id,
        currentHighestBid: 1000,
        currentHighestBidderId: "bidder-1",
        status: TaskStatus.AUCTION_ACTIVE,
        extensionTotalCount: 0,
        extensionLimitCount: 3,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        bidHistories: [],
      };

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後にメッセージをシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockEventSource.simulateMessage(`data: ${JSON.stringify(sseMessage)}`);
      });

      // Assert
      expect(result.current.auction?.bidHistories).toHaveLength(0);
    });
  });

  describe("ユーティリティ関数", () => {
    test("should provide reconnect function", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後に切断
        await new Promise((resolve) => setTimeout(resolve, 10));
        await result.current.disconnect();

        // 再接続
        result.current.reconnect();
      });

      // Assert
      expect(typeof result.current.reconnect).toBe("function");
    });

    test("should provide disconnect function", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        await result.current.disconnect();
      });

      // Assert
      expect(result.current.loading).toBe(false);
    });
  });

  describe("境界値テスト", () => {
    test("should handle auction with null bidHistories", async () => {
      // Arrange
      const initialAuction = createTestAuction({
        bidHistories: [],
      });

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.auction).toBeDefined();
      expect(result.current.auction?.bidHistories).toStrictEqual([]);
    });

    test("should handle message with non-string jsonStr type", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後にjsonStartが-1になるメッセージをシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockEventSource.simulateMessage("no json bracket content");
      });

      // Assert
      // エラーは発生せず、メッセージは無視される
      expect(result.current.error).toBeNull();
    });

    test("should handle disconnect with active reconnect timer", async () => {
      // Arrange
      const initialAuction = createTestAuction();

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      await act(async () => {
        // 接続確立後にエラーを発生させて再接続タイマーを設定
        await new Promise((resolve) => setTimeout(resolve, 10));
        mockEventSource.simulateError();

        // 再接続タイマーが設定された状態で切断
        await result.current.disconnect();
      });

      // Assert
      expect(result.current.loading).toBe(false);
    });

    test("should handle auction with maximum values", async () => {
      // Arrange
      const initialAuction = createTestAuction({
        currentHighestBid: Number.MAX_SAFE_INTEGER,
        extensionTotalCount: Number.MAX_SAFE_INTEGER,
        extensionLimitCount: Number.MAX_SAFE_INTEGER,
        extensionTime: Number.MAX_SAFE_INTEGER,
        remainingTimeForExtension: Number.MAX_SAFE_INTEGER,
      });

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.auction).toBeDefined();
      expect(result.current.auction?.currentHighestBid).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.current.auction?.extensionTotalCount).toBe(Number.MAX_SAFE_INTEGER);
    });

    test("should handle auction with minimum values", async () => {
      // Arrange
      const initialAuction = createTestAuction({
        currentHighestBid: 0,
        extensionTotalCount: 0,
        extensionLimitCount: 0,
        extensionTime: 0,
        remainingTimeForExtension: 0,
      });

      // Act
      const { result } = renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.auction).toBeDefined();
      expect(result.current.auction?.currentHighestBid).toBe(0);
      expect(result.current.auction?.extensionTotalCount).toBe(0);
    });

    test("should handle very long auction ID", async () => {
      // Arrange
      const longId = "a".repeat(1000);
      const initialAuction = createTestAuction({ id: longId });

      // Act
      renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(global.EventSource).toHaveBeenCalledWith(`/api/auctions/${longId}/sse-server-sent-events`);
    });

    test("should handle empty string auction ID", async () => {
      // Arrange
      const initialAuction = createTestAuction({ id: "" });

      // Act
      renderHook(() => useAuctionBidSSE(initialAuction), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(global.EventSource).toHaveBeenCalledWith("/api/auctions//sse-server-sent-events");
    });
  });
});
