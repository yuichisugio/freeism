import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      main: "./worker/index.ts",
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRETS:
            "2:test-current-secret-at-least-32-characters,1:test-previous-secret-at-least-32-characters",
          GITHUB_CLIENT_ID: "test-github-client-id",
          GITHUB_CLIENT_SECRET: "test-github-client-secret",
          GOOGLE_CLIENT_ID: "test-google-client-id",
          GOOGLE_CLIENT_SECRET: "test-google-client-secret",
          TEST_MIGRATIONS: await readD1Migrations("./drizzle"),
        },
        d1Databases: ["DB"],
        serviceBindings: {
          ASSETS: "test-assets",
        },
        workers: [
          {
            compatibilityDate: "2026-07-12",
            modules: true,
            name: "test-assets",
            script: `export default {
              fetch() {
                return new Response('<!doctype html><main data-points-shell>Points shell</main>', {
                  headers: {
                    'Cache-Control': 'no-store',
                    'Content-Type': 'text/html; charset=utf-8',
                  },
                });
              },
            };`,
          },
        ],
      },
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
    })),
  ],
  test: {
    include: ["worker/**/*.worker.test.ts", "test/worker/**/*.worker.test.ts"],
    setupFiles: ["./test/worker/apply-migrations.ts"],
  },
});
