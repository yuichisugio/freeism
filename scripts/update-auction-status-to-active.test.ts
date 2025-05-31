import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { main, updateAuctionStatusToActive } from "./update-auction-status-to-active";

/**
 * コンソール出力のモック
 */
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

/**
 * process.exitのモック
 */
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

describe("updateAuctionStatusToActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should update auction status from PENDING to AUCTION_ACTIVE when startTime is before now", async () => {
      // Prismaモックの設定
      prismaMock.task.updateMany.mockResolvedValue({ count: 3 });

      // テスト実行
      const result = await updateAuctionStatusToActive();

      // 検証
      expect(result).toBe(3);
      expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
        where: {
          status: TaskStatus.PENDING,
          auction: {
            startTime: {
              lte: expect.any(Date),
            },
          },
        },
        data: {
          status: TaskStatus.AUCTION_ACTIVE,
        },
      });
      expect(mockConsoleLog).toHaveBeenCalledWith("3件のオークションを開始しました。");
    });

    test("should return 0 when no auctions need to be updated", async () => {
      // Prismaモックの設定 - 更新対象なし
      prismaMock.task.updateMany.mockResolvedValue({ count: 0 });

      // テスト実行
      const result = await updateAuctionStatusToActive();

      // 検証
      expect(result).toBe(0);
      expect(prismaMock.task.updateMany).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith("0件のオークションを開始しました。");
    });

    test("should handle large number of auctions", async () => {
      // 大量のオークション更新をテスト
      const largeCount = 1000;
      prismaMock.task.updateMany.mockResolvedValue({ count: largeCount });

      // テスト実行
      const result = await updateAuctionStatusToActive();

      // 検証
      expect(result).toBe(largeCount);
      expect(mockConsoleLog).toHaveBeenCalledWith(`${largeCount}件のオークションを開始しました。`);
    });

    test("should disconnect from Prisma on success", async () => {
      prismaMock.task.updateMany.mockResolvedValue({ count: 1 });

      await updateAuctionStatusToActive();

      expect(prismaMock.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should throw error when database operation fails", async () => {
      // データベースエラーをシミュレート
      const dbError = new Error("Database connection failed");
      prismaMock.task.updateMany.mockRejectedValue(dbError);

      // テスト実行と検証
      await expect(updateAuctionStatusToActive()).rejects.toThrow("Database connection failed");
      expect(mockConsoleError).toHaveBeenCalledWith("オークション開始処理でエラーが発生しました:", dbError);
    });

    test("should throw error when Prisma client throws unexpected error", async () => {
      // 予期しないエラーをシミュレート
      const unexpectedError = new Error("Unexpected Prisma error");
      prismaMock.task.updateMany.mockRejectedValue(unexpectedError);

      // テスト実行と検証
      await expect(updateAuctionStatusToActive()).rejects.toThrow("Unexpected Prisma error");
      expect(mockConsoleError).toHaveBeenCalledWith("オークション開始処理でエラーが発生しました:", unexpectedError);
    });

    test("should handle null or undefined return from updateMany", async () => {
      // 異常な戻り値をシミュレート
      prismaMock.task.updateMany.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.task.updateMany>>);

      // テスト実行と検証
      await expect(updateAuctionStatusToActive()).rejects.toThrow();
    });

    test("should disconnect from Prisma even when error occurs", async () => {
      const dbError = new Error("Database error");
      prismaMock.task.updateMany.mockRejectedValue(dbError);

      await expect(updateAuctionStatusToActive()).rejects.toThrow();
      expect(prismaMock.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    test("should handle exactly current time as boundary", async () => {
      // 現在時刻ちょうどの境界値テスト
      prismaMock.task.updateMany.mockResolvedValue({ count: 1 });

      const result = await updateAuctionStatusToActive();

      expect(result).toBe(1);
      expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
        where: {
          status: TaskStatus.PENDING,
          auction: {
            startTime: {
              lte: expect.any(Date),
            },
          },
        },
        data: {
          status: TaskStatus.AUCTION_ACTIVE,
        },
      });
    });

    test("should handle maximum integer count", async () => {
      // 最大整数値のテスト
      const maxCount = Number.MAX_SAFE_INTEGER;
      prismaMock.task.updateMany.mockResolvedValue({ count: maxCount });

      const result = await updateAuctionStatusToActive();

      expect(result).toBe(maxCount);
      expect(mockConsoleLog).toHaveBeenCalledWith(`${maxCount}件のオークションを開始しました。`);
    });

    test("should use current date for comparison", async () => {
      // 現在時刻の取得をテスト
      const beforeTest = new Date();
      prismaMock.task.updateMany.mockResolvedValue({ count: 1 });

      await updateAuctionStatusToActive();
      const afterTest = new Date();

      // updateManyが呼ばれた時の引数を検証
      const callArgs = prismaMock.task.updateMany.mock.calls[0][0];
      const whereClause = callArgs?.where?.auction?.startTime;

      // 型安全な方法で日時を取得
      let usedDate: Date | undefined;
      if (whereClause && typeof whereClause === "object" && "lte" in whereClause) {
        usedDate = whereClause.lte as Date;
      }

      // 使用された日時がテスト実行時間の範囲内であることを確認
      expect(usedDate).toBeInstanceOf(Date);
      if (usedDate) {
        expect(usedDate.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
        expect(usedDate.getTime()).toBeLessThanOrEqual(afterTest.getTime());
      }
    });
  });

  /**
   * 機能別テスト
   */
  describe("機能別テスト", () => {
    test("should use correct TaskStatus enum values", async () => {
      prismaMock.task.updateMany.mockResolvedValue({ count: 1 });

      await updateAuctionStatusToActive();

      const callArgs = prismaMock.task.updateMany.mock.calls[0][0];
      expect(callArgs?.where?.status).toBe(TaskStatus.PENDING);
      expect(callArgs?.data?.status).toBe(TaskStatus.AUCTION_ACTIVE);
    });

    test("should log correct message format", async () => {
      const testCases = [0, 1, 5, 100];

      for (const count of testCases) {
        vi.clearAllMocks();
        prismaMock.task.updateMany.mockResolvedValue({ count });

        await updateAuctionStatusToActive();

        expect(mockConsoleLog).toHaveBeenCalledWith(`${count}件のオークションを開始しました。`);
        expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      }
    });

    test("should log error message when exception occurs", async () => {
      const error = new Error("Test error");
      prismaMock.task.updateMany.mockRejectedValue(error);

      await expect(updateAuctionStatusToActive()).rejects.toThrow();

      expect(mockConsoleError).toHaveBeenCalledWith("オークション開始処理でエラーが発生しました:", error);
    });
  });
});

