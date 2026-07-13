import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createMarketsBackendApp } from "../../src/backend/app";

describe("Markets Google session", () => {
  beforeEach(async () => {
    await env.DB!.exec(
      "DELETE FROM markets_user; DELETE FROM account; DELETE FROM session; DELETE FROM user;",
    );
  });

  it("returns a private 401 without a session", async () => {
    const response = await createMarketsBackendApp(async () => null).fetch(
      new Request("https://markets.example.test/api/session"),
      env,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("identifies the actor by Google providerId and accountId", async () => {
    await env.DB!.batch([
      env.DB!.prepare(
        "INSERT INTO user (id, name, email) VALUES ('auth-1', 'One', 'same@example.test')",
      ),
      env.DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('acc-1', 'google-subject-1', 'google', 'auth-1', 1)",
      ),
    ]);
    const app = createMarketsBackendApp(async () => ({
      session: { userId: "auth-1" },
      user: { id: "auth-1" },
    }));
    const response = await app.fetch(new Request("https://markets.example.test/api/session"), env);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { accountId: string; marketsUserId: string; providerId: string };
    };
    expect(body.data).toMatchObject({ accountId: "google-subject-1", providerId: "google" });
    expect(body.data.marketsUserId).toMatch(/^musr_/);
  });

  it("allows equal emails to remain separate provider subjects", async () => {
    await env.DB!.batch([
      env.DB!.prepare(
        "INSERT INTO user (id, name, email) VALUES ('auth-a', 'A', 'same@example.test')",
      ),
      env.DB!.prepare(
        "INSERT INTO user (id, name, email) VALUES ('auth-b', 'B', 'same@example.test')",
      ),
      env.DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('acc-a', 'google-a', 'google', 'auth-a', 1)",
      ),
      env.DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('acc-b', 'google-b', 'google', 'auth-b', 1)",
      ),
    ]);
    const rows = await env
      .DB!.prepare("SELECT count(*) AS count FROM user WHERE email = ?")
      .bind("same@example.test")
      .first<{ count: number }>();
    expect(rows?.count).toBe(2);
  });
});
