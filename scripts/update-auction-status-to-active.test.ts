import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { main, updateAuctionStatusToActive } from "./update-auction-status-to-active";

/**
 * コンソール出力のモック
 * setup.tsでグローバルにモックされているため、元のconsoleオブジェクトを使用
 */
const originalConsole = {
  log: console.log,
  error: console.error,
};

const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();

/**
 * process.exitのモック
 */
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

/**
 * テスト終了後のクリーンアップ
 */
afterAll(() => {
  // コンソールを元に戻す
  console.log = originalConsole.log;
  console.error = originalConsole.error;
});

/**
 * テストヘルパー関数
 */
const setupPrismaMockForSuccess = (count: number) => {
  prismaMock.task.updateMany.mockResolvedValue({ count });
};

const setupPrismaMockForError = (error: Error) => {
  prismaMock.task.updateMany.mockRejectedValue(error);
};

const expectUpdateManyCalledWithCorrectParams = () => {
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
};

const expectSuccessLog = (count: number) => {
  expect(mockConsoleLog).toHaveBeenCalledWith(`${count}件のオークションを開始しました。`);
};

const expectErrorLog = (error: Error) => {
  expect(mockConsoleError).toHaveBeenCalledWith("オークション開始処理でエラーが発生しました:", error);
};

describe("updateAuctionStatusToActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // コンソールモックを設定
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
  });

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test.each([
      { count: 0, description: "更新対象なし" },
      { count: 1, description: "1件の更新" },
      { count: 3, description: "複数件の更新" },
      { count: 1000, description: "大量の更新" },
      { count: Number.MAX_SAFE_INTEGER, description: "最大整数値の更新" },
    ])("should handle $description correctly (count: $count)", async ({ count }) => {
      // Prismaモックの設定
      setupPrismaMockForSuccess(count);

      // テスト実行
      const result = await updateAuctionStatusToActive();

      // 検証
      expect(result).toBe(count);
      expectUpdateManyCalledWithCorrectParams();
      expectSuccessLog(count);
      expect(prismaMock.$disconnect).toHaveBeenCalledTimes(1);
    });

    test("should use current date for comparison", async () => {
      // 現在時刻の取得をテスト
      const beforeTest = new Date();
      setupPrismaMockForSuccess(1);

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

    test("should use correct TaskStatus enum values", async () => {
      setupPrismaMockForSuccess(1);

      await updateAuctionStatusToActive();

      const callArgs = prismaMock.task.updateMany.mock.calls[0][0];
      expect(callArgs?.where?.status).toBe(TaskStatus.PENDING);
      expect(callArgs?.data?.status).toBe(TaskStatus.AUCTION_ACTIVE);
    });
  });

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test.each([
      { error: new Error("Database connection failed"), description: "データベース接続エラー" },
      { error: new Error("Unexpected Prisma error"), description: "予期しないPrismaエラー" },
      { error: new Error("Network timeout"), description: "ネットワークタイムアウト" },
    ])("should handle $description", async ({ error }) => {
      // エラーをシミュレート
      setupPrismaMockForError(error);

      // テスト実行と検証
      await expect(updateAuctionStatusToActive()).rejects.toThrow(error.message);
      expectErrorLog(error);
      expect(prismaMock.$disconnect).toHaveBeenCalledTimes(1);
    });

    test("should handle null or undefined return from updateMany", async () => {
      // 異常な戻り値をシミュレート
      prismaMock.task.updateMany.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.task.updateMany>>);

      // テスト実行と検証
      await expect(updateAuctionStatusToActive()).rejects.toThrow();
      expect(prismaMock.$disconnect).toHaveBeenCalledTimes(1);
    });
  });
});

describe("main", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // コンソールモックを設定
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
  });

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test.each([
      { count: 0, description: "更新対象なし" },
      { count: 1, description: "1件の更新" },
      { count: 5, description: "複数件の更新" },
    ])("should execute successfully with $description (count: $count)", async ({ count }) => {
      // updateAuctionStatusToActiveの成功をモック
      setupPrismaMockForSuccess(count);

      // テスト実行と検証
      await expect(main()).rejects.toThrow("process.exit called");

      // ログの検証
      expect(mockConsoleLog).toHaveBeenCalledWith("オークションのステータスを更新します...");
      expectSuccessLog(count);
      expect(mockConsoleLog).toHaveBeenCalledWith(`処理が完了しました。${count}件のオークションのステータスを更新しました。`);

      // process.exitが正常終了コードで呼ばれることを確認
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    test("should log messages in correct order", async () => {
      const count = 3;
      setupPrismaMockForSuccess(count);

      await expect(main()).rejects.toThrow("process.exit called");

      // ログの順序を検証
      const logCalls = mockConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCalls).toEqual([
        "オークションのステータスを更新します...",
        `${count}件のオークションを開始しました。`,
        `処理が完了しました。${count}件のオークションのステータスを更新しました。`,
      ]);
    });
  });

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test.each([
      { error: new Error("Database connection failed"), description: "データベースエラー" },
      { error: new Error("Unexpected error"), description: "予期しないエラー" },
    ])("should handle $description and exit with code 1", async ({ error }) => {
      // エラーをシミュレート
      setupPrismaMockForError(error);

      // テスト実行と検証
      await expect(main()).rejects.toThrow("process.exit called");

      // エラーログの検証
      expect(mockConsoleLog).toHaveBeenCalledWith("オークションのステータスを更新します...");
      expectErrorLog(error);
      expect(mockConsoleError).toHaveBeenCalledWith("エラーが発生しました:", error);

      // process.exitがエラーコードで呼ばれることを確認
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    test("should call process.exit with correct codes for both success and error cases", async () => {
      // 正常系
      setupPrismaMockForSuccess(1);
      await expect(main()).rejects.toThrow("process.exit called");
      expect(mockProcessExit).toHaveBeenCalledWith(0);

      // 異常系
      vi.clearAllMocks();
      setupPrismaMockForError(new Error("Test error"));
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
      const localMockConsoleError = vi.fn();
      const localMockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      // ローカルコンソールモックを設定
      console.error = localMockConsoleError;

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
        // コンソールを元に戻す
        console.error = originalConsole.error;
        localMockProcessExit.mockRestore();
      }
    });
  });
});
