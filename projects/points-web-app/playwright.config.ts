import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { defineConfig } from "@playwright/test";

export default defineConfig({
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? resolve(tmpdir(), "points-playwright-results"),
  testDir: "./test/e2e",
  use: {
    baseURL: process.env.POINTS_E2E_BASE_URL,
    trace: "retain-on-failure",
  },
});
