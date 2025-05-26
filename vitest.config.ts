/// <reference types="vitest" />
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],

  // Vitestの設定
  test: {
    // テスト環境の設定
    environment: "happy-dom",

    // セットアップファイルの指定
    setupFiles: ["./src/test/setup/setup.ts"],

    // グローバル設定
    globals: true,

    // ファイル並列実行の設定
    fileParallelism: true,

    // Next.jsとの互換性のための設定
    server: {
      deps: {
        inline: ["next-auth"],
      },
    },

    // カバレッジ設定
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/coverage/**",
        "**/dist/**",
        "**/.next/**",
        "**/prisma/**",
        "**/scripts/**",
        "**/*.test.*",
        "**/*.spec.*",
      ],
      // カバレッジ目標値（test.mdの要件に基づく）
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 60,
        statements: 80,
      },
    },

    // テストファイルのパターン
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],

    // 除外するファイル
    exclude: ["node_modules", "dist", ".next", "coverage", "prisma", "scripts"],

    // タイムアウト設定
    testTimeout: 10000,
    hookTimeout: 10000,
  },

  // パスエイリアスの設定
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "~": resolve(__dirname, "./"),
    },
  },
});
