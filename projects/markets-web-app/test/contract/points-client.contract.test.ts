import { describe, expect, it, vi } from "vite-plus/test";
import { pointsClientPrivateKeyJwk } from "../fixtures/points-oauth";
import { importJWK, SignJWT } from "jose";

import {
  assertNoPointsReturnTargetInput,
  createPointsOAuthState,
} from "../../src/backend/points/oauth-state";
import { PointsApiClient, PointsApiError } from "../../src/backend/points/points-api-client";
import {
  PointsOAuthClient,
  type PointsOAuthClientConfig,
} from "../../src/backend/points/points-oauth-client";

const origin = "https://points.example.test";
const config: PointsOAuthClientConfig = {
  origin,
  issuer: origin,
  resource: `${origin}/api/v1`,
  clientId: "client-1",
  signingKeyJwk: pointsClientPrivateKeyJwk,
  dpopKeyJwk: pointsClientPrivateKeyJwk,
  metadata: {
    issuer: origin,
    authorization_endpoint: `${origin}/api/auth/oauth2/authorize`,
    token_endpoint: `${origin}/api/auth/oauth2/token`,
    introspection_endpoint: `${origin}/api/auth/oauth2/introspect`,
    revocation_endpoint: `${origin}/api/auth/oauth2/revoke`,
  },
  fetch: globalThis.fetch,
};

function api(fetch: typeof globalThis.fetch, token = "m2m-token") {
  const oauth = new PointsOAuthClient({ ...config, fetch });
  vi.spyOn(oauth, "getM2MAccessToken").mockResolvedValue(token);
  return new PointsApiClient({ origin, fetch, oauth });
}

