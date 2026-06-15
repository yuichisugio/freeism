import { PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ImageMimeType } from "./upload-constants";
import { generateSignedUploadUrl } from "./upload-server";

// ホイストされたモック関数の宣言
const {
  mockEnv,
  mockLogger,
  mockR2Client,
  mockCreateR2Client,
  mockGetR2BucketName,
  mockGetR2PublicUrl,
  mockGetSignedUrl,
  mockUuidv4,
} = vi.hoisted(() => ({
  mockEnv: {
    ENABLE_IMAGE_UPLOAD: "true",
  },
  mockLogger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
  mockR2Client: {
    send: vi.fn(),
  },
  mockCreateR2Client: vi.fn(),
  mockGetR2BucketName: vi.fn(),
  mockGetR2PublicUrl: vi.fn(),
  mockGetSignedUrl: vi.fn(),
  mockUuidv4: vi.fn(),
}));

// envのモック
vi.mock("@/library-setting/env", () => ({
  env: mockEnv,
}));

// loggerのモック
vi.mock("./logger", () => ({
  logger: mockLogger,
}));

// r2-clientのモック
vi.mock("./r2-client", () => ({
  createR2Client: mockCreateR2Client,
  getR2BucketName: mockGetR2BucketName,
  getR2PublicUrl: mockGetR2PublicUrl,
}));

// AWS SDKのモック
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: vi.fn(),
}));

// uuidのモック
vi.mock("uuid", () => ({
  v4: mockUuidv4,
}));

