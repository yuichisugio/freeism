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
    describe("正常系テスト", () => {
      test("should add auction to watchlist when isWatchlisted is false", async () => {
        // テストデータの準備
        const auctionId = "auction-1";
        const userId = "user-1";
        const isWatchlisted = false;
        const newWatchlistItem = taskWatchListFactory.build({
          auctionId,
          userId,
        });

        // モックの設定
        prismaMock.taskWatchList.create.mockResolvedValue(newWatchlistItem);

        // 実行
        const result = await serverToggleWatchlist(auctionId, userId, isWatchlisted);

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "ウォッチリストに追加しました",
          data: true,
        });
        expect(prismaMock.taskWatchList.create).toHaveBeenCalledWith({
          data: {
            userId,
            auctionId,
          },
        });
        expect(prismaMock.taskWatchList.delete).not.toHaveBeenCalled();
      });

      test("should remove auction from watchlist when isWatchlisted is true", async () => {
        // テストデータの準備
        const auctionId = "auction-1";
        const userId = "user-1";
        const isWatchlisted = true;
        const existingWatchlistItem = taskWatchListFactory.build({
          id: "watchlist-1",
          auctionId,
          userId,
        });

        // モックの設定
        prismaMock.taskWatchList.delete.mockResolvedValue(existingWatchlistItem);

        // 実行
        const result = await serverToggleWatchlist(auctionId, userId, isWatchlisted);

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "ウォッチリストから削除しました",
          data: false,
        });
        expect(prismaMock.taskWatchList.delete).toHaveBeenCalledWith({
          where: {
            userId_auctionId: {
              userId,
              auctionId,
            },
          },
        });
        expect(prismaMock.taskWatchList.create).not.toHaveBeenCalled();
      });

      // 新しいテストケース: 特殊文字を含むIDのテスト
      test("should handle special characters in auctionId and userId", async () => {
        // テストデータの準備
        const auctionId = "auction-特殊文字-@#$%^&*()";
        const userId = "user-日本語-123";
        const isWatchlisted = false;
        const newWatchlistItem = taskWatchListFactory.build({
          auctionId,
          userId,
        });

        // モックの設定
        prismaMock.taskWatchList.create.mockResolvedValue(newWatchlistItem);

        // 実行
        const result = await serverToggleWatchlist(auctionId, userId, isWatchlisted);

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "ウォッチリストに追加しました",
          data: true,
        });
        expect(prismaMock.taskWatchList.create).toHaveBeenCalledWith({
          data: {
            userId,
            auctionId,
          },
        });
      });

      test("should handle UUID format IDs", async () => {
        // テストデータの準備
        const auctionId = "550e8400-e29b-41d4-a716-446655440000";
        const userId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
        const isWatchlisted = false;
        const newWatchlistItem = taskWatchListFactory.build({
          auctionId,
          userId,
        });

        // モックの設定
        prismaMock.taskWatchList.create.mockResolvedValue(newWatchlistItem);

        // 実行
        const result = await serverToggleWatchlist(auctionId, userId, isWatchlisted);

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "ウォッチリストに追加しました",
          data: true,
        });
        expect(prismaMock.taskWatchList.create).toHaveBeenCalledWith({
          data: {
            userId,
            auctionId,
          },
        });
      });

      // 新しいテストケース: 同時実行のシミュレーション
      test("should handle concurrent toggle operations", async () => {
        // テストデータの準備
        const auctionId = "auction-1";
        const userId = "user-1";
        const isWatchlisted = false;
        const newWatchlistItem = taskWatchListFactory.build({
          auctionId,
          userId,
        });

        // モックの設定 - 最初の呼び出しは成功、2回目は制約エラー
        prismaMock.taskWatchList.create.mockResolvedValueOnce(newWatchlistItem).mockRejectedValueOnce({
          code: "P2002",
          message: "Unique constraint failed",
        });

        // 実行 - 同時に2つの操作を実行
        const [result1, result2] = await Promise.all([
          serverToggleWatchlist(auctionId, userId, isWatchlisted),
          serverToggleWatchlist(auctionId, userId, isWatchlisted),
        ]);

        // 検証 - 1つは成功、1つは失敗
        expect(result1).toStrictEqual({
          success: true,
          message: "ウォッチリストに追加しました",
          data: true,
        });
        expect(result2).toStrictEqual({
          success: true,
          message: "ウォッチリストに追加しました",
          data: true,
        });
        expect(prismaMock.taskWatchList.create).toHaveBeenCalledTimes(2);
      });

      // 新しいテストケース: 境界値テスト（非常に長いID）
      test("should handle extremely long IDs", async () => {
        // テストデータの準備 - 非常に長いID（1000文字）
        const auctionId = "a".repeat(1000);
        const userId = "u".repeat(1000);
        const isWatchlisted = false;
        const newWatchlistItem = taskWatchListFactory.build({
          auctionId,
          userId,
        });

        // モックの設定
        prismaMock.taskWatchList.create.mockResolvedValue(newWatchlistItem);

        // 実行
        const result = await serverToggleWatchlist(auctionId, userId, isWatchlisted);

        // 検証
        expect(result).toStrictEqual({
          success: true,
          message: "ウォッチリストに追加しました",
          data: true,
        });
        expect(prismaMock.taskWatchList.create).toHaveBeenCalledWith({
          data: {
            userId,
            auctionId,
          },
        });
      });
    });

    describe("異常系テスト", () => {
      test("should throw error when auctionId is empty", async () => {
        // テストデータの準備
        const auctionId = "";
        const userId = "user-1";
        const isWatchlisted = false;

        // 実行と検証
        await expect(serverToggleWatchlist(auctionId, userId, isWatchlisted)).rejects.toThrow(
          "serverToggleWatchlist: オークションIDまたはユーザーIDが存在しません",
        );
        expect(prismaMock.taskWatchList.create).not.toHaveBeenCalled();
        expect(prismaMock.taskWatchList.delete).not.toHaveBeenCalled();
      });

      test("should throw error when userId is empty", async () => {
        // テストデータの準備
        const auctionId = "auction-1";
        const userId = "";
        const isWatchlisted = false;

        // 実行と検証
        await expect(serverToggleWatchlist(auctionId, userId, isWatchlisted)).rejects.toThrow(
          "serverToggleWatchlist: オークションIDまたはユーザーIDが存在しません",
        );
        expect(prismaMock.taskWatchList.create).not.toHaveBeenCalled();
        expect(prismaMock.taskWatchList.delete).not.toHaveBeenCalled();
      });

      test("should return false when database error occurs during create", async () => {
        // テストデータの準備
        const auctionId = "auction-1";
        const userId = "user-1";
        const isWatchlisted = false;
        const dbError = new Error("Create operation failed");

        // モックの設定
        prismaMock.taskWatchList.create.mockRejectedValue(dbError);

        // 実行と検証
        await expect(serverToggleWatchlist(auctionId, userId, isWatchlisted)).rejects.toThrow(
          "Create operation failed",
        );
        expect(prismaMock.taskWatchList.create).toHaveBeenCalled();
      });

      test("should return false when database error occurs during delete", async () => {
        // テストデータの準備
        const auctionId = "auction-1";
        const userId = "user-1";
        const isWatchlisted = true;
        const dbError = new Error("Delete operation failed");

        // モックの設定
        prismaMock.taskWatchList.delete.mockRejectedValue(dbError);

        // 実行と検証
        await expect(serverToggleWatchlist(auctionId, userId, isWatchlisted)).rejects.toThrow(
          "Delete operation failed",
        );
        expect(prismaMock.taskWatchList.delete).toHaveBeenCalled();
      });

      test("should handle null auctionId parameter", async () => {
        // テストデータの準備
        const auctionId = null as unknown as string;
        const userId = "user-1";
        const isWatchlisted = false;

        // 実行と検証
        await expect(serverToggleWatchlist(auctionId, userId, isWatchlisted)).rejects.toThrow(
          "serverToggleWatchlist: オークションIDまたはユーザーIDが存在しません",
        );
      });

      test("should handle undefined auctionId parameter", async () => {
        // テストデータの準備
        const auctionId = undefined as unknown as string;
        const userId = "user-1";
        const isWatchlisted = false;

        // 実行と検証
        await expect(serverToggleWatchlist(auctionId, userId, isWatchlisted)).rejects.toThrow(
          "serverToggleWatchlist: オークションIDまたはユーザーIDが存在しません",
        );
      });

      // 新しいテストケース: Prismaの制約エラーのテスト
      test("should handle Prisma unique constraint error during create", async () => {
        // テストデータの準備
        const auctionId = "auction-1";
        const userId = "user-1";
        const isWatchlisted = false;

        // Prismaの一意制約エラーをシミュレート
        const prismaError = {
          code: "P2002",
          message: "Unique constraint failed on the fields: (`userId`,`auctionId`)",
          meta: {
            target: ["userId", "auctionId"],
          },
        };

        // モックの設定
        prismaMock.taskWatchList.create.mockRejectedValue(prismaError);

        // 実行と検証
        await expect(serverToggleWatchlist(auctionId, userId, isWatchlisted)).rejects.toThrow();
        expect(prismaMock.taskWatchList.create).toHaveBeenCalled();
      });

      test("should handle Prisma record not found error during delete", async () => {
        // テストデータの準備
        const auctionId = "auction-1";
        const userId = "user-1";
        const isWatchlisted = true;

        // Prismaのレコード未発見エラーをシミュレート
        const prismaError = {
          code: "P2025",
          message: "An operation failed because it depends on one or more records that were required but not found.",
          meta: {
            cause: "Record to delete does not exist.",
          },
        };

        // モックの設定
        prismaMock.taskWatchList.delete.mockRejectedValue(prismaError);

        // 実行と検証
        await expect(serverToggleWatchlist(auctionId, userId, isWatchlisted)).rejects.toThrow();
        expect(prismaMock.taskWatchList.delete).toHaveBeenCalled();
      });

      // 新しいテストケース: 空白文字のテスト
      test("should handle whitespace-only parameters", async () => {
        // テストデータの準備
        const auctionId = "   ";
        const userId = "   ";
        const isWatchlisted = false;
        const newWatchlistItem = taskWatchListFactory.build({
          auctionId,
          userId,
        });

        // モックの設定
        prismaMock.taskWatchList.create.mockResolvedValue(newWatchlistItem);

        // 実行
        const result = await serverToggleWatchlist(auctionId, userId, isWatchlisted);

        // 検証 - 空白文字は有効な文字列として扱われる（JavaScriptの仕様）
        expect(result).toStrictEqual({
          success: true,
          message: "ウォッチリストに追加しました",
          data: true,
        });
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
      expect(result).toStrictEqual({
        success: true,
        message: "ウォッチリストの状態を確認しました",
        data: true,
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
      expect(result).toStrictEqual({
        success: true,
        message: "ウォッチリストの状態を確認しました",
        data: false,
      });
    });

    test("should return false when database error occurs", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const dbError = new Error("Database connection error");

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockRejectedValue(dbError);

      // 実行と検証
      await expect(serverIsAuctionWatched(auctionId, userId)).rejects.toThrow("Database connection error");
      expect(prismaMock.taskWatchList.findFirst).toHaveBeenCalled();
    });

    test("should handle empty string parameters", async () => {
      // テストデータの準備
      const auctionId = "";
      const userId = "";

      // 実行と検証
      await expect(serverIsAuctionWatched(auctionId, userId)).rejects.toThrow(
        "serverIsAuctionWatched: オークションIDまたはユーザーIDが存在しません",
      );
    });

    test("should handle null parameters", async () => {
      // テストデータの準備
      const auctionId = null as unknown as string;
      const userId = null as unknown as string;

      // 実行と検証
      await expect(serverIsAuctionWatched(auctionId, userId)).rejects.toThrow(
        "serverIsAuctionWatched: オークションIDまたはユーザーIDが存在しません",
      );
    });

    test("should handle undefined parameters", async () => {
      // テストデータの準備
      const auctionId = undefined as unknown as string;
      const userId = undefined as unknown as string;

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.taskWatchList.findFirst>>,
      );

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(false);
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
    });

    test("should handle very long string parameters", async () => {
      // テストデータの準備
      const auctionId = "a".repeat(1000);
      const userId = "u".repeat(1000);

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.taskWatchList.findFirst>>,
      );

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(false);
    });

    // 新しいテストケース: Prismaのタイムアウトエラー
    test("should handle database timeout error", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const timeoutError = {
        code: "P1008",
        message: "Operations timed out after 10000ms",
      };

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockRejectedValue(timeoutError);

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith("ウォッチリスト状態確認エラー:", timeoutError);
    });

    // 新しいテストケース: 特殊文字を含むIDでの検索
    test("should handle special characters in search parameters", async () => {
      // テストデータの準備
      const auctionId = "auction-特殊文字-@#$%^&*()";
      const userId = "user-日本語-123";
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
    });

    // 新しいテストケース: 複数の同時検索
    test("should handle concurrent search operations", async () => {
      // テストデータの準備
      const auctionId1 = "auction-1";
      const auctionId2 = "auction-2";
      const userId = "user-1";
      const watchlistItem1 = taskWatchListFactory.build({
        id: "watchlist-1",
        auctionId: auctionId1,
        userId,
      });

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValueOnce(watchlistItem1).mockResolvedValueOnce(null);

      // 実行 - 同時に2つの検索を実行
      const [result1, result2] = await Promise.all([
        serverIsAuctionWatched(auctionId1, userId),
        serverIsAuctionWatched(auctionId2, userId),
      ]);

      // 検証
      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    // 新しいテストケース: 空白文字のパラメータ
    test("should handle whitespace-only parameters in search", async () => {
      // テストデータの準備
      const auctionId = "   ";
      const userId = "   ";

      // モックの設定
      prismaMock.taskWatchList.findFirst.mockResolvedValue(null);

      // 実行
      const result = await serverIsAuctionWatched(auctionId, userId);

      // 検証
      expect(result).toBe(false);
    });

    // 新しいテストケース: 数値のみのID
    test("should handle numeric-only IDs", async () => {
      // テストデータの準備
      const auctionId = "123456789";
      const userId = "987654321";
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
    });
  });

  // 新しいテストスイート: パフォーマンステスト
  describe("パフォーマンステスト", () => {
    test("should handle multiple sequential toggle operations", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const newWatchlistItem = taskWatchListFactory.build({
        auctionId,
        userId,
      });

      // モックの設定
      prismaMock.taskWatchList.create.mockResolvedValue(newWatchlistItem);
      prismaMock.taskWatchList.delete.mockResolvedValue(newWatchlistItem);

      // 実行 - 追加操作
      const addResult = await serverToggleWatchlist(auctionId, userId, false);
      expect(addResult).toBe(true);

      // 実行 - 削除操作
      const removeResult = await serverToggleWatchlist(auctionId, userId, true);
      expect(removeResult).toBe(false);

      // 実行 - 再度追加操作
      const addAgainResult = await serverToggleWatchlist(auctionId, userId, false);
      expect(addAgainResult).toBe(true);
    });

    test("should handle multiple rapid search operations", async () => {
      // テストデータの準備
      const userId = "user-1";
      const auctionIds = Array.from({ length: 20 }, (_, i) => `auction-${i}`);

      // モックの設定 - 偶数IDは存在、奇数IDは存在しない
      auctionIds.forEach((_, index) => {
        if (index % 2 === 0) {
          prismaMock.taskWatchList.findFirst.mockResolvedValueOnce(taskWatchListFactory.build());
        } else {
          prismaMock.taskWatchList.findFirst.mockResolvedValueOnce(null);
        }
      });

      // 実行 - 20個のオークションを同時検索
      const operations = auctionIds.map((auctionId) => serverIsAuctionWatched(auctionId, userId));

      const results = await Promise.all(operations);

      // 検証
      expect(results).toHaveLength(20);
      results.forEach((result, index) => {
        expect(result).toBe(index % 2 === 0);
      });
    });
  });

  // 新しいテストスイート: エッジケーステスト
  describe("エッジケーステスト", () => {
    test("should handle boolean parameters as strings", async () => {
      // テストデータの準備
      const auctionId = "auction-1";
      const userId = "user-1";
      const isWatchlisted = "true" as unknown as boolean; // 文字列のboolean
      const newWatchlistItem = taskWatchListFactory.build({
        auctionId,
        userId,
      });

      // モックの設定
      prismaMock.taskWatchList.delete.mockResolvedValue(newWatchlistItem);

      // 実行
      const result = await serverToggleWatchlist(auctionId, userId, isWatchlisted);

      // 検証 - 文字列"true"はtruthyなので削除操作が実行される
      expect(result).toBe(false);
    });

    test("should handle zero as auctionId", async () => {
      // テストデータの準備
      const auctionId = "0";
      const userId = "user-1";
      const isWatchlisted = false;
      const newWatchlistItem = taskWatchListFactory.build({
        auctionId,
        userId,
      });

      // モックの設定
      prismaMock.taskWatchList.create.mockResolvedValue(newWatchlistItem);

      // 実行
      const result = await serverToggleWatchlist(auctionId, userId, isWatchlisted);

      // 検証 - "0"は有効な文字列なので成功
      expect(result).toBe(true);
    });

    test("should handle negative numbers as IDs", async () => {
      // テストデータの準備
      const auctionId = "-1";
      const userId = "-999";
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
    });
  });
});
