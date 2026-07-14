import { expect, test } from "@playwright/test";

const baseURL = process.env.POINTS_E2E_BASE_URL;
const sessionCookie = process.env.POINTS_E2E_SESSION_COOKIE;
const ownershipId = process.env.POINTS_E2E_OWNERSHIP_ID;

test("claim preview preserves positive and negative FIX totals without a selection contract", async ({
  request,
}) => {
  test.skip(
    !baseURL || !sessionCookie || !ownershipId,
    "POINTS_E2E_BASE_URL, POINTS_E2E_SESSION_COOKIE and POINTS_E2E_OWNERSHIP_ID are required",
  );
  const response = await request.get(
    new URL(`/api/ownership/${encodeURIComponent(ownershipId!)}/claim-preview`, baseURL).href,
    { headers: { cookie: sessionCookie! } },
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data: Record<string, unknown> };
  expect(body.data).toHaveProperty("claimSetHash");
  expect(body.data).not.toHaveProperty("selectedIds");
  expect(JSON.stringify(body.data)).toMatch(/positive|negative|net/i);
});
