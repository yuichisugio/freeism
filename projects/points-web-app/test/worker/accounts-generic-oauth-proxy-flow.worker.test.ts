import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { env } from "cloudflare:test";
import { createAuthMiddleware, getOAuthState } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { genericOAuth, oAuthProxy, testUtils } from "better-auth/plugins";
import { describe, expect, it, vi } from "vitest";

import { exchangeAccountsCodeForGenericOAuth } from "../../src/backend/accounts/accounts-oauth-client";
import { decodeBase64Url } from "../../src/backend/accounts/base64url";
import { discoverAccounts } from "../../src/backend/accounts/accounts-discovery";
import {
  generateAccountsSigningKey,
  importAccountsSigningKeyPair,
  toAccountsPublicJwks,
} from "../../src/backend/accounts/accounts-key-vault";
import { createDb } from "../../src/backend/infrastructure/db/client";
import * as schema from "../../src/backend/infrastructure/db/schema";
import { createFakeAccounts } from "../support/fake-accounts";

const previewOrigin = "https://preview.points.test";
const stagingOrigin = "https://staging.points.test";

describe("Accounts Generic OAuth + OAuth Proxy", () => {
  it.each([false, true])(
    "固定callbackでnonceを検査し、Previewの本人へ戻す (mismatch=%s)",
    async (mismatch) => {
      const accounts = await createFakeAccounts({
        origin: `https://accounts-${crypto.randomUUID()}.test`,
      });
      const clientId = `client-${crypto.randomUUID()}`;
      const clientKey = await generateAccountsSigningKey();
      const dpopKey = await generateAccountsSigningKey();
      accounts.registerClient(clientId, toAccountsPublicJwks(clientKey.publicJwk));
      const endpoint = { accountsOrigin: accounts.origin, fetch: accounts.fetch };
      const client = {
        clientId,
        clientKey: await importAccountsSigningKeyPair(clientKey.privateJwk),
        dpopKey: await importAccountsSigningKeyPair(dpopKey.privateJwk),
      };
      const authServer = await discoverAccounts(endpoint);
      const attempts = new Map<string, string>();
      const observedAccounts: Array<{ accountId: string; userId: string }> = [];
      const completionStates: Array<Awaited<ReturnType<typeof getOAuthState>>> = [];
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation((input, init) => accounts.fetch(input, init));
      const providerId = "accounts-gate";
      const secret = "proxy-shared-secret-at-least-thirty-two-characters";
      const createAuth = (origin: string) =>
        betterAuth({
          baseURL: origin,
          secret,
          database: drizzleAdapter(createDb(env.DB!), { provider: "sqlite", schema }),
          databaseHooks: {
            account: {
              create: {
                after: async (account) => {
                  if (account.providerId !== providerId) return;
                  completionStates.push(await getOAuthState());
                  observedAccounts.push({ accountId: account.accountId, userId: account.userId });
                  await env.DB!.prepare("DELETE FROM account WHERE id = ?").bind(account.id).run();
                },
              },
            },
          },
          account: {
            storeStateStrategy: "database",
            accountLinking: {
              enabled: true,
              allowDifferentEmails: true,
              trustedProviders: [providerId],
            },
          },
          trustedOrigins: [previewOrigin, stagingOrigin],
          hooks: {
            after: createAuthMiddleware(async (ctx) => {
              if (ctx.path !== "/link-social") return;
              const state = await getOAuthState();
              if (state?.codeVerifier && state.idTokenNonce) {
                attempts.set(state.codeVerifier, state.idTokenNonce);
              }
            }),
          },
          plugins: [
            genericOAuth({
              config: [
                {
                  providerId,
                  clientId,
                  discoveryUrl: `${accounts.origin}/.well-known/openid-configuration`,
                  requireIdTokenVerification: true,
                  scopes: ["openid"],
                  getUserInfo: async ({ idToken }) => {
                    if (!idToken) return null;
                    const payload = JSON.parse(
                      new TextDecoder().decode(decodeBase64Url(idToken.split(".")[1]!)),
                    ) as { sub: string };
                    return {
                      sub: payload.sub,
                      email: `${payload.sub}@points.example.invalid`,
                      emailVerified: false,
                    };
                  },
                  getToken: async ({ code, codeVerifier, redirectURI }) => {
                    const nonce = attempts.get(codeVerifier ?? "");
                    if (!nonce || !codeVerifier) throw new Error("missing nonce bridge");
                    return exchangeAccountsCodeForGenericOAuth(
                      { endpoint, authorizationServer: authServer, client },
                      { code, codeVerifier, nonce, redirectUri: redirectURI },
                    );
                  },
                },
              ],
            }),
            oAuthProxy({ productionURL: stagingOrigin }),
            testUtils(),
          ],
        });

      try {
        const preview = createAuth(previewOrigin);
        const staging = createAuth(stagingOrigin);
        const helper = (await preview.$context).test;
        const user = await helper.saveUser(
          helper.createUser({ email: `gate-${crypto.randomUUID()}@example.test` }),
        );
        const { headers } = await helper.login({ userId: user.id });
        const linkResponse = await preview.handler(
          new Request(`${previewOrigin}/api/auth/link-social`, {
            method: "POST",
            headers: new Headers({
              ...Object.fromEntries(headers),
              origin: previewOrigin,
              "content-type": "application/json",
            }),
            body: JSON.stringify({
              provider: providerId,
              callbackURL: `${previewOrigin}/settings`,
            }),
          }),
        );
        expect(linkResponse.status).toBe(200);
        const { url } = (await linkResponse.json()) as { url: string };
        const authorize = new URL(url);
        const accountsUserId = `ausr_${crypto.randomUUID()}`;
        const code = accounts.issueCode({
          clientId,
          sub: accountsUserId,
          nonce: mismatch ? "different-nonce" : authorize.searchParams.get("nonce")!,
          codeChallenge: authorize.searchParams.get("code_challenge")!,
          redirectUri: authorize.searchParams.get("redirect_uri")!,
        });
        const fixedCallback = new URL(`${stagingOrigin}/api/auth/callback/${providerId}`);
        fixedCallback.searchParams.set("code", code);
        fixedCallback.searchParams.set("state", authorize.searchParams.get("state")!);
        fixedCallback.searchParams.set("iss", accounts.origin);
        const fixedResponse = await staging.handler(new Request(fixedCallback));
        expect(fixedResponse.status).toBe(302);
        const previewCallback = fixedResponse.headers.get("location")!;
        if (mismatch) {
          expect(previewCallback).toContain("error=");
        } else {
          expect(previewCallback).toContain(`/callback/${providerId}/oauth-proxy`);
          const completed = await preview.handler(new Request(previewCallback, { headers }));
          expect(completed.status).toBe(302);
          expect(completed.headers.get("location")).toBe(`${previewOrigin}/settings`);
          expect(observedAccounts).toContainEqual({ accountId: accountsUserId, userId: user.id });
          expect(completionStates).toEqual([
            expect.objectContaining({
              link: expect.objectContaining({ userId: user.id }),
              callbackURL: expect.stringContaining(
                `/callback/${providerId}/oauth-proxy?callbackURL=`,
              ),
            }),
          ]);
          expect(new URL(completionStates[0]!.callbackURL).searchParams.get("callbackURL")).toBe(
            `${previewOrigin}/settings`,
          );
          const linked = await env
            .DB!.prepare(
              "SELECT user_id AS userId FROM account WHERE provider_id = ? AND account_id = ?",
            )
            .bind(providerId, accountsUserId)
            .first<{ userId: string }>();
          expect(linked).toBeNull();
        }
      } finally {
        fetchMock.mockRestore();
      }
    },
  );
});
