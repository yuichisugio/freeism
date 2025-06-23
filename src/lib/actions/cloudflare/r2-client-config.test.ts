import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("r2-client-config", () => {
  // 元の環境変数を保存
  const originalEnv = process.env;

  beforeEach(() => {
    // 各テスト前にモックをクリア
    vi.clearAllMocks();

    // 環境変数をリセット
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // 各テスト後に環境変数を復元
    process.env = originalEnv;
  });

  describe("clientR2Config", () => {
    test("should have isEnabled property set to true when NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD is 'true'", async () => {
      // 環境変数を設定
      process.env.NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD = "true";

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { clientR2Config: freshConfig } = await import("./r2-client-config");

      expect(freshConfig.isEnabled).toBe(true);
    });

    test("should have isEnabled property set to false when NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD is 'false'", async () => {
      // 環境変数を設定
      process.env.NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD = "false";

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { clientR2Config: freshConfig } = await import("./r2-client-config");

      expect(freshConfig.isEnabled).toBe(false);
    });

    test("should have isEnabled property set to false when NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD is undefined", async () => {
      // 環境変数を削除
      delete process.env.NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD;

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { clientR2Config: freshConfig } = await import("./r2-client-config");

      expect(freshConfig.isEnabled).toBe(false);
    });

    test("should have isEnabled property set to false when NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD is empty string", async () => {
      // 環境変数を空文字に設定
      process.env.NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD = "";

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { clientR2Config: freshConfig } = await import("./r2-client-config");

      expect(freshConfig.isEnabled).toBe(false);
    });

    test("should have isEnabled property set to false when NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD is invalid value", async () => {
      // 環境変数を無効な値に設定
      process.env.NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD = "invalid";

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { clientR2Config: freshConfig } = await import("./r2-client-config");

      expect(freshConfig.isEnabled).toBe(false);
    });

    test("should have only isEnabled property", async () => {
      const { clientR2Config } = await import("./r2-client-config");
      const configKeys = Object.keys(clientR2Config);
      expect(configKeys).toHaveLength(1);
      expect(configKeys).toContain("isEnabled");
    });

    test("should have isEnabled property of boolean type", async () => {
      const { clientR2Config } = await import("./r2-client-config");
      expect(typeof clientR2Config.isEnabled).toBe("boolean");
    });
  });

  describe("isR2Enabled", () => {
    test("should return true when NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED is 'true'", async () => {
      // 環境変数を設定
      process.env.NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED = "true";

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { isR2Enabled: freshIsR2Enabled } = await import("./r2-client-config");

      const result = freshIsR2Enabled();
      expect(result).toBe(true);
    });

    test("should return false when NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED is 'false'", async () => {
      // 環境変数を設定
      process.env.NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED = "false";

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { isR2Enabled: freshIsR2Enabled } = await import("./r2-client-config");

      const result = freshIsR2Enabled();
      expect(result).toBe(false);
    });

    test("should return false when NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED is undefined", async () => {
      // 環境変数を削除
      delete process.env.NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED;

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { isR2Enabled: freshIsR2Enabled } = await import("./r2-client-config");

      const result = freshIsR2Enabled();
      expect(result).toBe(false);
    });

    test("should return false when NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED is empty string", async () => {
      // 環境変数を空文字に設定
      process.env.NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED = "";

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { isR2Enabled: freshIsR2Enabled } = await import("./r2-client-config");

      const result = freshIsR2Enabled();
      expect(result).toBe(false);
    });

    test("should return false when NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED is invalid value", async () => {
      // 環境変数を無効な値に設定
      process.env.NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED = "invalid";

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { isR2Enabled: freshIsR2Enabled } = await import("./r2-client-config");

      const result = freshIsR2Enabled();
      expect(result).toBe(false);
    });

    test("should return false when NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED is '1'", async () => {
      // 環境変数を数値文字列に設定
      process.env.NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED = "1";

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { isR2Enabled: freshIsR2Enabled } = await import("./r2-client-config");

      const result = freshIsR2Enabled();
      expect(result).toBe(false);
    });

    test("should return false when NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED is 'TRUE' (uppercase)", async () => {
      // 環境変数を大文字に設定
      process.env.NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED = "TRUE";

      // モジュールを再インポートして環境変数の変更を反映
      vi.resetModules();
      const { isR2Enabled: freshIsR2Enabled } = await import("./r2-client-config");

      const result = freshIsR2Enabled();
      expect(result).toBe(false);
    });

    test("should be a function", async () => {
      const { isR2Enabled } = await import("./r2-client-config");
      expect(typeof isR2Enabled).toBe("function");
    });

    test("should return boolean value", async () => {
      const { isR2Enabled } = await import("./r2-client-config");
      const result = isR2Enabled();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("module exports", () => {
    test("should export clientR2Config and isR2Enabled", async () => {
      const moduleExports = await import("./r2-client-config");

      expect(moduleExports).toHaveProperty("clientR2Config");
      expect(moduleExports).toHaveProperty("isR2Enabled");
      expect(typeof moduleExports.clientR2Config).toBe("object");
      expect(typeof moduleExports.isR2Enabled).toBe("function");
    });

    test("should only export clientR2Config and isR2Enabled", async () => {
      const moduleExports = await import("./r2-client-config");
      const exportKeys = Object.keys(moduleExports);

      expect(exportKeys).toHaveLength(2);
      expect(exportKeys).toContain("clientR2Config");
      expect(exportKeys).toContain("isR2Enabled");
    });
  });
});
