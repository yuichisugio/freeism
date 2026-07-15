import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.MARKETS_E2E_BASE_URL ?? "http://127.0.0.1:3001";
const parsedBaseURL = new URL(baseURL);
const isLoopback = ["127.0.0.1", "localhost", "::1"].includes(parsedBaseURL.hostname);

if (!isLoopback) {
  throw new Error("MARKETS_E2E_BASE_URL must be loopback");
}
for (const name of ["MARKETS_E2E_FIXTURE_ORIGIN", "MARKETS_E2E_ISSUER_ORIGIN"]) {
  const value = process.env[name];
  if (value && !["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname)) {
    throw new Error(`${name} must be loopback`);
  }
}

export default defineConfig({
  testDir: "./test/e2e",
  outputDir: "./output/playwright/results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "./output/playwright/report" }]]
    : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer:
    isLoopback && process.env.MARKETS_E2E_REUSE_SERVER !== "true"
      ? {
          command: "pnpm dev --host 127.0.0.1 --port 3001",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: baseURL,
        }
      : undefined,
});
