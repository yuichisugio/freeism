import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import { createPointsBackendApp } from "../../src/backend/app";
import { createPointsAuth } from "../../src/backend/auth/create-auth";
import type { Bindings } from "../../src/backend/http/context";
import { seedPointsUser } from "../support/accounts-worker-setup";

const previewOrigin = "https://points-pr-123-points-worker-staging.kyogoku.workers.dev";
const stagingOrigin = "https://staging.points.freeism.app";
const app = createPointsBackendApp();

function bindings(origin: string): Bindings {
  return {
    ...env,
    APP_ORIGIN: origin,
    OAUTH_PROXY_PRODUCTION_URL: stagingOrigin,
    PREVIEW_WORKERS_SUBDOMAIN: "kyogoku",
  } as Bindings;
}

async function sessionCookie(sessionId: string): Promise<string> {
  const token = `token-${sessionId.slice("session-".length)}`;
  const context = await createPointsAuth(bindings(previewOrigin)).$context;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(context.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)),
  ).toString("base64");
  return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`;
}

function providerNetwork(provider: "google" | "github", accountId: string) {
  const email = `${accountId}@example.invalid`;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (provider === "google" && url.href === "https://oauth2.googleapis.com/token") {
      const tokenPayload = Buffer.from(
        JSON.stringify({
          sub: accountId,
          email,
          email_verified: true,
          name: "Proxy test user",
        }),
      ).toString("base64url");
      return Response.json({
        access_token: "test-google-token",
        token_type: "Bearer",
        id_token: `e30.${tokenPayload}.sig`,
      });
    }
    if (provider === "github" && url.href === "https://github.com/login/oauth/access_token") {
      return Response.json({ access_token: "test-github-token", token_type: "Bearer" });
    }
    if (provider === "github" && url.href === "https://api.github.com/user") {
      return Response.json({
        id: accountId,
        login: "proxy-test-user",
        name: "Proxy test user",
        email,
      });
    }
    if (provider === "github" && url.href === "https://api.github.com/user/emails") {
      return Response.json([{ email, primary: true, verified: true }]);
    }
    throw new Error(`Unexpected provider request: ${request.method} ${request.url}`);
  });
}

describe("Points social OAuth Proxy", () => {
  it.each(["google", "github"] as const)(
    "%s sign-in returns from staging to the same Preview",
    async (provider) => {
      const accountId = `proxy-${crypto.randomUUID()}`;
      const callbackURL = `${previewOrigin}/dashboard`;
      const network = providerNetwork(provider, accountId);
      try {
        const started = await app.fetch(
          new Request(`${previewOrigin}/api/auth/sign-in/social`, {
            method: "POST",
            headers: { "content-type": "application/json", origin: previewOrigin },
            body: JSON.stringify({ provider, callbackURL }),
          }),
          bindings(previewOrigin),
        );
        expect(started.status).toBe(200);
        const { url } = (await started.json()) as { url: string };
        const authorization = new URL(url);
        expect(authorization.searchParams.get("redirect_uri")).toBe(
          `${stagingOrigin}/api/auth/callback/${provider}`,
        );
        const state = authorization.searchParams.get("state");
        expect(state).toBeTruthy();

        const fixedCallback = new URL(`${stagingOrigin}/api/auth/callback/${provider}`);
        fixedCallback.searchParams.set("code", "test-authorization-code");
        fixedCallback.searchParams.set("state", state!);
        const fixed = await app.fetch(new Request(fixedCallback), bindings(stagingOrigin));
        expect(fixed.status).toBe(302);
        const previewCallback = fixed.headers.get("location")!;
        expect(new URL(previewCallback).origin).toBe(previewOrigin);
        expect(new URL(previewCallback).pathname).toBe(
          `/api/auth/callback/${provider}/oauth-proxy`,
        );

        const completed = await app.fetch(new Request(previewCallback), bindings(previewOrigin));
        expect(completed.status).toBe(302);
        expect(completed.headers.get("location")).toBe(callbackURL);
        expect(completed.headers.get("set-cookie")).toContain("points.session_token=");
        const linked = await env
          .DB!.prepare(
            "SELECT user_id AS userId FROM account WHERE provider_id = ? AND account_id = ?",
          )
          .bind(provider, accountId)
          .first<{ userId: string }>();
        expect(linked?.userId).toBeTruthy();
        const pointsUser = await env
          .DB!.prepare("SELECT id FROM points_user WHERE auth_user_id = ?")
          .bind(linked!.userId)
          .first();
        expect(pointsUser).not.toBeNull();
      } finally {
        network.mockRestore();
      }
    },
  );

  it.each(["google", "github"] as const)(
    "%s explicit link stays on the original Points user",
    async (provider) => {
      const user = await seedPointsUser(env.DB!);
      const cookie = await sessionCookie(user.sessionId);
      const accountId = `proxy-${crypto.randomUUID()}`;
      const callbackURL = `${previewOrigin}/settings/accounts`;
      const network = providerNetwork(provider, accountId);
      try {
        const started = await app.fetch(
          new Request(`${previewOrigin}/api/auth/link-social`, {
            method: "POST",
            headers: { "content-type": "application/json", origin: previewOrigin, cookie },
            body: JSON.stringify({ provider, callbackURL }),
          }),
          bindings(previewOrigin),
        );
        expect(started.status).toBe(200);
        const { url } = (await started.json()) as { url: string };
        const authorization = new URL(url);
        expect(authorization.searchParams.get("redirect_uri")).toBe(
          `${stagingOrigin}/api/auth/callback/${provider}`,
        );
        const state = authorization.searchParams.get("state");
        expect(state).toBeTruthy();

        const fixedCallback = new URL(`${stagingOrigin}/api/auth/callback/${provider}`);
        fixedCallback.searchParams.set("code", "test-authorization-code");
        fixedCallback.searchParams.set("state", state!);
        const fixed = await app.fetch(new Request(fixedCallback), bindings(stagingOrigin));
        expect(fixed.status).toBe(302);
        const previewCallback = fixed.headers.get("location")!;
        expect(new URL(previewCallback).origin).toBe(previewOrigin);
        expect(new URL(previewCallback).pathname).toBe(
          `/api/auth/callback/${provider}/oauth-proxy`,
        );

        const completed = await app.fetch(
          new Request(previewCallback, { headers: { cookie } }),
          bindings(previewOrigin),
        );
        expect(completed.status).toBe(302);
        expect(completed.headers.get("location")).toBe(callbackURL);
        const linked = await env
          .DB!.prepare(
            "SELECT user_id AS userId FROM account WHERE provider_id = ? AND account_id = ?",
          )
          .bind(provider, accountId)
          .first<{ userId: string }>();
        expect(linked?.userId).toBe(user.authUserId);
        const pointsUser = await env
          .DB!.prepare("SELECT id FROM points_user WHERE auth_user_id = ?")
          .bind(user.authUserId)
          .first<{ id: string }>();
        expect(pointsUser?.id).toBe(user.pointsUserId);
      } finally {
        network.mockRestore();
      }
    },
  );
});
