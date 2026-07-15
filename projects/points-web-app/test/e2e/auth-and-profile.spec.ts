import { expect, test } from "@playwright/test";

const baseURL = process.env.POINTS_E2E_BASE_URL;

test.describe("Points authentication and public profile fixture", () => {
  test.skip(!baseURL, "POINTS_E2E_BASE_URL is required for browser E2E");

  test("login exposes the same Google and GitHub provider set", async ({ page }) => {
    await page.goto(new URL("/login", baseURL).href);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Googleで続ける" })).toBeVisible();
    await expect(page.getByRole("button", { name: "GitHubで続ける" })).toBeVisible();
  });

  test("public search returns a cache-safe response without a session", async ({ request }) => {
    const response = await request.get(new URL("/api/v1/search?q=freeism", baseURL).href);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("must-revalidate");
    expect((await response.json()).data).toBeDefined();
  });
});
