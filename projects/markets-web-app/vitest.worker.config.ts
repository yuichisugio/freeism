import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite-plus";

import { fixedPagesPlugin } from "./build/fixed-pages-plugin";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      main: "./src/server.ts",
      miniflare: {
        bindings: {
          APP_ORIGIN: "https://markets.example.test",
          BETTER_AUTH_SECRETS:
            "2:test-current-secret-at-least-32-characters,1:test-old-secret-at-least-32-characters",
          GOOGLE_CLIENT_ID: "test-google-client-id",
          GOOGLE_CLIENT_SECRET: "test-google-client-secret",
          OPS_ALERT_FROM: "alerts@example.test",
          OPS_ALERT_TO: "ops@example.test",
          OPS_RESOURCE_HASH_SALT: "test-markets-ops-resource-hash-salt",
          POINTS_AUDIENCE: "https://points.example.test/api/v1",
          POINTS_ISSUER: "https://points.example.test/api/auth",
          TEST_MIGRATIONS: await readD1Migrations("./drizzle"),
        },
        d1Databases: ["DB"],
        serviceBindings: {
          ASSETS: "test-assets",
          POINTS_SERVICE: "test-points-service",
        },
        workers: [
          {
            compatibilityDate: "2026-07-12",
            modules: true,
            name: "test-assets",
            script: `export default {
              fetch() {
                return new Response('<!doctype html><main data-markets-shell>Markets shell</main>', {
                  headers: {
                    'Cache-Control': 'no-store',
                    'Content-Type': 'text/html; charset=utf-8',
                  },
                });
              },
            };`,
          },
          {
            compatibilityDate: "2026-07-12",
            modules: true,
            name: "test-points-service",
            script: `export default {
              fetch() {
                return new Response('Points test service has no configured route', { status: 503 });
              },
            };`,
          },
        ],
      },
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
    })),
    fixedPagesPlugin(),
    tanstackStart({
      router: {
        routeFileIgnorePattern: "\\.test\\.",
      },
      server: {
        entry: "./src/server.ts",
      },
    }),
  ],
  test: {
    include: ["worker/**/*.worker.test.ts", "test/worker/**/*.worker.test.ts"],
    setupFiles: ["./test/worker/apply-migrations.ts"],
  },
});
