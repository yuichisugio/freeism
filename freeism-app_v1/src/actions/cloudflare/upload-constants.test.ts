import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { isR2Enabled } from "./r2-client-config";
import {
  ACCEPTED_IMAGE_TYPES,
  ImageExtension,
  ImageMimeType,
  isImageUploadEnabled,
  logger,
  MAX_FILE_SIZE,
} from "./upload-constants";

// isR2Enabledのモック
vi.mock("./r2-client-config", () => ({
  isR2Enabled: vi.fn(),
}));

const mockIsR2Enabled = vi.mocked(isR2Enabled);

// コンソールメソッドのモック
const mockConsoleWarn = vi.fn();
const mockConsoleError = vi.fn();
const mockConsoleInfo = vi.fn();

describe("upload-constants", () => {
  beforeEach(() => {
    // 各テスト前にモックをクリア
    vi.clearAllMocks();

    // コンソールメソッドをモック化
    vi.spyOn(console, "warn").mockImplementation(mockConsoleWarn);
    vi.spyOn(console, "error").mockImplementation(mockConsoleError);
    vi.spyOn(console, "info").mockImplementation(mockConsoleInfo);
  });

  afterEach(() => {
    // 各テスト後にモックを復元
    vi.restoreAllMocks();
  });

  describe("ImageMimeType enum", () => {
    test("should have correct JPEG mime type", () => {
      expect(ImageMimeType.JPEG).toBe("image/jpeg");
    });

    test("should have correct JPG mime type", () => {
      expect(ImageMimeType.JPG).toBe("image/jpg");
    });

    test("should have correct PNG mime type", () => {
      expect(ImageMimeType.PNG).toBe("image/png");
    });

    test("should have correct GIF mime type", () => {
      expect(ImageMimeType.GIF).toBe("image/gif");
    });

    test("should have correct WEBP mime type", () => {
      expect(ImageMimeType.WEBP).toBe("image/webp");
    });

    test("should have correct AVIF mime type", () => {
      expect(ImageMimeType.AVIF).toBe("image/avif");
    });

    test("should have exactly 6 mime types", () => {
      const mimeTypes = Object.values(ImageMimeType);
      expect(mimeTypes).toHaveLength(6);
    });

    test("should have all mime types starting with 'image/'", () => {
      const mimeTypes = Object.values(ImageMimeType);
      mimeTypes.forEach((mimeType) => {
        expect(mimeType).toMatch(/^image\//);
      });
    });
  });

  describe("ImageExtension enum", () => {
    test("should have correct JPG extension", () => {
      expect(ImageExtension.JPG).toBe("jpg");
    });

    test("should have correct PNG extension", () => {
      expect(ImageExtension.PNG).toBe("png");
    });

    test("should have correct WEBP extension", () => {
      expect(ImageExtension.WEBP).toBe("webp");
    });

    test("should have correct GIF extension", () => {
      expect(ImageExtension.GIF).toBe("gif");
    });

    test("should have correct AVIF extension", () => {
      expect(ImageExtension.AVIF).toBe("avif");
    });

    test("should have exactly 5 extensions", () => {
      const extensions = Object.values(ImageExtension);
      expect(extensions).toHaveLength(5);
    });

    test("should have all extensions without dots", () => {
      const extensions = Object.values(ImageExtension);
      extensions.forEach((extension) => {
        expect(extension).not.toMatch(/^\./);
      });
    });
  });

  describe("logger", () => {
    test("should have warn method", () => {
      expect(typeof logger.warn).toBe("function");
    });

    test("should have error method", () => {
      expect(typeof logger.error).toBe("function");
    });

    test("should have info method", () => {
      expect(typeof logger.info).toBe("function");
    });

    test("should call console.warn with R2 Service prefix", () => {
      const message = "テスト警告";
      const args = ["arg1", "arg2"];

      logger.warn(message, ...args);

      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleWarn).toHaveBeenCalledWith("[R2 Service] テスト警告", "arg1", "arg2");
    });

    test("should call console.error with R2 Service prefix", () => {
      const message = "テストエラー";
      const args = ["arg1", "arg2"];

      logger.error(message, ...args);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith("[R2 Service] テストエラー", "arg1", "arg2");
    });

    test("should call console.info with R2 Service prefix", () => {
      const message = "テスト情報";
      const args = ["arg1", "arg2"];

      logger.info(message, ...args);

      expect(mockConsoleInfo).toHaveBeenCalledTimes(1);
      expect(mockConsoleInfo).toHaveBeenCalledWith("[R2 Service] テスト情報", "arg1", "arg2");
    });

    test("should handle empty message", () => {
      logger.warn("");

      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleWarn).toHaveBeenCalledWith("[R2 Service] ");
    });

    test("should handle no additional arguments", () => {
      logger.error("エラーメッセージ");

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith("[R2 Service] エラーメッセージ");
    });

    test("should handle multiple arguments", () => {
      const error = new Error("テストエラー");
      const context = { userId: "123", action: "upload" };

      logger.error("複数引数テスト", error, context);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith("[R2 Service] 複数引数テスト", error, context);
    });
  });

  describe("isImageUploadEnabled", () => {
    test("should return true when isR2Enabled returns true", () => {
      mockIsR2Enabled.mockReturnValue(true);

      const result = isImageUploadEnabled();

      expect(result).toBe(true);
      expect(mockIsR2Enabled).toHaveBeenCalledTimes(1);
    });

    test("should return false when isR2Enabled returns false", () => {
      mockIsR2Enabled.mockReturnValue(false);

      const result = isImageUploadEnabled();

      expect(result).toBe(false);
      expect(mockIsR2Enabled).toHaveBeenCalledTimes(1);
    });

    test("should be a function", () => {
      expect(typeof isImageUploadEnabled).toBe("function");
    });

    test("should return boolean value", () => {
      mockIsR2Enabled.mockReturnValue(true);

      const result = isImageUploadEnabled();

      expect(typeof result).toBe("boolean");
    });

    test("should call isR2Enabled exactly once per call", () => {
      mockIsR2Enabled.mockReturnValue(true);

      isImageUploadEnabled();
      isImageUploadEnabled();

      expect(mockIsR2Enabled).toHaveBeenCalledTimes(2);
    });
  });

  describe("ACCEPTED_IMAGE_TYPES", () => {
    test("should have image/jpeg as true", () => {
      expect(ACCEPTED_IMAGE_TYPES["image/jpeg"]).toBe(true);
    });

    test("should have image/jpg as true", () => {
      expect(ACCEPTED_IMAGE_TYPES["image/jpg"]).toBe(true);
    });

    test("should have image/png as true", () => {
      expect(ACCEPTED_IMAGE_TYPES["image/png"]).toBe(true);
    });

    test("should have image/gif as true", () => {
      expect(ACCEPTED_IMAGE_TYPES["image/gif"]).toBe(true);
    });

    test("should have image/webp as true", () => {
      expect(ACCEPTED_IMAGE_TYPES["image/webp"]).toBe(true);
    });

    test("should have image/avif as true", () => {
      expect(ACCEPTED_IMAGE_TYPES["image/avif"]).toBe(true);
    });

    test("should have exactly 6 accepted types", () => {
      const acceptedTypes = Object.keys(ACCEPTED_IMAGE_TYPES);
      expect(acceptedTypes).toHaveLength(6);
    });

    test("should have all values as true", () => {
      const values = Object.values(ACCEPTED_IMAGE_TYPES);
      values.forEach((value) => {
        expect(value).toBe(true);
      });
    });

    test("should not have unsupported mime types", () => {
      // 型安全にアクセスするため、anyにキャスト
      const acceptedTypesAny = ACCEPTED_IMAGE_TYPES as Record<string, boolean | undefined>;

      expect(acceptedTypesAny["image/bmp"]).toBeUndefined();
      expect(acceptedTypesAny["image/tiff"]).toBeUndefined();
      expect(acceptedTypesAny["image/svg+xml"]).toBeUndefined();
      expect(acceptedTypesAny["text/plain"]).toBeUndefined();
      expect(acceptedTypesAny["application/pdf"]).toBeUndefined();
    });

    test("should be an object", () => {
      expect(typeof ACCEPTED_IMAGE_TYPES).toBe("object");
      expect(ACCEPTED_IMAGE_TYPES).not.toBeNull();
      expect(Array.isArray(ACCEPTED_IMAGE_TYPES)).toBe(false);
    });
  });

  describe("MAX_FILE_SIZE", () => {
    test("should be 10MB in bytes", () => {
      const expectedSize = 10 * 1024 * 1024; // 10MB
      expect(MAX_FILE_SIZE).toBe(expectedSize);
    });

    test("should be a number", () => {
      expect(typeof MAX_FILE_SIZE).toBe("number");
    });

    test("should be positive", () => {
      expect(MAX_FILE_SIZE).toBeGreaterThan(0);
    });

    test("should be exactly 10485760 bytes", () => {
      expect(MAX_FILE_SIZE).toBe(10485760);
    });

    test("should be greater than 1MB", () => {
      const oneMB = 1024 * 1024;
      expect(MAX_FILE_SIZE).toBeGreaterThan(oneMB);
    });

    test("should be less than 100MB", () => {
      const hundredMB = 100 * 1024 * 1024;
      expect(MAX_FILE_SIZE).toBeLessThan(hundredMB);
    });
  });

  describe("module exports", () => {
    test("should export all required items", async () => {
      const moduleExports = await import("./upload-constants");

      expect(moduleExports).toHaveProperty("ImageMimeType");
      expect(moduleExports).toHaveProperty("ImageExtension");
      expect(moduleExports).toHaveProperty("logger");
      expect(moduleExports).toHaveProperty("isImageUploadEnabled");
      expect(moduleExports).toHaveProperty("ACCEPTED_IMAGE_TYPES");
      expect(moduleExports).toHaveProperty("MAX_FILE_SIZE");
    });

    test("should have correct export types", async () => {
      const moduleExports = await import("./upload-constants");

      expect(typeof moduleExports.ImageMimeType).toBe("object");
      expect(typeof moduleExports.ImageExtension).toBe("object");
      expect(typeof moduleExports.logger).toBe("object");
      expect(typeof moduleExports.isImageUploadEnabled).toBe("function");
      expect(typeof moduleExports.ACCEPTED_IMAGE_TYPES).toBe("object");
      expect(typeof moduleExports.MAX_FILE_SIZE).toBe("number");
    });
  });

  describe("enum consistency", () => {
    test("should have consistent JPEG/JPG handling", () => {
      // JPEG と JPG の両方が存在することを確認
      expect(ImageMimeType.JPEG).toBe("image/jpeg");
      expect(ImageMimeType.JPG).toBe("image/jpg");

      // ACCEPTED_IMAGE_TYPES にも両方が存在することを確認
      expect(ACCEPTED_IMAGE_TYPES["image/jpeg"]).toBe(true);
      expect(ACCEPTED_IMAGE_TYPES["image/jpg"]).toBe(true);
    });

    test("should have matching mime types and extensions", () => {
      // PNG
      expect(ImageMimeType.PNG).toBe("image/png");
      expect(ImageExtension.PNG).toBe("png");
      expect(ACCEPTED_IMAGE_TYPES["image/png"]).toBe(true);

      // WEBP
      expect(ImageMimeType.WEBP).toBe("image/webp");
      expect(ImageExtension.WEBP).toBe("webp");
      expect(ACCEPTED_IMAGE_TYPES["image/webp"]).toBe(true);

      // GIF
      expect(ImageMimeType.GIF).toBe("image/gif");
      expect(ImageExtension.GIF).toBe("gif");
      expect(ACCEPTED_IMAGE_TYPES["image/gif"]).toBe(true);

      // AVIF
      expect(ImageMimeType.AVIF).toBe("image/avif");
      expect(ImageExtension.AVIF).toBe("avif");
      expect(ACCEPTED_IMAGE_TYPES["image/avif"]).toBe(true);
    });
  });
});
