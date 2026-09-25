import { cloudflare } from "@cloudflare/vite-plugin";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
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
    // 画面に含む依存パッケージのライセンスをJSONで出力し、OSSライセンス画面から読む。
    client: {
      build: {
        license: { fileName: "dependency-open-source-licenses.json" },
      },
    },
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
        // WorkerのエントリーポイントはTanStack Startの画面描画を含むため、結合テストはHonoアプリと公開プロフィールのエントリーポイントだけを起動する。
        // D1へはsetupFilesでmigrationを適用し、認証のSecretにはテスト用の値を渡す。
        plugins: [
          cloudflareTest(async () => ({
            main: "./test/worker-main.ts",
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations("./migrations"),
                BETTER_AUTH_SECRETS: "1:worker-test-secret-value-with-enough-entropy-0123456789",
                GOOGLE_CLIENT_ID: "worker-test-google",
                GOOGLE_CLIENT_SECRET: "worker-test-google",
                GITHUB_CLIENT_ID: "worker-test-github",
                GITHUB_CLIENT_SECRET: "worker-test-github",
                ORCID_CLIENT_ID: "worker-test-orcid",
                ORCID_CLIENT_SECRET: "worker-test-orcid",
              },
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["src/**/*.worker.test.ts", "test/**/*.worker.test.ts"],
          setupFiles: ["./test/apply-d1-migrations.ts"],
        },
      },
    ],
  },
}));
