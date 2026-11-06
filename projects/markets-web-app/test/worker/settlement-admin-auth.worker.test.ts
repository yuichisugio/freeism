import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createMarketsBackendApp } from "../../src/backend/app";
import { createMarketsAuth } from "../../src/backend/auth/create-auth";
import type { Bindings } from "../../src/backend/http/context";

describe("Markets settlement admin authorization", () => {
  beforeEach(async () => {
    await env.DB!.exec(
      "DELETE FROM markets_user; DELETE FROM account; DELETE FROM session; DELETE FROM user;",
    );
  });

  async function retryAs(role: string | null) {
    await env
      .DB!.prepare("INSERT INTO user (id, name, email, role) VALUES (?, ?, ?, ?)")
      .bind("auth-admin-test", "Admin test", "admin-test@example.test", role)
      .run();
    const app = createMarketsBackendApp(async () => ({
      session: { userId: "auth-admin-test" },
      user: { id: "auth-admin-test", role },
    }));
    return app.fetch(
      new Request("https://markets.example.test/api/settlements/missing/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "retry-test" },
        body: JSON.stringify({ reason: "operator retry" }),
      }),
      env,
    );
  }

  it("requires a session", async () => {
    const app = createMarketsBackendApp(async () => null);
    const response = await app.fetch(
      new Request("https://markets.example.test/api/settlements/missing/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "retry-test" },
        body: JSON.stringify({ reason: "operator retry" }),
      }),
      env,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
  });

  it("rejects a regular user", async () => {
    const response = await retryAs("user");
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "MARKETS_ADMIN_REQUIRED" });
  });

  it("allows an admin to reach settlement lookup without a Points connection", async () => {
    const response = await retryAs("admin");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "SETTLEMENT_NOT_FOUND" });
  });

  it("accepts an admin in Better Auth's comma-separated roles", async () => {
    const response = await retryAs("user,admin");
    expect(response.status).toBe(404);
  });

  it("reads the current database role through a signed Better Auth session", async () => {
    const auth = createMarketsAuth(env as Bindings);
    const token = "markets-admin-session-token";
    await env.DB!.batch([
      env
        .DB!.prepare("INSERT INTO user (id, name, email, role) VALUES (?, ?, ?, ?)")
        .bind("auth-live-admin", "Live admin", "live-admin@example.test", "admin"),
      env
        .DB!.prepare(
          "INSERT INTO session (id, token, user_id, expires_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind("session-live-admin", token, "auth-live-admin", Date.now() + 60_000, Date.now()),
    ]);
    const authContext = await auth.$context;
    const cookieKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(authContext.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = Buffer.from(
      await crypto.subtle.sign("HMAC", cookieKey, new TextEncoder().encode(token)),
    ).toString("base64");
    const cookie = `${authContext.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`;
    const headers = new Headers({ Cookie: cookie });
    expect((await auth.api.getSession({ headers }))?.user.role).toBe("admin");

    const app = createMarketsBackendApp();
    const retry = () =>
      app.fetch(
        new Request("https://markets.example.test/api/settlements/missing/retry", {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
            "Idempotency-Key": "retry-live-admin",
          },
          body: JSON.stringify({ reason: "operator retry" }),
        }),
        env,
      );
    expect((await retry()).status).toBe(404);

    await env.DB!.prepare("UPDATE user SET role = 'user' WHERE id = 'auth-live-admin'").run();
    expect((await auth.api.getSession({ headers }))?.user.role).toBe("user");
    const denied = await retry();
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "MARKETS_ADMIN_REQUIRED" });
  });
});
