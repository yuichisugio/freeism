import { cloudflare } from "@cloudflare/vite-plugin";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

/**
 * 開発・ビルド・lint・テストの設定。
 * 画面はTanStack StartのSPAとして事前生成し、Cloudflare Vite PluginでWorkerとassetsを接続する。
 * @see https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
 */
export default defineConfig(({ mode }) => ({
  // テストは各projectの設定で実行環境を用意するため、アプリのビルド用pluginを読み込まない。
  plugins:
    mode === "test"
      ? []
      : [
          cloudflare({ viteEnvironment: { name: "ssr" } }),
          tanstackStart({
            srcDirectory: "src/frontend",
            spa: {
              enabled: true,
              // assetsのSPA配信がindex.htmlを返すため、shellをindex.htmlへ出力する。
              prerender: { outputPath: "/index.html" },
            },
          }),
          react(),
          tailwindcss(),
        ],
  environments: {
    // Workerのコードを圧縮し、upload_source_mapsで送るソースマップを出力する。
    ssr: {
      build: {
        minify: true,
        sourcemap: true,
      },
    },
  },
  lint: {
    ignorePatterns: ["dist/**", "worker-configuration.d.ts", "src/frontend/routeTree.gen.ts"],
    plugins: ["typescript", "react", "vitest"],
    options: {
      typeAware: true,
    },
    rules: {
      "typescript/no-floating-promises": "error",
    },
  },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
          exclude: ["**/*.worker.test.ts"],
          environment: "node",
        },
      },
      {
        // WorkerのエントリーポイントはTanStack Startの画面描画を含むため、結合テストはHonoアプリを直接起動する。
        plugins: [
          cloudflareTest({
            main: "./src/backend/app.ts",
            wrangler: { configPath: "./wrangler.jsonc" },
          }),
        ],
        test: {
          name: "worker",
          include: ["src/**/*.worker.test.ts", "test/**/*.worker.test.ts"],
        },
      },
    ],
  },
}));