describe("upload-server.ts", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトの戻り値を設定
    mockEnv.ENABLE_IMAGE_UPLOAD = "true";
    mockCreateR2Client.mockResolvedValue(mockR2Client);
    mockGetR2BucketName.mockResolvedValue("test-bucket");
    mockGetR2PublicUrl.mockResolvedValue("https://test.example.com");
    mockGetSignedUrl.mockResolvedValue("https://signed-url.example.com");
    mockUuidv4.mockReturnValue("test-uuid-1234");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSignedUploadUrl", () => {
    test("should generate signed URL successfully with valid JPEG file", async () => {
      const result = await generateSignedUploadUrl(ImageMimeType.JPEG);

      expect(result).toStrictEqual({
        signedUrl: "https://signed-url.example.com",
        publicUrl: "https://test.example.com/test-uuid-1234.jpg",
        key: "test-uuid-1234.jpg",
      });

      expect(mockCreateR2Client).toHaveBeenCalledTimes(1);
      expect(mockGetR2BucketName).toHaveBeenCalledTimes(1);
      expect(mockGetR2PublicUrl).toHaveBeenCalledTimes(1);
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "test-uuid-1234.jpg",
        ContentType: ImageMimeType.JPEG,
      });
      expect(mockGetSignedUrl).toHaveBeenCalledWith(mockR2Client, expect.any(Object), { expiresIn: 900 });
    });

    test("should generate signed URL successfully with custom filename", async () => {
      const customFileName = "custom-image.png";
      const result = await generateSignedUploadUrl(ImageMimeType.PNG, customFileName);

      expect(result).toStrictEqual({
        signedUrl: "https://signed-url.example.com",
        publicUrl: "https://test.example.com/custom-image.png",
        key: "custom-image.png",
      });

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "custom-image.png",
        ContentType: ImageMimeType.PNG,
      });
    });

    test("should return null when image upload is disabled", async () => {
      mockEnv.ENABLE_IMAGE_UPLOAD = "false";

      const result = await generateSignedUploadUrl(ImageMimeType.JPEG);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("画像アップロード機能が無効です");
      expect(mockCreateR2Client).not.toHaveBeenCalled();
    });

    test("should return null when R2 client is null", async () => {
      mockCreateR2Client.mockResolvedValue(null);

      const result = await generateSignedUploadUrl(ImageMimeType.JPEG);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "R2クライアントまたはバケット名が設定されていないため、署名付きURLを生成できません",
      );
    });

    test("should return null when bucket name is null", async () => {
      mockGetR2BucketName.mockResolvedValue(null);

      const result = await generateSignedUploadUrl(ImageMimeType.JPEG);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "R2クライアントまたはバケット名が設定されていないため、署名付きURLを生成できません",
      );
    });

    test("should return null when bucket name is empty string", async () => {
      mockGetR2BucketName.mockResolvedValue("");

      const result = await generateSignedUploadUrl(ImageMimeType.JPEG);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "R2クライアントまたはバケット名が設定されていないため、署名付きURLを生成できません",
      );
    });

    test("should return null for unsupported MIME type", async () => {
      const result = await generateSignedUploadUrl("image/bmp");

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("サポートされていないMIMEタイプです: image/bmp");
      expect(mockCreateR2Client).toHaveBeenCalled();
      expect(PutObjectCommand).not.toHaveBeenCalled();
    });

    test("should handle getSignedUrl error", async () => {
      const mockError = new Error("Failed to generate signed URL");
      mockGetSignedUrl.mockRejectedValue(mockError);

      const result = await generateSignedUploadUrl(ImageMimeType.JPEG);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith("署名付きURLの生成中にエラーが発生しました", mockError);
    });

    test("should work with all supported MIME types", async () => {
      const testCases = [
        { mimeType: ImageMimeType.JPEG, expectedExtension: "jpg" },
        { mimeType: ImageMimeType.JPG, expectedExtension: "jpg" },
        { mimeType: ImageMimeType.PNG, expectedExtension: "png" },
        { mimeType: ImageMimeType.WEBP, expectedExtension: "webp" },
        { mimeType: ImageMimeType.GIF, expectedExtension: "gif" },
        { mimeType: ImageMimeType.AVIF, expectedExtension: "avif" },
      ];

      for (const { mimeType, expectedExtension } of testCases) {
        vi.clearAllMocks();
        mockCreateR2Client.mockResolvedValue(mockR2Client);
        mockGetR2BucketName.mockResolvedValue("test-bucket");
        mockGetR2PublicUrl.mockResolvedValue("https://test.example.com");
        mockGetSignedUrl.mockResolvedValue("https://signed-url.example.com");
        mockUuidv4.mockReturnValue("test-uuid");

        const result = await generateSignedUploadUrl(mimeType);

        expect(result).toStrictEqual({
          signedUrl: "https://signed-url.example.com",
          publicUrl: `https://test.example.com/test-uuid.${expectedExtension}`,
          key: `test-uuid.${expectedExtension}`,
        });
      }
    });

    test("should handle null public URL", async () => {
      mockGetR2PublicUrl.mockResolvedValue(null);

      const result = await generateSignedUploadUrl(ImageMimeType.JPEG);

      expect(result).toStrictEqual({
        signedUrl: "https://signed-url.example.com",
        publicUrl: null,
        key: "test-uuid-1234.jpg",
      });
    });

    test("should handle empty string public URL", async () => {
      mockGetR2PublicUrl.mockResolvedValue("");

      const result = await generateSignedUploadUrl(ImageMimeType.JPEG);

      expect(result).toStrictEqual({
        signedUrl: "https://signed-url.example.com",
        publicUrl: null,
        key: "test-uuid-1234.jpg",
      });
    });

    test("should handle invalid MIME type formats", async () => {
      const invalidMimeTypes = [
        "",
        "text/plain",
        "application/pdf",
        "video/mp4",
        "audio/mp3",
        "image/",
        "image",
        null,
        undefined,
      ];

      for (const invalidMimeType of invalidMimeTypes) {
        vi.clearAllMocks();
        mockCreateR2Client.mockResolvedValue(mockR2Client);
        mockGetR2BucketName.mockResolvedValue("test-bucket");
        mockGetR2PublicUrl.mockResolvedValue("https://test.example.com");

        const result = await generateSignedUploadUrl(invalidMimeType!);

        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(`サポートされていないMIMEタイプです: ${invalidMimeType}`);
      }
    });

    test("should handle PutObjectCommand creation error", async () => {
      const mockError = new Error("PutObjectCommand creation failed");
      vi.mocked(PutObjectCommand).mockImplementationOnce(() => {
        throw mockError;
      });

      const result = await generateSignedUploadUrl(ImageMimeType.JPEG);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith("署名付きURLの生成中にエラーが発生しました", mockError);
    });

    test("should use correct expiration time (15 minutes)", async () => {
      await generateSignedUploadUrl(ImageMimeType.JPEG);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockR2Client,
        expect.any(Object),
        { expiresIn: 900 }, // 15分 = 900秒
      );
    });
  });
});
