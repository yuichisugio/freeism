import { expect, test, type APIRequestContext } from "@playwright/test";

function fixtureOrigin(): string {
  const value = process.env.MARKETS_E2E_FIXTURE_ORIGIN;
  if (!value) throw new Error("MARKETS_E2E_FIXTURE_ORIGIN is required for deterministic OAuth E2E");
  const url = new URL(value);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("MARKETS_E2E_FIXTURE_ORIGIN must be loopback");
  }
  return url.origin;
}

async function controlFixture(
  request: APIRequestContext,
  path: string,
  body: Record<string, unknown> = {},
) {
  const response = await request.post(new URL(path, fixtureOrigin()).toString(), { data: body });
  expect(response.ok(), `${path}: fixture control failed`).toBe(true);
  return response.json() as Promise<Record<string, string>>;
}

test("Google loginからAuctionをsettled proofまで完了する", async ({ page, request }) => {
  await controlFixture(request, "/scenarios/auction-to-proof/reset");

  await page.goto("/login");
  await page.getByRole("button", { name: "Googleでログイン" }).click();
  await expect(page).toHaveURL(/\/auctions(?:[/?#]|$)/);

  await page.goto("/settings/points-connection");
  await page.getByRole("button", { name: /Points.*連携/ }).click();
  await expect(page.getByText(/連携済み|ACTIVE/)).toBeVisible();

  await page.goto("/auctions/import");
  await page.getByLabel("CSVファイル").setInputFiles({
    buffer: Buffer.from(
      "auctionId,title,description,quantity,startsAt,endsAt\nauction_e2e,E2E Auction,fixture,1,2026-07-14T00:00:00Z,2026-07-14T00:05:00Z\n",
    ),
    mimeType: "text/csv",
    name: "auction-e2e.csv",
  });
  await page.getByRole("button", { name: /プレビュー/ }).click();
  await page.getByRole("button", { name: /作成|確定/ }).click();

  const scenario = await controlFixture(request, "/scenarios/auction-to-proof/advance");
  await page.goto(scenario.auctionPath ?? "/auctions/auction_e2e");
  await page.getByLabel(/数量/).fill("1");
  await page.getByLabel(/入札.*価格|価格/).fill("10");
  await page.getByRole("button", { name: "入札" }).click();
  await controlFixture(request, "/scenarios/auction-to-proof/settle");

  await expect(page.getByText(/SETTLED|取引完了/)).toBeVisible();
  await page.getByRole("link", { name: /取引証明|proof/i }).click();
  await expect(page.getByRole("heading", { name: /取引証明|proof/i })).toBeVisible();
});

test("WebSocket gap中は入札を停止しsnapshot resync後だけ再開する", async ({ page, request }) => {
  const scenario = await controlFixture(request, "/scenarios/websocket-gap/reset");
  await page.goto(scenario.auctionPath ?? "/auctions/auction_gap_e2e");
  const bidButton = page.getByRole("button", { name: "入札" });
  await expect(bidButton).toBeEnabled();

  await controlFixture(request, "/scenarios/websocket-gap/emit-gap");
  await expect(page.getByText(/再同期|resync/i)).toBeVisible();
  await expect(bidButton).toBeDisabled();

  await controlFixture(request, "/scenarios/websocket-gap/release-snapshot");
  await expect(page.getByText(/再同期|resync/i)).toBeHidden();
  await expect(bidButton).toBeEnabled();

  const missingAsset = await page.request.get("/assets/__markets_e2e_missing__.js", {
    headers: { accept: "application/javascript" },
  });
  expect(missingAsset.status()).toBe(404);
  expect(missingAsset.headers()["content-type"] ?? "").not.toContain("text/html");
  const legacyListing = await page.request.get("/api/v1/listings", {
    headers: { accept: "application/json" },
  });
  expect(legacyListing.status()).toBe(404);
});
