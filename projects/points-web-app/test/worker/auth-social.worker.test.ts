import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vite-plus/test";

import { createPointsAuth } from "../../src/backend/auth/create-auth";
import type { Bindings } from "../../src/backend/http/context";
import { pointsSocialProviderIds } from "../../src/shared/auth/social-providers";

const APP_ORIGIN = "http://localhost:3000";
const db = env.DB;

if (db === undefined) {
  throw new Error("Test D1 binding DB is required");
}

async function postAuth(path: string, body: object, ipAddress: string): Promise<Response> {
  return SELF.fetch(`${APP_ORIGIN}/api/auth/${path}`, {
    body: JSON.stringify(body),
    headers: {
      "CF-Connecting-IP": ipAddress,
      "Content-Type": "application/json",
      Origin: APP_ORIGIN,
    },
    method: "POST",
  });
}

describe("Points social authentication", () => {
  beforeAll(async () => {
    await db.exec(
      "DELETE FROM rate_limit; DELETE FROM verification; DELETE FROM account; DELETE FROM session; DELETE FROM user;",
    );
  });

  it.each(pointsSocialProviderIds)("enables the %s sign-in endpoint", async (provider) => {
    const response = await postAuth(
      "sign-in/social",
      { callbackURL: APP_ORIGIN, provider },
      `192.0.2.${provider === "google" ? "10" : "11"}`,
    );

    expect(response.status).toBe(200);
    const body = await response.json<{ redirect: boolean; url: string }>();
    expect(body.redirect).toBe(true);
    expect(new URL(body.url).hostname).toBe(
      provider === "google" ? "accounts.google.com" : "github.com",
    );
  });

  it("uses the provider source of truth and disables implicit account linking", async () => {
    const auth = createPointsAuth(env as Bindings);
    const options = (await auth.$context).options;

    expect(Object.keys(options.socialProviders ?? {}).sort()).toEqual(
      [...pointsSocialProviderIds].sort(),
    );
    expect(options.account).toMatchObject({
      encryptOAuthTokens: true,
    });
    expect(options.account?.accountLinking).toMatchObject({
      allowDifferentEmails: true,
      allowUnlinkingAll: false,
      disableImplicitLinking: true,
      enabled: true,
      trustedProviders: [...pointsSocialProviderIds],
      updateUserInfoOnLink: false,
    });
  });

  it("does not expose email and password sign-in", async () => {
    const response = await postAuth(
      "sign-in/email",
      { email: "person@example.invalid", password: "not-a-real-password" },
      "192.0.2.12",
    );

    expect(response.status).toBe(400);
  });

  it("persists OAuth state in D1 across auth instance recreation", async () => {
    const response = await postAuth(
      "sign-in/social",
      { callbackURL: APP_ORIGIN, provider: "google" },
      "192.0.2.13",
    );
    expect(response.status).toBe(200);

    const storedBefore = await db.prepare("SELECT COUNT(*) AS count FROM verification").first<{
      count: number;
    }>();
    const recreatedAuth = createPointsAuth(env as Bindings);
    await recreatedAuth.$context;
    const storedAfter = await db.prepare("SELECT COUNT(*) AS count FROM verification").first<{
      count: number;
    }>();

    expect(storedBefore?.count).toBeGreaterThan(0);
    expect(storedAfter?.count).toBe(storedBefore?.count);
  });

  it("keeps incrementing the D1 rate-limit counter across auth instance recreation", async () => {
    const ipAddress = "192.0.2.14";
    const first = await postAuth(
      "sign-in/social",
      { callbackURL: APP_ORIGIN, provider: "github" },
      ipAddress,
    );
    expect(first.status).toBe(200);

    const counterBefore = await db
      .prepare("SELECT count FROM rate_limit WHERE key LIKE ? ORDER BY count DESC LIMIT 1")
      .bind(`%${ipAddress}%`)
      .first<{ count: number }>();
    expect(counterBefore?.count).toBeGreaterThan(0);

    const recreatedAuth = createPointsAuth(env as Bindings);
    const response = await recreatedAuth.handler(
      new Request(`${APP_ORIGIN}/api/auth/sign-in/social`, {
        body: JSON.stringify({ callbackURL: APP_ORIGIN, provider: "github" }),
        headers: {
          "CF-Connecting-IP": ipAddress,
          "Content-Type": "application/json",
          Origin: APP_ORIGIN,
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    const counterAfter = await db
      .prepare("SELECT count FROM rate_limit WHERE key LIKE ? ORDER BY count DESC LIMIT 1")
      .bind(`%${ipAddress}%`)
      .first<{ count: number }>();
    expect(counterAfter?.count).toBeGreaterThan(counterBefore?.count ?? 0);
  });

  it("resolves an existing provider account through the standard Better Auth lookup", async () => {
    const now = Date.now();
    await db.batch([
      db
        .prepare(
          "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind("user-a", "User A", "a@example.invalid", 1, now, now),
    ]);
    await db
      .prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind("account-a", "provider-account", "github", "user-a", now, now)
      .run();

    const recreatedAuth = createPointsAuth(env as Bindings);
    const account = await (
      await recreatedAuth.$context
    ).internalAdapter.findAccountByProviderId("provider-account", "github");

    expect(account).toMatchObject({
      accountId: "provider-account",
      providerId: "github",
      userId: "user-a",
    });
    const stored = await db
      .prepare("SELECT COUNT(*) AS count FROM account WHERE account_id = ? AND provider_id = ?")
      .bind("provider-account", "github")
      .first<{ count: number }>();
    expect(stored?.count).toBe(1);
  });
});
