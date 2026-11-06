import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createMarketsBackendApp } from "../../src/backend/app";

let authUserId: string;
let sessionId: string;
let testNumber = 0;

async function setup(role: string | null = "admin", sessionCreatedAt = Date.now()) {
  await env.DB!.batch([
    env
      .DB!.prepare("INSERT INTO user (id, name, email, role) VALUES (?, ?, ?, ?)")
      .bind(authUserId, "Provider admin", "provider-admin@example.test", role),
    env
      .DB!.prepare(
        "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        sessionId,
        `provider-token-${testNumber}`,
        authUserId,
        Date.now() + 60_000,
        sessionCreatedAt,
        sessionCreatedAt,
      ),
    env
      .DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, 'google', ?, ?)",
      )
      .bind(
        `account-provider-admin-${testNumber}`,
        `google-provider-admin-${testNumber}`,
        authUserId,
        Date.now(),
      ),
  ]);
  return createMarketsBackendApp(async () => ({
    session: { id: sessionId, userId: authUserId },
    user: { id: authUserId, role },
  }));
}

async function seedProvider(providerId: string) {
  await env
    .DB!.prepare(
      `INSERT INTO points_provider
      (id, display_name, origin, issuer, resource, client_id, client_public_jwk,
       signing_key_ciphertext, dpop_key_ciphertext, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    )
    .bind(
      providerId,
      providerId,
      `https://${providerId}.example.test`,
      `https://${providerId}.example.test`,
      `https://${providerId}.example.test/api/v1`,
      `client-${providerId}`,
      JSON.stringify({ kty: "OKP", crv: "Ed25519", x: "public", kid: "kid" }),
      "encrypted-client-key",
      "encrypted-dpop-key",
    )
    .run();
}

function stop(app: ReturnType<typeof createMarketsBackendApp>, providerId: string, key: string) {
  return app.fetch(
    new Request(`https://markets.example.test/api/admin/points-connections/${providerId}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ reason: "運営停止" }),
    }),
    env,
  );
}

describe("Markets Points provider administration", () => {
  beforeEach(async () => {
    testNumber += 1;
    authUserId = `auth-provider-admin-${testNumber}`;
    sessionId = `session-provider-admin-${testNumber}`;
  });

  it("requires Markets ADMIN and a fresh session", async () => {
    await seedProvider("ppr_auth");
    const userApp = await setup("user");
    const denied = await stop(userApp, "ppr_auth", "user-stop");
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "MARKETS_ADMIN_REQUIRED" });

    await env.DB!.prepare("UPDATE user SET role = 'admin' WHERE id = ?").bind(authUserId).run();
    await env
      .DB!.prepare("UPDATE session SET created_at = ? WHERE id = ?")
      .bind(Date.now() - 901_000, sessionId)
      .run();
    const staleApp = createMarketsBackendApp(async () => ({
      session: { id: sessionId, userId: authUserId },
      user: { id: authUserId, role: "admin" },
    }));
    const stale = await stop(staleApp, "ppr_auth", "stale-stop");
    expect(stale.status).toBe(401);
    expect(await stale.json()).toMatchObject({ code: "FRESH_GOOGLE_AUTH_REQUIRED" });
  });

  it("stops one provider while retaining its keys and hiding it from the active list", async () => {
    const app = await setup();
    await seedProvider("ppr_stop");
    const response = await stop(app, "ppr_stop", "stop-a");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        providerId: "ppr_stop",
        status: "STOPPED",
        callbackUrls: {
          link: `${env.APP_ORIGIN}/api/points-connection/callback`,
          unlink: `${env.APP_ORIGIN}/api/points-connection/unlink/callback`,
        },
      },
    });
    const row = await env
      .DB!.prepare(
        "SELECT signing_key_ciphertext AS signingKeyCiphertext, dpop_key_ciphertext AS dpopKeyCiphertext FROM points_provider WHERE id = ?",
      )
      .bind("ppr_stop")
      .first<{ signingKeyCiphertext: string; dpopKeyCiphertext: string }>();
    expect(row).toEqual({
      signingKeyCiphertext: "encrypted-client-key",
      dpopKeyCiphertext: "encrypted-dpop-key",
    });
    const publicList = await app.fetch(
      new Request("https://markets.example.test/api/points-providers"),
      env,
    );
    const listed = await publicList.json<{ data: { providerId: string }[] }>();
    expect(listed.data.some((provider) => provider.providerId === "ppr_stop")).toBe(false);
  });

  it("scopes an idempotency key to the provider in the URL", async () => {
    const app = await setup();
    await seedProvider("ppr_a");
    await seedProvider("ppr_b");
    expect((await stop(app, "ppr_a", "shared-key")).status).toBe(200);
    expect((await stop(app, "ppr_b", "shared-key")).status).toBe(200);
    const states = await env
      .DB!.prepare("SELECT id, status FROM points_provider ORDER BY id")
      .all<{ id: string; status: string }>();
    expect(states.results.filter((row) => row.id === "ppr_a" || row.id === "ppr_b")).toEqual([
      { id: "ppr_a", status: "STOPPED" },
      { id: "ppr_b", status: "STOPPED" },
    ]);
  });
});
