import { NextRequest } from "next/server";
import { serverIsAuctionWatched, serverToggleWatchlist } from "@/lib/auction/action/watchlist";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { DELETE, GET, PATCH, POST, PUT } from "./route";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// Next.js server関連のモック
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");

  const MockNextResponse = vi.fn().mockImplementation((_body?: BodyInit | null, init?: ResponseInit) => ({
    json: async () => null,
    status: init?.status ?? 200,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (MockNextResponse as any).json = vi.fn((data: unknown, init?: { status?: number }) => ({
    json: async () => data,
    status: init?.status ?? 200,
  }));

  return {
    ...actual,
    NextResponse: MockNextResponse,
  };
});

// サーバーアクションのモック
vi.mock("@/lib/auction/action/watchlist", () => ({
  serverIsAuctionWatched: vi.fn(),
  serverToggleWatchlist: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("watchlist API route", () => {
  beforeEach(() => {
    // 各テスト前にコンソールエラーをモック
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("GET /api/auctions/[auctionId]/watchlist", () => {
    test("should return watchlist status when user is authenticated and auction is watched", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "cmb0e9xnm0001mchbj6ler4py";

      // モックの設定
      vi.mocked(serverIsAuctionWatched).mockResolvedValue(true);

      // リクエストの作成
      const request = new NextRequest("http://localhost:3000/api/auctions/auction-1/watchlist");
      const params = Promise.resolve({ auctionId });

      // 実行
      const response = await GET(request, { params });
      const responseData = (await response.json()) as { isWatched: boolean };

      // 検証
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ isWatched: true });
      expect(vi.mocked(serverIsAuctionWatched)).toHaveBeenCalledWith(userId, auctionId);
    });

    test("should return false when user is authenticated and auction is not watched", async () => {
      // テストデータの準備
      const auctionId = "auction-1";

      // モックの設定
      vi.mocked(serverIsAuctionWatched).mockResolvedValue(false);

      // リクエストの作成
      const request = new NextRequest("http://localhost:3000/api/auctions/auction-1/watchlist");
      const params = Promise.resolve({ auctionId });

      // 実行
      const response = await GET(request, { params });
      const responseData = (await response.json()) as { isWatched: boolean };

      // 検証
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ isWatched: false });
      expect(vi.mocked(serverIsAuctionWatched)).toHaveBeenCalledWith("cmb0e9xnm0001mchbj6ler4py", auctionId);
    });
  });

  describe("POST /api/auctions/[auctionId]/watchlist", () => {
    test("should add auction to watchlist when not exists", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "cmb0e9xnm0001mchbj6ler4py";

      // モックの設定
      vi.mocked(serverToggleWatchlist).mockResolvedValue(true);

      // リクエストの作成
      const request = new NextRequest("http://localhost:3000/api/auctions/auction-1/watchlist", {
        method: "POST",
      });
      const params = Promise.resolve({ auctionId });

      // 実行
      const response = await POST(request, { params });
      const responseData = (await response.json()) as { isWatched: boolean };

      // 検証
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ isWatched: true });
      expect(vi.mocked(serverToggleWatchlist)).toHaveBeenCalledWith(auctionId, userId);
    });

    test("should remove auction from watchlist when exists", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "cmb0e9xnm0001mchbj6ler4py";

      // モックの設定
      vi.mocked(serverToggleWatchlist).mockResolvedValue(false);

      // リクエストの作成
      const request = new NextRequest("http://localhost:3000/api/auctions/auction-1/watchlist", {
        method: "POST",
      });
      const params = Promise.resolve({ auctionId });

      // 実行
      const response = await POST(request, { params });
      const responseData = (await response.json()) as { isWatched: boolean };

      // 検証
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ isWatched: false });
      expect(vi.mocked(serverToggleWatchlist)).toHaveBeenCalledWith(auctionId, userId);
    });
  });

  describe("Unsupported HTTP methods", () => {
    test("PUT should return 405 Method Not Allowed", async () => {
      // 実行
      const response = await PUT();

      // 検証
      expect(response.status).toBe(405);
    });

    test("DELETE should return 405 Method Not Allowed", async () => {
      // 実行
      const response = await DELETE();

      // 検証
      expect(response.status).toBe(405);
    });

    test("PATCH should return 405 Method Not Allowed", async () => {
      // 実行
      const response = await PATCH();

      // 検証
      expect(response.status).toBe(405);
    });
  });

  describe("Error cases", () => {
    describe("GET method error cases", () => {
      test("should return 401 when user is not authenticated", async () => {
        // Auth.jsのモックを一時的に変更
        const originalAuth = await import("@/auth");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        vi.mocked(originalAuth.auth).mockResolvedValueOnce(null as any);

        // テストデータの準備
        const auctionId = "auction-1";

        // リクエストの作成
        const request = new NextRequest("http://localhost:3000/api/auctions/auction-1/watchlist");
        const params = Promise.resolve({ auctionId });

        // 実行
        const response = await GET(request, { params });
        const responseData = (await response.json()) as { error: string };

        // 検証
        expect(response.status).toBe(401);
        expect(responseData).toStrictEqual({ error: "認証が必要です" });
      });

      test("should return 500 when serverIsAuctionWatched throws error", async () => {
        // テストデータの準備
        const auctionId = "auction-1";

        // モックの設定
        vi.mocked(serverIsAuctionWatched).mockRejectedValue(new Error("Database error"));

        // リクエストの作成
        const request = new NextRequest("http://localhost:3000/api/auctions/auction-1/watchlist");
        const params = Promise.resolve({ auctionId });

        // 実行
        const response = await GET(request, { params });
        const responseData = (await response.json()) as { error: string };

        // 検証
        expect(response.status).toBe(500);
        expect(responseData).toStrictEqual({ error: "ウォッチリストの確認中にエラーが発生しました" });
        expect(console.error).toHaveBeenCalledWith("ウォッチリスト確認エラー:", expect.any(Error));
      });
    });

    describe("POST method error cases", () => {
      test("should return 401 when user is not authenticated", async () => {
        // Auth.jsのモックを一時的に変更
        const originalAuth = await import("@/auth");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        vi.mocked(originalAuth.auth).mockResolvedValueOnce(null as any);

        // テストデータの準備
        const auctionId = "auction-1";

        // リクエストの作成
        const request = new NextRequest("http://localhost:3000/api/auctions/auction-1/watchlist", {
          method: "POST",
        });
        const params = Promise.resolve({ auctionId });

        // 実行
        const response = await POST(request, { params });
        const responseData = (await response.json()) as { error: string };

        // 検証
        expect(response.status).toBe(401);
        expect(responseData).toStrictEqual({ error: "認証が必要です" });
      });

      test("should return 500 when serverToggleWatchlist throws error", async () => {
        // テストデータの準備
        const auctionId = "auction-1";

        // モックの設定
        vi.mocked(serverToggleWatchlist).mockRejectedValue(new Error("Database error"));

        // リクエストの作成
        const request = new NextRequest("http://localhost:3000/api/auctions/auction-1/watchlist", {
          method: "POST",
        });
        const params = Promise.resolve({ auctionId });

        // 実行
        const response = await POST(request, { params });
        const responseData = (await response.json()) as { error: string };

        // 検証
        expect(response.status).toBe(500);
        expect(responseData).toStrictEqual({ error: "ウォッチリストの更新中にエラーが発生しました" });
        expect(console.error).toHaveBeenCalledWith("ウォッチリスト更新エラー:", expect.any(Error));
      });
    });
  });

  describe("Edge cases and boundary values", () => {
    test("should handle empty auctionId parameter", async () => {
      // テストデータの準備
      const auctionId = "";

      // モックの設定
      vi.mocked(serverIsAuctionWatched).mockResolvedValue(false);

      // リクエストの作成
      const request = new NextRequest("http://localhost:3000/api/auctions//watchlist");
      const params = Promise.resolve({ auctionId });

      // 実行
      const response = await GET(request, { params });
      const responseData = (await response.json()) as { isWatched: boolean };

      // 検証
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ isWatched: false });
      expect(vi.mocked(serverIsAuctionWatched)).toHaveBeenCalledWith("cmb0e9xnm0001mchbj6ler4py", "");
    });

    test("should handle very long auctionId parameter", async () => {
      // テストデータの準備
      const auctionId = "a".repeat(1000); // 1000文字の長いID

      // モックの設定
      vi.mocked(serverIsAuctionWatched).mockResolvedValue(true);

      // リクエストの作成
      const request = new NextRequest(`http://localhost:3000/api/auctions/${auctionId}/watchlist`);
      const params = Promise.resolve({ auctionId });

      // 実行
      const response = await GET(request, { params });
      const responseData = (await response.json()) as { isWatched: boolean };

      // 検証
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ isWatched: true });
      expect(vi.mocked(serverIsAuctionWatched)).toHaveBeenCalledWith("cmb0e9xnm0001mchbj6ler4py", auctionId);
    });

    test("should handle special characters in auctionId parameter", async () => {
      // テストデータの準備
      const auctionId = "auction-123!@#$%^&*()_+-=[]{}|;:,.<>?";

      // モックの設定
      vi.mocked(serverToggleWatchlist).mockResolvedValue(true);

      // リクエストの作成
      const request = new NextRequest("http://localhost:3000/api/auctions/auction-123!@#$%^&*()_+-=[]{}|;:,.<>?/watchlist", {
        method: "POST",
      });
      const params = Promise.resolve({ auctionId });

      // 実行
      const response = await POST(request, { params });
      const responseData = (await response.json()) as { isWatched: boolean };

      // 検証
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual({ isWatched: true });
      expect(vi.mocked(serverToggleWatchlist)).toHaveBeenCalledWith(auctionId, "cmb0e9xnm0001mchbj6ler4py");
    });

    test("should handle session with missing user.id", async () => {
      // Auth.jsのモックを一時的に変更（userオブジェクトはあるがidがない）
      const originalAuth = await import("@/auth");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      vi.mocked(originalAuth.auth).mockResolvedValueOnce({ user: {} } as any);

      // テストデータの準備
      const auctionId = "auction-1";

      // リクエストの作成
      const request = new NextRequest("http://localhost:3000/api/auctions/auction-1/watchlist");
      const params = Promise.resolve({ auctionId });

      // 実行
      const response = await GET(request, { params });
      const responseData = (await response.json()) as { error: string };

      // 検証
      expect(response.status).toBe(401);
      expect(responseData).toStrictEqual({ error: "認証が必要です" });
    });

    test("should handle session with empty user.id", async () => {
      // Auth.jsのモックを一時的に変更（userオブジェクトはあるがidが空文字）
      const originalAuth = await import("@/auth");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      vi.mocked(originalAuth.auth).mockResolvedValueOnce({ user: { id: "" } } as any);

      // テストデータの準備
      const auctionId = "auction-1";

      // リクエストの作成
      const request = new NextRequest("http://localhost:3000/api/auctions/auction-1/watchlist");
      const params = Promise.resolve({ auctionId });

      // 実行
      const response = await GET(request, { params });
      const responseData = (await response.json()) as { error: string };

      // 検証
      expect(response.status).toBe(401);
      expect(responseData).toStrictEqual({ error: "認証が必要です" });
    });
  });
});
