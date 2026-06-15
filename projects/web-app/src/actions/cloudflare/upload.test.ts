import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { logger } from "./logger";
import { getSignedUploadUrl, uploadFile } from "./upload";

// loggerのモック
vi.mock("./logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// fetchのモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("upload.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトの環境変数設定
    process.env.ENABLE_IMAGE_UPLOAD = "true";
    process.env.CLOUDFLARE_ENDPOINT = "https://api.cloudflare.com";
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account-id";
    process.env.CLOUDFLARE_API_TOKEN = "test-api-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("uploadFile", () => {
    test("should upload file successfully", async () => {
      // テストファイルの作成
      const testFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      // モックレスポンスの設定
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: {
            id: "test-id",
            variants: ["https://example.com/test.jpg"],
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // 関数実行
      const result = await uploadFile(testFile);

      // 検証
      expect(result).toStrictEqual({
        success: true,
        url: "https://example.com/test.jpg",
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("should upload file successfully with options", async () => {
      const testFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });
      const options = { path: "uploads/", filename: "custom-name.jpg" };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: {
            id: "test-id",
            variants: ["https://example.com/custom-name.jpg"],
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await uploadFile(testFile, options);

      expect(result).toStrictEqual({
        success: true,
        url: "https://example.com/custom-name.jpg",
      });

      // fetchが呼び出されたことを確認
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("should return error when CLOUDFLARE_ENDPOINT is missing", async () => {
      delete process.env.CLOUDFLARE_ENDPOINT;

      const testFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      const result = await uploadFile(testFile);

      expect(result).toStrictEqual({
        success: false,
        error: "ストレージ設定が不完全です",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should return error when CLOUDFLARE_ACCOUNT_ID is missing", async () => {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;

      const testFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      const result = await uploadFile(testFile);

      expect(result).toStrictEqual({
        success: false,
        error: "ストレージ設定が不完全です",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should return error when CLOUDFLARE_API_TOKEN is missing", async () => {
      delete process.env.CLOUDFLARE_API_TOKEN;

      const testFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      const result = await uploadFile(testFile);

      expect(result).toStrictEqual({
        success: false,
        error: "ストレージ設定が不完全です",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should return error when API response is not ok", async () => {
      const testFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [{ code: 400, message: "Bad Request" }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await uploadFile(testFile);

      expect(result).toStrictEqual({
        success: false,
        error: "Bad Request",
      });
    });

    test("should return error when API response has no error message", async () => {
      const testFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await uploadFile(testFile);

      expect(result).toStrictEqual({
        success: false,
        error: "アップロードエラー",
      });
    });

    test("should return error when fetch throws an exception", async () => {
      const testFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await uploadFile(testFile);

      expect(result).toStrictEqual({
        success: false,
        error: "アップロード処理中にエラーが発生しました",
      });
    });

    test("should return empty url when variants is empty", async () => {
      const testFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: {
            id: "test-id",
            variants: [],
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await uploadFile(testFile);

      expect(result).toStrictEqual({
        success: true,
        url: "",
      });
    });

    test("should return empty url when result is undefined", async () => {
      const testFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await uploadFile(testFile);

      expect(result).toStrictEqual({
        success: true,
        url: "",
      });
    });
  });

  describe("getSignedUploadUrl", () => {
    test("should return null when image upload is disabled", async () => {
      process.env.ENABLE_IMAGE_UPLOAD = "false";

      const result = await getSignedUploadUrl("image/jpeg");

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("画像アップロード機能が無効です");
    });

    test("should get signed upload URL successfully", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          signedUrl: "https://example.com/signed-url",
          publicUrl: "https://example.com/public-url",
          key: "test-key",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await getSignedUploadUrl("image/jpeg", "test.jpg");

      expect(result).toStrictEqual({
        signedUrl: "https://example.com/signed-url",
        publicUrl: "https://example.com/public-url",
        key: "test-key",
      });
      expect(mockFetch).toHaveBeenCalledWith("/api/upload/get-signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileType: "image/jpeg",
          fileName: "test.jpg",
        }),
      });
    });

    test("should get signed upload URL successfully without fileName", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          signedUrl: "https://example.com/signed-url",
          publicUrl: "https://example.com/public-url",
          key: "generated-key",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await getSignedUploadUrl("image/png");

      expect(result).toStrictEqual({
        signedUrl: "https://example.com/signed-url",
        publicUrl: "https://example.com/public-url",
        key: "generated-key",
      });
      expect(mockFetch).toHaveBeenCalledWith("/api/upload/get-signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileType: "image/png",
          fileName: undefined,
        }),
      });
    });

    test("should return null when API response is not ok", async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({
          message: "API Error",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await getSignedUploadUrl("image/jpeg");

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("署名付きURLの取得中にエラーが発生しました", "API Error");
    });

    test("should return null when API response has no error message", async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await getSignedUploadUrl("image/jpeg");

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        "署名付きURLの取得中にエラーが発生しました",
        "署名付きURLの取得に失敗しました",
      );
    });

    test("should return null when fetch throws an exception", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await getSignedUploadUrl("image/jpeg");

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("署名付きURLの取得中にエラーが発生しました", "Network error");
    });

    test("should return null when fetch throws non-Error exception", async () => {
      mockFetch.mockRejectedValue("String error");

      const result = await getSignedUploadUrl("image/jpeg");

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("署名付きURLの取得中にエラーが発生しました", "String error");
    });
  });

  describe("isImageUploadEnabled (internal function)", () => {
    test("should return true when ENABLE_IMAGE_UPLOAD is 'true'", async () => {
      process.env.ENABLE_IMAGE_UPLOAD = "true";

      // getSignedUploadUrlを呼び出して内部のisImageUploadEnabled関数をテスト
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          signedUrl: "https://example.com/signed-url",
          publicUrl: "https://example.com/public-url",
          key: "test-key",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await getSignedUploadUrl("image/jpeg");

      expect(result).not.toBeNull();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test("should return false when ENABLE_IMAGE_UPLOAD is not 'true'", async () => {
      process.env.ENABLE_IMAGE_UPLOAD = "false";

      const result = await getSignedUploadUrl("image/jpeg");

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("画像アップロード機能が無効です");
    });

    test("should return false when ENABLE_IMAGE_UPLOAD is undefined", async () => {
      delete process.env.ENABLE_IMAGE_UPLOAD;

      const result = await getSignedUploadUrl("image/jpeg");

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("画像アップロード機能が無効です");
    });
  });
});
