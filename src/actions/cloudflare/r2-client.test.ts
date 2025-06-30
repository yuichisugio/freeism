import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ホイストされたモック関数の宣言
const { mockEnv, mockLogger } = vi.hoisted(() => ({
  mockEnv: {
    ENABLE_IMAGE_UPLOAD: "true",
    CLOUDFLARE_R2_ACCESS_KEY_ID: "test-access-key",
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: "test-secret-key",
    CLOUDFLARE_ACCOUNT_ID: "test-account-id",
    CLOUDFLARE_R2_BUCKET: "test-bucket",
    CLOUDFLARE_PUBLIC_URL: "https://test.example.com",
    CLOUDFLARE_ACCESS_KEY_ID: "test-access-key",
    CLOUDFLARE_SECRET_ACCESS_KEY: "test-secret-key",
  },
  mockLogger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// envのモック
vi.mock("@/library-setting/env", () => ({
  env: mockEnv,
}));

// loggerのモック
vi.mock("./logger", () => ({
  logger: mockLogger,
}));

// S3Clientのモック
const mockS3ClientInstance = { send: vi.fn() };
const MockS3Client = vi.fn().mockImplementation(() => mockS3ClientInstance);

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: MockS3Client,
}));

describe("r2-client.ts", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createR2Service", () => {
    test("should return disabled service when ENABLE_IMAGE_UPLOAD is not 'true'", async () => {
      // 一時的に環境変数を変更
      const originalValue = mockEnv.ENABLE_IMAGE_UPLOAD;
      mockEnv.ENABLE_IMAGE_UPLOAD = "false";

      // 動的インポートでcreateR2Serviceを取得
      const { createR2Service } = await import("./r2-client");
      const service = await createR2Service();

      expect(service.isEnabled).toBe(false);
      expect(service.createClient()).toBeNull();
      expect(service.getBucketName()).toBeNull();
      expect(service.getPublicUrl()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("画像アップロード機能が無効なため、R2クライアントは作成されません");
      expect(mockLogger.warn).toHaveBeenCalledWith("画像アップロード機能が無効なため、バケット名は取得できません");
      expect(mockLogger.warn).toHaveBeenCalledWith("画像アップロード機能が無効なため、パブリックURLは取得できません");

      // 環境変数を元に戻す
      mockEnv.ENABLE_IMAGE_UPLOAD = originalValue;
    });

    test("should return enabled service with valid configuration", async () => {
      const { createR2Service } = await import("./r2-client");
      const service = await createR2Service();

      expect(service.isEnabled).toBe(true);
      expect(service.getBucketName()).toBe("test-bucket");
      expect(service.getPublicUrl()).toBe("https://test.example.com");

      const client = service.createClient();
      expect(client).toBe(mockS3ClientInstance);
      expect(MockS3Client).toHaveBeenCalledWith({
        region: "auto",
        endpoint: "https://test-account-id.r2.cloudflarestorage.com",
        credentials: {
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
        },
      });
    });

    test("should log error when credentials are not configured", async () => {
      // 一時的に環境変数を変更
      const originalAccessKey = mockEnv.CLOUDFLARE_R2_ACCESS_KEY_ID;
      const originalSecretKey = mockEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
      const originalAccountId = mockEnv.CLOUDFLARE_ACCOUNT_ID;

      mockEnv.CLOUDFLARE_R2_ACCESS_KEY_ID = "";
      mockEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "";
      mockEnv.CLOUDFLARE_ACCOUNT_ID = "";

      const { createR2Service } = await import("./r2-client");
      const service = await createR2Service();

      expect(service.isEnabled).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith("R2の認証情報が設定されていません");

      const client = service.createClient();
      expect(client).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith("R2の認証情報が不足しているため、R2クライアントを作成できません");

      // 環境変数を元に戻す
      mockEnv.CLOUDFLARE_R2_ACCESS_KEY_ID = originalAccessKey;
      mockEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY = originalSecretKey;
      mockEnv.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
    });

    test("should log error when bucket name is not configured", async () => {
      // 一時的に環境変数を変更
      const originalBucket = mockEnv.CLOUDFLARE_R2_BUCKET;
      mockEnv.CLOUDFLARE_R2_BUCKET = "";

      const { createR2Service } = await import("./r2-client");
      const service = await createR2Service();

      expect(service.isEnabled).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith("R2バケット名が設定されていません");
      expect(service.getBucketName()).toBe("");

      // 環境変数を元に戻す
      mockEnv.CLOUDFLARE_R2_BUCKET = originalBucket;
    });

    test("should handle S3Client creation error", async () => {
      const mockS3ClientError = new Error("S3Client creation failed");
      MockS3Client.mockImplementationOnce(() => {
        throw mockS3ClientError;
      });

      const { createR2Service } = await import("./r2-client");
      const service = await createR2Service();
      const client = service.createClient();

      expect(client).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith("R2クライアントの作成中にエラーが発生しました", mockS3ClientError);
    });

    test("should return empty string for bucket name when not set", async () => {
      // 一時的に環境変数を変更
      const originalBucket = mockEnv.CLOUDFLARE_R2_BUCKET;
      mockEnv.CLOUDFLARE_R2_BUCKET = "";

      const { createR2Service } = await import("./r2-client");
      const service = await createR2Service();

      expect(service.getBucketName()).toBe("");

      // 環境変数を元に戻す
      mockEnv.CLOUDFLARE_R2_BUCKET = originalBucket;
    });

    test("should return empty string for public URL when not set", async () => {
      // 一時的に環境変数を変更
      const originalUrl = mockEnv.CLOUDFLARE_PUBLIC_URL;
      mockEnv.CLOUDFLARE_PUBLIC_URL = "";

      const { createR2Service } = await import("./r2-client");
      const service = await createR2Service();

      expect(service.getPublicUrl()).toBe("");

      // 環境変数を元に戻す
      mockEnv.CLOUDFLARE_PUBLIC_URL = originalUrl;
    });

    test("should handle partial credentials configuration", async () => {
      // 一時的に環境変数を変更
      const originalAccessKey = mockEnv.CLOUDFLARE_R2_ACCESS_KEY_ID;
      const originalSecretKey = mockEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
      const originalAccountId = mockEnv.CLOUDFLARE_ACCOUNT_ID;

      mockEnv.CLOUDFLARE_R2_ACCESS_KEY_ID = "test-key";
      mockEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "";
      mockEnv.CLOUDFLARE_ACCOUNT_ID = "test-account";

      const { createR2Service } = await import("./r2-client");
      const service = await createR2Service();
      const client = service.createClient();

      expect(client).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith("R2の認証情報が設定されていません");
      expect(mockLogger.error).toHaveBeenCalledWith("R2の認証情報が不足しているため、R2クライアントを作成できません");

      // 環境変数を元に戻す
      mockEnv.CLOUDFLARE_R2_ACCESS_KEY_ID = originalAccessKey;
      mockEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY = originalSecretKey;
      mockEnv.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
    });

    test("should handle undefined bucket name", async () => {
      // 一時的に環境変数を変更
      const originalBucket = mockEnv.CLOUDFLARE_R2_BUCKET;
      mockEnv.CLOUDFLARE_R2_BUCKET = undefined as unknown as string;

      const { createR2Service } = await import("./r2-client");
      const service = await createR2Service();

      expect(service.getBucketName()).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith("R2バケット名が設定されていません");

      // 環境変数を元に戻す
      mockEnv.CLOUDFLARE_R2_BUCKET = originalBucket;
    });

    test("should handle undefined public URL", async () => {
      // 一時的に環境変数を変更
      const originalUrl = mockEnv.CLOUDFLARE_PUBLIC_URL;
      mockEnv.CLOUDFLARE_PUBLIC_URL = undefined as unknown as string;

      const { createR2Service } = await import("./r2-client");
      const service = await createR2Service();

      expect(service.getPublicUrl()).toBeNull();

      // 環境変数を元に戻す
      mockEnv.CLOUDFLARE_PUBLIC_URL = originalUrl;
    });
  });

  describe("exported functions (using module-level service)", () => {
    test("should work with default configuration", async () => {
      // 環境変数をデフォルト値に確実に設定
      mockEnv.ENABLE_IMAGE_UPLOAD = "true";
      mockEnv.CLOUDFLARE_R2_ACCESS_KEY_ID = "test-access-key";
      mockEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "test-secret-key";
      mockEnv.CLOUDFLARE_ACCOUNT_ID = "test-account-id";
      mockEnv.CLOUDFLARE_R2_BUCKET = "test-bucket";
      mockEnv.CLOUDFLARE_PUBLIC_URL = "https://test.example.com";
      mockEnv.CLOUDFLARE_ACCESS_KEY_ID = "test-access-key";
      mockEnv.CLOUDFLARE_SECRET_ACCESS_KEY = "test-secret-key";

      // モジュールを再インポートして新しいサービスを作成
      vi.resetModules();
      const { createR2Client, getR2BucketName, getR2PublicUrl } = await import("./r2-client");

      const client = await createR2Client();
      const bucketName = await getR2BucketName();
      const publicUrl = await getR2PublicUrl();

      expect(client).toBe(mockS3ClientInstance);
      expect(bucketName).toBe("test-bucket");
      expect(publicUrl).toBe("https://test.example.com");
    });
  });
});