describe("Points provider clients", () => {
  it("uses discovered authorization endpoint and selected resource", () => {
    const oauth = new PointsOAuthClient(config);
    const url = new URL(
      oauth.authorizationUrl({
        callbackUri: "https://markets.example.test/callback",
        nonce: "n",
        pkceChallenge: "c",
        scopes: ["openid"],
        state: "s",
      }),
    );
    expect(url.pathname).toBe("/api/auth/oauth2/authorize");
    expect(url.searchParams.get("resource")).toBe(`${origin}/api/v1`);
    expect(url.searchParams.get("client_id")).toBe("client-1");
  });

  it("validates callback issuer and matching signed ID token subject", async () => {
    const signingJwk = JSON.parse(pointsClientPrivateKeyJwk);
    const idToken = await new SignJWT({ nonce: "nonce-a" })
      .setProtectedHeader({ alg: "EdDSA", kid: signingJwk.kid })
      .setIssuer(origin)
      .setAudience("client-1")
      .setSubject("subject-a")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(await importJWK(signingJwk, "EdDSA"));
    const requests: Request[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.url.endsWith("/oauth2/token"))
        return Response.json({
          access_token: "access-a",
          expires_in: 300,
          refresh_token: "refresh-a",
          token_type: "DPoP",
          id_token: idToken,
          scope: "openid points.balance.read",
        });
      if (request.url.endsWith("/oauth2/introspect"))
        return Response.json({
          active: true,
          aud: `${origin}/api/v1`,
          client_id: "client-1",
          exp: Math.floor(Date.now() / 1000) + 300,
          iss: origin,
          scope: "openid points.balance.read",
          sub: "subject-a",
        });
      if (request.url.endsWith("/jwks"))
        return Response.json({
          keys: [
            {
              kty: signingJwk.kty,
              crv: signingJwk.crv,
              x: signingJwk.x,
              kid: signingJwk.kid,
              alg: "EdDSA",
              use: "sig",
            },
          ],
        });
      throw new Error(`Unexpected request: ${request.url}`);
    }) as typeof globalThis.fetch;
    const oauth = new PointsOAuthClient({
      ...config,
      metadata: {
        ...config.metadata,
        jwks_uri: `${origin}/jwks`,
        authorization_response_iss_parameter_supported: true,
      },
      fetch,
    });
    const input = {
      callbackUri: "https://markets.example.test/callback",
      code: "code-a",
      issuer: origin,
      nonce: "nonce-a",
      pkceVerifier: "verifier-a",
      requiredScopes: ["points.balance.read"],
      state: "state-a",
    };
    await expect(oauth.exchangeAuthorizationCode(input)).resolves.toMatchObject({
      subject: "subject-a",
      issuer: origin,
    });
    expect(requests.some((request) => request.url.endsWith("/oauth2/token"))).toBe(true);
    await expect(
      oauth.exchangeAuthorizationCode({ ...input, issuer: undefined }),
    ).rejects.toThrow();
  });

  it("sends a DPoP proof with a provider-scoped M2M token", async () => {
    const requests: Request[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      return Response.json(
        {
          data: { expiresAt: "2026-07-13T00:10:00.000Z", linkAttemptId: "pla_1" },
          meta: { requestId: "req_1" },
        },
        { status: 201 },
      );
    }) as typeof globalThis.fetch;
    await api(fetch).createPointsLinkAttempt(
      {
        expiresAt: "2026-07-13T00:10:00.000Z",
        marketsUserId: "musr_1",
        pkceChallenge: "a".repeat(43),
        redirectUri: "https://markets.example.test/callback",
        requestedScopes: ["openid"],
        returnUrlHash: `sha256:${"b".repeat(64)}`,
        stateHash: `sha256:${"c".repeat(64)}`,
      },
      "link-key",
    );
    expect(requests[0]?.url).toBe(`${origin}/api/v1/oauth/link-attempts`);
    expect(requests[0]?.headers.get("Authorization")).toBe("DPoP m2m-token");
    expect(requests[0]?.headers.get("DPoP")).toBeTruthy();
  });

  it("allows a registered loopback origin for client credentials", async () => {
    const localOrigin = "http://127.0.0.1:8787";
    const requests: Request[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.url.endsWith("/oauth2/token"))
        return Response.json({
          access_token: "local-m2m",
          expires_in: 300,
          token_type: "DPoP",
        });
      return Response.json({
        active: true,
        aud: `${localOrigin}/api/v1`,
        client_id: "client-1",
        exp: Math.floor(Date.now() / 1000) + 300,
        iss: localOrigin,
        scope: "points.reservations.status",
        sub: "client-1",
      });
    }) as typeof globalThis.fetch;
    const oauth = new PointsOAuthClient({
      ...config,
      origin: localOrigin,
      issuer: localOrigin,
      resource: `${localOrigin}/api/v1`,
      metadata: {
        issuer: localOrigin,
        token_endpoint: `${localOrigin}/oauth2/token`,
        introspection_endpoint: `${localOrigin}/oauth2/introspect`,
      },
      fetch,
    });
    await expect(oauth.getM2MAccessToken(["points.reservations.status"])).resolves.toBe(
      "local-m2m",
    );
    expect(requests).toHaveLength(2);
  });

  it("keeps typed eligibility errors", async () => {
    const fetch = vi.fn(async () =>
      Response.json(
        {
          code: "POINT_PACKAGE_AUCTION_INELIGIBLE",
          errors: [{ auctionItemId: "row-1", code: "POINT_PACKAGE_INACTIVE" }],
        },
        { status: 409 },
      ),
    ) as typeof globalThis.fetch;
    await expect(
      api(fetch).checkPointPackageAuctionEligibility(
        {
          auctionCommandHash: `sha256:${"a".repeat(64)}`,
          auctionCommandId: "acmd_1",
          items: [
            {
              auctionItemId: "row-1",
              contentHash: `sha256:${"b".repeat(64)}`,
              pointPackageId: "pkg_1",
              pointPackageRevisionId: "ppr_1",
            },
          ],
        },
        "preview-key",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "POINT_PACKAGE_AUCTION_INELIGIBLE",
    } satisfies Partial<PointsApiError>);
  });

  it("keeps the fixed return path and rejects caller-controlled targets", async () => {
    const state = await createPointsOAuthState({
      callbackUri: "https://markets.example.test/callback",
      sessionId: "session-1",
    });
    expect(state.returnPath).toBe("/settings/points-connection");
    expect(() => assertNoPointsReturnTargetInput(new URLSearchParams("returnTo=/evil"))).toThrow(
      "POINTS_RETURN_TARGET_FORBIDDEN",
    );
  });
});
