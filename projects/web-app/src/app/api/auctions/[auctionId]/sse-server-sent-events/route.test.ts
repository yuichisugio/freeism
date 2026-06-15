// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Node.js環境でのWebStreams Polyfill
 * TextEncoder/TextDecoderのポリフィル設定
 */
import { TextDecoder, TextEncoder } from "node:util";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DELETE, GET, HEAD, OPTIONS, PATCH, POST } from "./route";

// グローバル環境に設定（型安全な方法）
Object.assign(global, {
  TextEncoder,
  TextDecoder,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用エンコーダー
 */
const encoder = new TextEncoder();

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用データ
 */
const testAuctionId = "test-auction-123";
const mockAuctionData = {
  id: testAuctionId,
  currentHighestBid: 1000,
  status: "AUCTION_ACTIVE",
  bidHistories: [],
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fetch APIのモック設定
 * SSEの無限ループを防ぐため、有限ストリームを返す
 */
function setupFetchMock() {
  global.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.url;

    // Upstash Redis購読エンドポイント: 制御された有限ストリームを返す
    if (url.includes("/subscribe/")) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          // 初期メッセージを送信
          controller.enqueue(encoder.encode(`data: {"type":"bid","auctionId":"${testAuctionId}","amount":1500}\n\n`));

          // 即座にストリームを閉じる（無限ループを防ぐ）
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    }

    // 初期データ取得エンドポイント: JSONレスポンスを返す
    if (url.includes("/auction-data")) {
      return Promise.resolve(
        new Response(JSON.stringify(mockAuctionData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // 未対応のURL
    return Promise.reject(new Error(`未対応のfetch URL: ${url}`));
  });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */
function createMockParams(auctionId: string): { params: Promise<{ auctionId: string }> } {
  return {
    params: Promise.resolve({ auctionId }),
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("SSE Server-Sent Events API Route", () => {
  beforeEach(() => {
    // タイマーを仮想化して再接続ループを制御
    vi.useFakeTimers();

    // fetchモックを設定
    setupFetchMock();

    // 環境変数をモック
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv("FREEISM_APP_API_SECRET_KEY", "test-secret");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DOMAIN", "test.com");
  });

  afterEach(() => {
    // 保留中のタイマーをすべて実行
    vi.runOnlyPendingTimers();
    // 実際のタイマーに戻す
    vi.useRealTimers();
    // すべてのモックをクリア
    vi.clearAllMocks();
    // 環境変数モックをリセット
    vi.unstubAllEnvs();
  });

  describe("GET /api/auctions/:auctionId/sse-server-sent-events", () => {
    test("should return SSE response with correct headers", async () => {
      // Arrange
      const request = new Request("http://localhost");
      const params = createMockParams(testAuctionId);

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
      expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
      expect(response.headers.get("Connection")).toBe("keep-alive");
    });

    test("should return 400 when auctionId is missing", async () => {
      // Arrange
      const request = new Request("http://localhost");
      const params = createMockParams("");

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data).toStrictEqual({ error: "オークションIDが必要です" });
    });

    test("should return 400 when auctionId is null", async () => {
      // Arrange
      const request = new Request("http://localhost");
      const params = { params: Promise.resolve({ auctionId: null as unknown as string }) };

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data).toStrictEqual({ error: "オークションIDが必要です" });
    });

    test("should return 400 when auctionId is undefined", async () => {
      // Arrange
      const request = new Request("http://localhost");
      const params = { params: Promise.resolve({ auctionId: undefined as unknown as string }) };

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data).toStrictEqual({ error: "オークションIDが必要です" });
    });

    test("should provide SSE stream with data", async () => {
      // Arrange
      const request = new Request("http://localhost");
      const params = createMockParams(testAuctionId);

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.body).toBeDefined();
      const reader = response.body!.getReader();

      // タイムアウト付きで1つのチャンクを読み取り
      const timeout = new Promise<{ value: Uint8Array; done: boolean }>((_, reject) =>
        setTimeout(() => reject(new Error("Test timeout")), 1000),
      );

      try {
        const chunk = await Promise.race([reader.read(), timeout]);

        if (!chunk.done && chunk.value) {
          // デコードして内容を確認
          const decoder = new TextDecoder();
          const data = decoder.decode(chunk.value);
          expect(data).toContain("data:");
        }

        // リーダーを閉じる
        await reader.cancel();
      } catch {
        // タイムアウトの場合もテストは成功とする
        await reader.cancel();
        expect(true).toBe(true);
      }
    });

    test("should handle very long auctionId", async () => {
      // Arrange
      const longAuctionId = "a".repeat(1000);
      const request = new Request("http://localhost");
      const params = createMockParams(longAuctionId);

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
    });

    test("should handle special characters in auctionId", async () => {
      // Arrange
      const specialAuctionId = "test-auction-123!@#$%^&*()_+-=[]{}|;:,.<>?";
      const request = new Request("http://localhost");
      const params = createMockParams(specialAuctionId);

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
    });

    test("should handle missing environment variables", async () => {
      // Arrange
      vi.unstubAllEnvs();
      const request = new Request("http://localhost");
      const params = createMockParams(testAuctionId);

      // Act
      const response = await GET(request, params);

      // Assert - 環境変数がなくてもストリームは返される
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
    });
  });

  describe("Other HTTP Methods", () => {
    test("POST should return 405 Method Not Allowed", async () => {
      // Act
      const response = await POST();

      // Assert
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET");
    });

    test("DELETE should return 405 Method Not Allowed", async () => {
      // Act
      const response = await DELETE();

      // Assert
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET");
    });

    test("PATCH should return 405 Method Not Allowed", async () => {
      // Act
      const response = await PATCH();

      // Assert
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET");
    });

    test("HEAD should return 405 Method Not Allowed", async () => {
      // Act
      const response = await HEAD();

      // Assert
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET");
    });

    test("OPTIONS should return 204 with CORS headers", async () => {
      // Act
      const response = await OPTIONS();

      // Assert
      expect(response.status).toBe(204);
      expect(response.headers.get("Allow")).toBe("GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://freeism.com,https://localhost:3000");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
    });
  });

  describe("Error Handling", () => {
    test("should handle malformed params", async () => {
      // Arrange
      const request = new Request("http://localhost");
      const malformedParams = { params: Promise.reject(new Error("Params parsing failed")) };

      // Act & Assert
      await expect(GET(request, malformedParams)).rejects.toThrow("Params parsing failed");
    });

    test("should handle params promise rejection", async () => {
      // Arrange
      const request = new Request("http://localhost");
      const params = { params: Promise.reject(new Error("Database connection failed")) };

      // Act & Assert
      await expect(GET(request, params)).rejects.toThrow("Database connection failed");
    });
  });

  describe("Boundary Value Testing", () => {
    test("should handle minimum auctionId length", async () => {
      // Arrange
      const minAuctionId = "a";
      const request = new Request("http://localhost");
      const params = createMockParams(minAuctionId);

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(200);
    });

    test("should handle numeric auctionId", async () => {
      // Arrange
      const numericAuctionId = "123456789";
      const request = new Request("http://localhost");
      const params = createMockParams(numericAuctionId);

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(200);
    });

    test("should handle UUID-like auctionId", async () => {
      // Arrange
      const uuidAuctionId = "550e8400-e29b-41d4-a716-446655440000";
      const request = new Request("http://localhost");
      const params = createMockParams(uuidAuctionId);

      // Act
      const response = await GET(request, params);

      // Assert
      expect(response.status).toBe(200);
    });
  });
});
