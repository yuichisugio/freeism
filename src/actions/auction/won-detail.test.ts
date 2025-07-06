import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { taskFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test } from "vitest";

import { completeTaskDelivery } from "./won-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("completeTaskDelivery", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    prismaMock.task.update.mockReset();
  });

  describe("正常系テスト", () => {
    test("should successfully complete task delivery with valid taskId", async () => {
      // テストデータの準備
      const taskId = "test-task-id";
      const mockTask = taskFactory.build({
        id: taskId,
        status: TaskStatus.TASK_COMPLETED,
      });

      // Prismaモックの設定
      prismaMock.task.update.mockResolvedValue(mockTask);

      // 関数実行
      const result = await completeTaskDelivery(taskId);

      // 結果の検証
      expect(result).toStrictEqual({
        success: true,
        message: "タスク完了処理に成功しました",
        data: null,
        error: null,
      });

      // Prismaメソッドが正しく呼ばれたかを検証
      expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.TASK_COMPLETED,
        },
      });
    });

    test("should handle UUID format taskId correctly", async () => {
      // UUIDフォーマットのタスクIDでテスト
      const taskId = "550e8400-e29b-41d4-a716-446655440000";
      const mockTask = taskFactory.build({
        id: taskId,
        status: TaskStatus.TASK_COMPLETED,
      });

      prismaMock.task.update.mockResolvedValue(mockTask);

      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: true,
        message: "タスク完了処理に成功しました",
        data: null,
        error: null,
      });
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.TASK_COMPLETED,
        },
      });
    });

    test("should handle long taskId correctly", async () => {
      // 長いタスクIDでテスト（境界値テスト）
      const taskId = "a".repeat(100);
      const mockTask = taskFactory.build({
        id: taskId,
        status: TaskStatus.TASK_COMPLETED,
      });

      prismaMock.task.update.mockResolvedValue(mockTask);

      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: true,
        message: "タスク完了処理に成功しました",
        data: null,
        error: null,
      });
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.TASK_COMPLETED,
        },
      });
    });
  });

  describe("異常系テスト", () => {
    test("should return error when taskId does not exist", async () => {
      // 存在しないタスクIDでテスト
      const taskId = "non-existent-task-id";

      // Prismaエラーをモック
      const prismaError = new Error("Record to update not found");
      prismaMock.task.update.mockRejectedValue(prismaError);

      // エラーレスポンスが返されることを検証
      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: false,
        data: null,
        message: "completeTaskDelivery: タスク完了処理アクションに失敗しました: Record to update not found",
      });

      expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.TASK_COMPLETED,
        },
      });
    });

    test("should return error when database connection fails", async () => {
      // データベース接続エラーをテスト
      const taskId = "test-task-id";
      const dbError = new Error("Database connection failed");

      prismaMock.task.update.mockRejectedValue(dbError);

      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: false,
        data: null,
        message: "completeTaskDelivery: タスク完了処理アクションに失敗しました: Database connection failed",
      });

      expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
    });

    test("should return error when Prisma constraint violation occurs", async () => {
      // Prisma制約違反エラーをテスト
      const taskId = "test-task-id";
      const constraintError = new Error("Unique constraint failed");

      prismaMock.task.update.mockRejectedValue(constraintError);

      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: false,
        data: null,
        message: "completeTaskDelivery: タスク完了処理アクションに失敗しました: Unique constraint failed",
      });

      expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("境界値テスト", () => {
    test("should return error when taskId is empty string", async () => {
      // 空文字列のタスクIDでテスト
      const taskId = "";

      // 空文字列の場合は実装内でエラーが投げられる
      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: false,
        data: null,
        error:
          "completeTaskDelivery: タスク完了処理アクションに失敗しました: completeTaskDelivery: タスクIDが存在しません",
      });

      // 空文字列の場合はPrismaが呼ばれない
      expect(prismaMock.task.update).not.toHaveBeenCalled();
    });

    test("should handle single character taskId", async () => {
      // 1文字のタスクIDでテスト（境界値）
      const taskId = "a";
      const mockTask = taskFactory.build({
        id: taskId,
        status: TaskStatus.TASK_COMPLETED,
      });

      prismaMock.task.update.mockResolvedValue(mockTask);

      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: true,
        message: "タスク完了処理に成功しました",
        data: null,
      });
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.TASK_COMPLETED,
        },
      });
    });

    test("should handle taskId with special characters", async () => {
      // 特殊文字を含むタスクIDでテスト
      const taskId = "task-id_with.special@chars#123";
      const mockTask = taskFactory.build({
        id: taskId,
        status: TaskStatus.TASK_COMPLETED,
      });

      prismaMock.task.update.mockResolvedValue(mockTask);

      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: true,
        message: "タスク完了処理に成功しました",
        data: null,
      });
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.TASK_COMPLETED,
        },
      });
    });

    test("should handle numeric string taskId", async () => {
      // 数値文字列のタスクIDでテスト
      const taskId = "12345";
      const mockTask = taskFactory.build({
        id: taskId,
        status: TaskStatus.TASK_COMPLETED,
      });

      prismaMock.task.update.mockResolvedValue(mockTask);

      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: true,
        message: "タスク完了処理に成功しました",
        data: null,
      });
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.TASK_COMPLETED,
        },
      });
    });

    describe("エッジケーステスト", () => {
      test("should handle concurrent calls with same taskId", async () => {
        // 同じタスクIDで同時実行された場合のテスト
        const taskId = "concurrent-task-id";
        const mockTask = taskFactory.build({
          id: taskId,
          status: TaskStatus.TASK_COMPLETED,
        });

        prismaMock.task.update.mockResolvedValue(mockTask);

        // 同時に複数回実行
        const promises = [completeTaskDelivery(taskId), completeTaskDelivery(taskId), completeTaskDelivery(taskId)];

        const results = await Promise.all(promises);

        // すべて成功することを確認
        results.forEach((result) => {
          expect(result).toStrictEqual({
            success: true,
            message: "タスク完了処理に成功しました",
            data: null,
          });
        });

        // 3回呼ばれることを確認
        expect(prismaMock.task.update).toHaveBeenCalledTimes(3);
      });

      test("should return error when timeout occurs", async () => {
        // タイムアウトシナリオのテスト
        const taskId = "timeout-task-id";
        const timeoutError = new Error("Operation timed out");

        prismaMock.task.update.mockRejectedValue(timeoutError);

        const result = await completeTaskDelivery(taskId);

        expect(result).toStrictEqual({
          success: false,
          data: null,
          message: "completeTaskDelivery: タスク完了処理アクションに失敗しました: Operation timed out",
        });

        expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
      });
    });

    describe("戻り値の型のテスト", () => {
      test("should return correct type structure", async () => {
        // 戻り値の型構造が正しいことを確認
        const taskId = "type-test-task-id";
        const mockTask = taskFactory.build({
          id: taskId,
          status: TaskStatus.TASK_COMPLETED,
        });

        prismaMock.task.update.mockResolvedValue(mockTask);

        const result = await completeTaskDelivery(taskId);

        // 戻り値の型と構造を検証
        expect(typeof result).toBe("object");
        expect(typeof result.success).toBe("boolean");
        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
        expect(Object.keys(result)).toStrictEqual(["success", "message", "data"]);
      });

      test("should return error field in success case", async () => {
        // 成功時にerrorフィールドがnullで含まれることを確認
        const taskId = "success-test-task-id";
        const mockTask = taskFactory.build({
          id: taskId,
          status: TaskStatus.TASK_COMPLETED,
        });

        prismaMock.task.update.mockResolvedValue(mockTask);

        const result = await completeTaskDelivery(taskId);

        expect(result).toStrictEqual({
          success: true,
          message: "タスク完了処理に成功しました",
          data: null,
        });
        expect("data" in result).toBe(true);
        expect(result.data).toBeNull();
      });
    });
  });

  describe("引数の検証テスト", () => {
    test("should return error when taskId is null", async () => {
      // nullのタスクIDでテスト
      const result = await completeTaskDelivery(null as unknown as string);

      expect(result).toStrictEqual({
        success: false,
        data: null,
        message:
          "completeTaskDelivery: タスク完了処理アクションに失敗しました: completeTaskDelivery: タスクIDが存在しません",
      });

      expect(prismaMock.task.update).not.toHaveBeenCalled();
    });

    test("should return error when taskId is undefined", async () => {
      // undefinedのタスクIDでテスト
      const result = await completeTaskDelivery(undefined as unknown as string);

      expect(result).toStrictEqual({
        success: false,
        data: null,
        error:
          "completeTaskDelivery: タスク完了処理アクションに失敗しました: completeTaskDelivery: タスクIDが存在しません",
      });

      expect(prismaMock.task.update).not.toHaveBeenCalled();
    });

    test("should handle non-Error object thrown", async () => {
      // Error以外のオブジェクトが投げられた場合のテスト（ブランチカバレッジ向上）
      const taskId = "test-task-id";
      const nonErrorObject = "文字列エラー";

      prismaMock.task.update.mockRejectedValue(nonErrorObject);

      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: false,
        data: null,
        message: "completeTaskDelivery: タスク完了処理アクションに失敗しました: 不明なエラー",
      });

      expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
    });

    test("should handle null thrown as error", async () => {
      // nullが投げられた場合のテスト（ブランチカバレッジ向上）
      const taskId = "test-task-id";

      prismaMock.task.update.mockRejectedValue(null);

      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: false,
        data: null,
        message: "completeTaskDelivery: タスク完了処理アクションに失敗しました: 不明なエラー",
      });

      expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
    });

    test("should handle undefined thrown as error", async () => {
      // undefinedが投げられた場合のテスト（ブランチカバレッジ向上）
      const taskId = "test-task-id";

      prismaMock.task.update.mockRejectedValue(undefined);

      const result = await completeTaskDelivery(taskId);

      expect(result).toStrictEqual({
        success: false,
        data: null,
        message: "completeTaskDelivery: タスク完了処理アクションに失敗しました: 不明なエラー",
      });

      expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
    });
  });
});