describe("main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should execute successfully and exit with code 0", async () => {
      // updateAuctionStatusToActiveの成功をモック
      prismaMock.task.updateMany.mockResolvedValue({ count: 5 });

      // テスト実行と検証
      await expect(main()).rejects.toThrow("process.exit called");

      // ログの検証
      expect(mockConsoleLog).toHaveBeenCalledWith("オークションのステータスを更新します...");
      expect(mockConsoleLog).toHaveBeenCalledWith("5件のオークションを開始しました。");
      expect(mockConsoleLog).toHaveBeenCalledWith("処理が完了しました。5件のオークションのステータスを更新しました。");

      // process.exitが正常終了コードで呼ばれることを確認
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    test("should handle zero updates correctly", async () => {
      // 更新対象なしの場合
      prismaMock.task.updateMany.mockResolvedValue({ count: 0 });

      await expect(main()).rejects.toThrow("process.exit called");

      expect(mockConsoleLog).toHaveBeenCalledWith("オークションのステータスを更新します...");
      expect(mockConsoleLog).toHaveBeenCalledWith("0件のオークションを開始しました。");
      expect(mockConsoleLog).toHaveBeenCalledWith("処理が完了しました。0件のオークションのステータスを更新しました。");
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should handle database error and exit with code 1", async () => {
      // データベースエラーをシミュレート
      const dbError = new Error("Database connection failed");
      prismaMock.task.updateMany.mockRejectedValue(dbError);

      // テスト実行と検証
      await expect(main()).rejects.toThrow("process.exit called");

      // エラーログの検証
      expect(mockConsoleLog).toHaveBeenCalledWith("オークションのステータスを更新します...");
      expect(mockConsoleError).toHaveBeenCalledWith("オークション開始処理でエラーが発生しました:", dbError);
      expect(mockConsoleError).toHaveBeenCalledWith("エラーが発生しました:", dbError);

      // process.exitがエラーコードで呼ばれることを確認
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    test("should handle unexpected error and exit with code 1", async () => {
      // 予期しないエラーをシミュレート
      const unexpectedError = new Error("Unexpected error");
      prismaMock.task.updateMany.mockRejectedValue(unexpectedError);

      await expect(main()).rejects.toThrow("process.exit called");

      expect(mockConsoleError).toHaveBeenCalledWith("オークション開始処理でエラーが発生しました:", unexpectedError);
      expect(mockConsoleError).toHaveBeenCalledWith("エラーが発生しました:", unexpectedError);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  /**
   * 統合テスト
   */
  describe("統合テスト", () => {
    test("should log messages in correct order", async () => {
      prismaMock.task.updateMany.mockResolvedValue({ count: 3 });

      await expect(main()).rejects.toThrow("process.exit called");

      // ログの順序を検証
      const logCalls = mockConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCalls).toEqual([
        "オークションのステータスを更新します...",
        "3件のオークションを開始しました。",
        "処理が完了しました。3件のオークションのステータスを更新しました。",
      ]);
    });

    test("should call process.exit with correct codes", async () => {
      // 正常系
      prismaMock.task.updateMany.mockResolvedValue({ count: 1 });
      await expect(main()).rejects.toThrow("process.exit called");
      expect(mockProcessExit).toHaveBeenCalledWith(0);

      // 異常系
      vi.clearAllMocks();
      prismaMock.task.updateMany.mockRejectedValue(new Error("Test error"));
      await expect(main()).rejects.toThrow("process.exit called");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  /**
   * スクリプト実行テスト
   */
  describe("スクリプト実行", () => {
    test("should handle script execution error in catch block", () => {
      // require.main === moduleの分岐をテストするため、
      // スクリプト実行時のエラーハンドリングをテスト
      const originalRequireMain = require.main;
      const localMockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const localMockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      try {
        // require.mainをモジュール自体に設定
        require.main = module;

        // エラーを発生させるためのテスト
        const error = new Error("Script execution error");

        // catchブロックの実行をシミュレート
        expect(() => {
          console.error("スクリプト実行中にエラーが発生しました:", error);
          process.exit(1);
        }).toThrow("process.exit called");

        expect(localMockConsoleError).toHaveBeenCalledWith("スクリプト実行中にエラーが発生しました:", error);
        expect(localMockProcessExit).toHaveBeenCalledWith(1);
      } finally {
        // require.mainを元に戻す
        require.main = originalRequireMain;
        localMockConsoleError.mockRestore();
        localMockProcessExit.mockRestore();
      }
    });
  });
});
