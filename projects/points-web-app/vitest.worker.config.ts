import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      main: "./worker/index.ts",
      miniflare: {
        bindings: {
          CSV_EXPORT_CURSOR_SECRET: "test-csv-export-cursor-secret-at-least-32-characters",
          BETTER_AUTH_SECRETS:
            "2:test-current-secret-at-least-32-characters,1:test-previous-secret-at-least-32-characters",
          GITHUB_CLIENT_ID: "test-github-client-id",
          GITHUB_CLIENT_SECRET: "test-github-client-secret",
          GOOGLE_CLIENT_ID: "test-google-client-id",
          GOOGLE_CLIENT_SECRET: "test-google-client-secret",
          INITIAL_ADMIN_GOOGLE_ACCOUNT_ID: "test-initial-admin-google-account-id",
          MARKETS_SETTLEMENT_RETRY_RESOURCE: "https://markets.example.test/api/settlements/retry",
          POINTS_OAUTH_PAIRWISE_SECRET: "test-pairwise-secret-at-least-32-characters",
          MARKETS_USER_OAUTH_CLIENT_ID: "markets-user-client",
          MARKETS_USER_OAUTH_CLIENT_SECRET: "test-markets-user-secret-at-least-32-chars",
          MARKETS_M2M_OAUTH_CLIENT_ID: "markets-m2m-client",
          MARKETS_M2M_OAUTH_CLIENT_SECRET: "test-markets-m2m-secret-at-least-32-chars",
          MARKETS_SETTLEMENT_OAUTH_CLIENT_ID: "markets-settlement-client",
          MARKETS_SETTLEMENT_OAUTH_CLIENT_SECRET:
            "test-markets-settlement-secret-at-least-32-chars",
          OPS_RESOURCE_HASH_SALT: "test-points-ops-salt",
          TURNSTILE_SITE_KEY: "test-turnstile-site-key",
          TURNSTILE_SECRET_KEY: "test-turnstile-secret-key",
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
