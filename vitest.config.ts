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
    setupFiles: [
      "./src/test/setup/setup.ts",
      "./src/test/setup/prisma-orm-setup.ts",
      "./src/test/setup/auth-js-setup.ts",
      "./src/test/setup/tanstack-query-setup.tsx",
    ],

    // グローバル設定
    globals: true,

    // ファイル並列実行の設定
    fileParallelism: true,

    // コンソール出力を抑制
    silent: true,

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
        "**/*.test.*",
        "**/*.spec.*",
        "**/.prettierrc.mjs",
        "public/**/*",
        "workbox-8817a5e5.js",
        "src/lib/zod-schema.ts",
        "src/lib/auth-js.ts",
        "src/lib/prisma.ts",
        "src/lib/redis.ts",
        "src/lib/tanstack-query.ts",
        "src/lib/constants.ts",
        "src/types/**/*",
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
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}", "scripts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],

    // 除外するファイル
    exclude: ["node_modules", "dist", ".next", "coverage", "prisma"],

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
