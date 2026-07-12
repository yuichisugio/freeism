import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./worker/index.ts",
      miniflare: {
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
    }),
  ],
  test: {
    include: ["worker/**/*.worker.test.ts"],
  },
});
