import { env, exports } from "cloudflare:workers";
import * as v from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loginAsNewUser } from "../../../test/oauth-client-test-helpers";
import { dataResponseSchema, problemDetailsSchema } from "../../shared/schemas/problem-details-schema";
import { meSchema } from "../../shared/schemas/profile-schema";
import { PublicProfileEntrypoint } from "../../public-profile";

const origin = env.ACCOUNTS_ORIGIN;

/**
 * 表示名の更新を要求する。
 */
function patchProfile(headers: Headers, body: unknown) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Content-Type", "application/json");
  return exports.default.fetch(`${origin}/api/profile`, {
    method: "PATCH",
    headers: requestHeaders,
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/profile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("表示名を更新して本人のプロフィールを返し、公開プロフィールをpurgeする", async () => {
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");
    const { userId, headers } = await loginAsNewUser();

    const response = await patchProfile(headers, { displayName: "  Alice  " });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(v.parse(dataResponseSchema(meSchema), await response.json()).data).toEqual({
      accountsUserId: userId,
      displayName: "Alice",
      profileUrl: `${origin}/profiles/${userId}`,
    });
    // 標準の更新処理が更新後のセッションのcookie cacheを返し、次の`/api/me`に反映する。
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
    await vi.waitFor(() => expect(purge).toHaveBeenCalledWith([userId]));

    const profile = await exports.default.fetch(`${origin}/profiles/${userId}`);
    expect(await profile.text()).toContain("<h1>Alice</h1>");
  });

  it.each([
    ["空白だけ", "   "],
    ["51文字", "あ".repeat(51)],
  ])("%sの表示名は400で拒否し、表示名を変更しない", async (_, displayName) => {
    const { headers } = await loginAsNewUser();

    const response = await patchProfile(headers, { displayName });

    expect(response.status).toBe(400);
    expect(v.parse(problemDetailsSchema, await response.json())).toMatchObject({
      code: "INVALID_VALUE",
    });
    const me = await exports.default.fetch(`${origin}/api/me`, { headers });
    expect(v.parse(dataResponseSchema(meSchema), await me.json()).data.displayName).toBe(
      "仮ユーザー",
    );
  });

  it("セッションが無い要求は401を返す", async () => {
    const response = await patchProfile(new Headers({ Origin: origin }), { displayName: "Alice" });

    expect(response.status).toBe(401);
  });
});
