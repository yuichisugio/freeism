import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { taskWatchListFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { serverIsAuctionWatched, serverToggleWatchlist } from "./watchlist";

describe("watchlist", () => {
  beforeEach(() => {
    // 各テスト前にコンソールエラーをモック
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("serverToggleWatchlist", () => {
    test("should add auction to watchlist when not exists", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const newWatchlistItem = taskWatchListFactory.build({
        auctionId,
        userId,
      });

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null);
      prismaMock.taskWatchList.create.mockResolvedValue(newWatchlistItem);

      // 実行
      const result = await serverToggleWatchlist(auctionId, userId);

      // 検証
      expect(result).toBe(true);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          auctionId,
        },
      });
      expect(prismaMock.taskWatchList.create).toHaveBeenCalledWith({
        data: {
          userId,
          auctionId,
        },
      });
      expect(prismaMock.taskWatchList.delete).not.toHaveBeenCalled();
    });

    test("should remove auction from watchlist when exists", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const existingWatchlistItem = taskWatchListFactory.build({
        id: "watchlist-1",
        auctionId,
        userId,
      });

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(existingWatchlistItem);
      prismaMock.taskWatchList.delete.mockResolvedValue(existingWatchlistItem);

      // 実行
      const result = await serverToggleWatchlist(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          auctionId,
        },
      });
      expect(prismaMock.taskWatchList.delete).toHaveBeenCalledWith({
        where: {
          id: existingWatchlistItem.id,
        },
      });
      expect(prismaMock.taskWatchList.create).not.toHaveBeenCalled();
    });

    test("should return false when database error occurs during findFirst", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const dbError = new Error("Database connection error");

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockRejectedValue(dbError);

      // 実行
      const result = await serverToggleWatchlist(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith("ウォッチリスト操作エラー:", dbError);
      expect(prismaMock.taskWatchList.create).not.toHaveBeenCalled();
      expect(prismaMock.taskWatchList.delete).not.toHaveBeenCalled();
    });

    test("should return false when database error occurs during create", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const dbError = new Error("Create operation failed");

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null);
      prismaMock.taskWatchList.create.mockRejectedValue(dbError);

      // 実行
      const result = await serverToggleWatchlist(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith("ウォッチリスト操作エラー:", dbError);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalled();
      expect(prismaMock.taskWatchList.create).toHaveBeenCalled();
    });

    test("should return false when database error occurs during delete", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const existingWatchlistItem = taskWatchListFactory.build({
        id: "watchlist-1",
        auctionId,
        userId,
      });
      const dbError = new Error("Delete operation failed");

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(existingWatchlistItem);
      prismaMock.taskWatchList.delete.mockRejectedValue(dbError);

      // 実行
      const result = await serverToggleWatchlist(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith("ウォッチリスト操作エラー:", dbError);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalled();
      expect(prismaMock.taskWatchList.delete).toHaveBeenCalled();
    });

    test("should handle empty string parameters", async () => {
      // テストデータの準備
      const auctionId = "";
      const userId = "";

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null);
      prismaMock.taskWatchList.create.mockResolvedValue(taskWatchListFactory.build({ auctionId, userId }));

      // 実行
      const result = await serverToggleWatchlist(auctionId, userId);

      // 検証
      expect(result).toBe(true);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "",
          auctionId: "",
        },
      });
    });

    test("should handle null parameters", async () => {
      // テストデータの準備
      const auctionId = null as unknown as string;
      const userId = null as unknown as string;

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null);
      prismaMock.taskWatchList.create.mockResolvedValue(taskWatchListFactory.build({ auctionId, userId: userId }));

      // 実行
      const result = await serverToggleWatchlist(auctionId, userId);

      // 検証
      expect(result).toBe(true);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId: null,
          auctionId: null,
        },
      });
    });

    test("should handle undefined parameters", async () => {
      // テストデータの準備
      const auctionId = undefined as unknown as string;
      const userId = undefined as unknown as string;

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null);
      prismaMock.taskWatchList.create.mockResolvedValue(taskWatchListFactory.build({ auctionId, userId }));

      // 実行
      const result = await serverToggleWatchlist(auctionId, userId);

      // 検証
      expect(result).toBe(true);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId: undefined,
          auctionId: undefined,
        },
      });
    });
  });

  describe("serverIsAuctionWatched", () => {
    test("should return true when auction is in watchlist", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const watchlistItem = taskWatchListFactory.build({
        id: "watchlist-1",
        auctionId,
        userId,
      });

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(watchlistItem);

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(true);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          auctionId,
        },
        select: {
          id: true,
        },
      });
    });

    test("should return false when auction is not in watchlist", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null);

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          auctionId,
        },
        select: {
          id: true,
        },
      });
    });

    test("should return false when database error occurs", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const dbError = new Error("Database connection error");

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockRejectedValue(dbError);

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith("ウォッチリスト状態確認エラー:", dbError);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          auctionId,
        },
        select: {
          id: true,
        },
      });
    });

    test("should handle empty string parameters", async () => {
      // テストデータの準備
      const auctionId = "";
      const userId = "";

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null);

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "",
          auctionId: "",
        },
        select: {
          id: true,
        },
      });
    });

    test("should handle null parameters", async () => {
      // テストデータの準備
      const auctionId = null as unknown as string;
      const userId = null as unknown as string;

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.taskWatchList.findFirst>>);

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId: null,
          auctionId: null,
        },
        select: {
          id: true,
        },
      });
    });

    test("should handle undefined parameters", async () => {
      // テストデータの準備
      const auctionId = undefined as unknown as string;
      const userId = undefined as unknown as string;

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.taskWatchList.findFirst>>);

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId: undefined,
          auctionId: undefined,
        },
        select: {
          id: true,
        },
      });
    });

    test("should return true when watchlist item has only id field", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const watchlistItem = { id: "watchlist-1" };

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(
        watchlistItem as unknown as Awaited<ReturnType<typeof prismaMock.taskWatchList.findFirst>>,
      );

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(true);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          auctionId,
        },
        select: {
          id: true,
        },
      });
    });

    test("should handle very long string parameters", async () => {
      // テストデータの準備
      const auctionId = "a".repeat(1000);
      const userId = "u".repeat(1000);

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.taskWatchList.findFirst>>);

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "u".repeat(1000),
          auctionId: "a".repeat(1000),
        },
        select: {
          id: true,
        },
      });
    });
  });
});
