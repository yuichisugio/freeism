import { expect, test } from "@playwright/test";

const baseURL = process.env.POINTS_E2E_BASE_URL;
const adminSessionCookie = process.env.POINTS_E2E_ADMIN_SESSION_COOKIE;

test.describe("Points admin read-only release fixture", () => {
  test.skip(
    !baseURL || !adminSessionCookie,
    "POINTS_E2E_BASE_URL and POINTS_E2E_ADMIN_SESSION_COOKIE are required",
  );

  test("admin membership and reconciliation reads are available", async ({ request }) => {
    const headers = { cookie: adminSessionCookie! };
    const memberships = await request.get(new URL("/api/admin/admin-memberships", baseURL).href, {
      headers,
    });
    expect(memberships.status()).toBe(200);
    expect(Array.isArray((await memberships.json()).data)).toBe(true);

    const reconciliation = await request.get(new URL("/api/reconciliation", baseURL).href, {
      headers,
    });
    expect(reconciliation.status()).toBe(200);
    expect((await reconciliation.json()).data).toBeDefined();
  });
});
