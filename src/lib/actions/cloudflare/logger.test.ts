import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { logger } from "./logger";

// コンソールメソッドのモック
const mockConsoleWarn = vi.fn();
const mockConsoleError = vi.fn();

describe("logger", () => {
  beforeEach(() => {
    // 各テスト前にモックをクリア
    vi.clearAllMocks();

    // コンソールメソッドをモック化
    vi.spyOn(console, "warn").mockImplementation(mockConsoleWarn);
    vi.spyOn(console, "error").mockImplementation(mockConsoleError);
  });

  afterEach(() => {
    // 各テスト後にモックを復元
    vi.restoreAllMocks();
  });

  describe("warn", () => {
    test("should call console.warn with the provided message", () => {
      const message = "テスト警告メッセージ";

      logger.warn(message);

      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleWarn).toHaveBeenCalledWith(message);
    });

    test("should handle empty string message", () => {
      const message = "";

      logger.warn(message);

      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleWarn).toHaveBeenCalledWith(message);
    });

    test("should handle special characters in message", () => {
      const message = "特殊文字テスト: !@#$%^&*()_+{}|:<>?[]\\;'\",./ 日本語";

      logger.warn(message);

      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleWarn).toHaveBeenCalledWith(message);
    });

    test("should handle very long message", () => {
      const message = "a".repeat(10000); // 10,000文字の長いメッセージ

      logger.warn(message);

      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleWarn).toHaveBeenCalledWith(message);
    });
  });

  describe("error", () => {
    test("should call console.error with message only when error is not provided", () => {
      const message = "テストエラーメッセージ";

      logger.error(message);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(message, undefined);
    });

    test("should call console.error with message and error when both are provided", () => {
      const message = "テストエラーメッセージ";
      const error = new Error("テストエラー");

      logger.error(message, error);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(message, error);
    });

    test("should handle string error", () => {
      const message = "テストエラーメッセージ";
      const error = "文字列エラー";

      logger.error(message, error);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(message, error);
    });

    test("should handle object error", () => {
      const message = "テストエラーメッセージ";
      const error = { code: 500, message: "サーバーエラー" };

      logger.error(message, error);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(message, error);
    });

    test("should handle null error", () => {
      const message = "テストエラーメッセージ";
      const error = null;

      logger.error(message, error);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(message, error);
    });

    test("should handle undefined error explicitly", () => {
      const message = "テストエラーメッセージ";
      const error = undefined;

      logger.error(message, error);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(message, error);
    });

    test("should handle empty string message with error", () => {
      const message = "";
      const error = new Error("テストエラー");

      logger.error(message, error);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(message, error);
    });

    test("should handle complex error object", () => {
      const message = "複雑なエラーオブジェクト";
      const error = {
        name: "CustomError",
        message: "カスタムエラーメッセージ",
        stack: "Error stack trace...",
        code: "ERR_CUSTOM",
        details: {
          timestamp: new Date().toISOString(),
          userId: "user123",
        },
      };

      logger.error(message, error);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(message, error);
    });
  });

  describe("logger object structure", () => {
    test("should have warn and error methods", () => {
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    test("should only have warn and error methods", () => {
      const loggerKeys = Object.keys(logger);
      expect(loggerKeys).toHaveLength(2);
      expect(loggerKeys).toContain("warn");
      expect(loggerKeys).toContain("error");
    });
  });
});
