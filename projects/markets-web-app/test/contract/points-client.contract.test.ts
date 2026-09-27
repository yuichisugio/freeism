import { pointsClientPrivateKeyJwk } from "../fixtures/points-oauth";
import { describe, expect, it } from "vite-plus/test";
import { importJWK, jwtVerify } from "jose";

import {
  assertNoPointsReturnTargetInput,
  createPointsOAuthState,
} from "../../src/backend/points/oauth-state";
import { PointsApiClient, PointsApiError } from "../../src/backend/points/points-api-client";
import {
  PointsOAuthClient,
  type PointsOAuthClientConfig,
} from "../../src/backend/points/points-oauth-client";

const sharedOAuthConfig: PointsOAuthClientConfig = {
  audience: "https://points.example.test/api/v1",
  issuer: "https://points.example.test/api/auth",
  clientId: "shared-client",
  privateKeyJwk: pointsClientPrivateKeyJwk,
};

class RecordingFetcher implements Fetcher {
  requests: Request[] = [];

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init);
    this.requests.push(request);
    if (request.url.endsWith("/api/v1/oauth/link-attempts")) {
      return Response.json(
        {
          data: { expiresAt: "2026-07-13T00:10:00.000Z", linkAttemptId: "pla_1" },
          meta: { requestId: "req_1" },
        },
        { status: 201 },
      );
    }
    return Response.json({
      data: {
        grantVersion: 1,
        grantedScopes: ["points.connection.read"],
        issuer: "https://points.example.test/api/auth",
        linkedAt: "2026-07-13T00:00:00.000Z",
        pointsConnectionId: "pcn_1",
        status: "ACTIVE",
        subject: "pairwise-subject",
      },
      meta: { requestId: "req_2" },
    });
  }

  connect(): Socket {
    throw new Error("not implemented");
  }
}

function recordingOAuthFetcher(
  token: Record<string, unknown>,
  introspection: Record<string, unknown>,
) {
  const requests: Request[] = [];
  const fetcher: Fetcher = {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return Response.json(request.url.endsWith("/oauth2/token") ? token : introspection);
    },
    connect: () => {
      throw new Error("not implemented");
    },
  };
  return { fetcher, requests };
}

describe("Points API client contract", () => {
  it("exposes only the frozen eleven generated operations", () => {
    const methods = Object.getOwnPropertyNames(PointsApiClient.prototype)
      .filter((name) => name !== "constructor")
      .sort();
    expect(methods).toEqual(
      [
        "capturePointSettlement",
        "checkPointBalance",
        "checkPointPackageAuctionEligibility",
        "createPointReservation",
        "createPointsLinkAttempt",
        "deactivatePointsConnection",
        "finalizePointsLinkAttempt",
        "getPointReservationStatus",
        "getPointsConnection",
        "getPublicPointPackageRevision",
        "releasePointReservation",
      ].sort(),
    );
  });

  it("uses a scoped M2M bearer for link attempts and a user bearer for connection reads", async () => {
    const fetcher = new RecordingFetcher();
    const client = new PointsApiClient(fetcher, async (scopes) => `m2m:${scopes.join(" ")}`);
    await client.createPointsLinkAttempt(
      {
        expiresAt: "2026-07-13T00:10:00.000Z",
        marketsUserId: "musr_1",
        pkceChallenge: "a".repeat(43),
        redirectUri: "https://markets.example.test/api/points-connection/callback",
        requestedScopes: ["openid"],
        returnUrlHash: `sha256:${"b".repeat(64)}`,
        stateHash: `sha256:${"c".repeat(64)}`,
      },
      "link-attempt-1",
    );
    await client.getPointsConnection("jwt-user-token");

    expect(fetcher.requests[0]?.headers.get("Authorization")).toBe(
      "Bearer m2m:points.connection.link-attempt.create",
    );
    expect(fetcher.requests[1]?.headers.get("Authorization")).toBe("Bearer jwt-user-token");
  });

  it("keeps typed item errors from an auction eligibility conflict", async () => {
    const fetcher: Fetcher = {
      fetch: async () =>
        Response.json(
          {
            code: "POINT_PACKAGE_AUCTION_INELIGIBLE",
            errors: [
              { auctionItemId: "row-1", code: "POINT_PACKAGE_INACTIVE" },
              { auctionItemId: "row-2", code: "CONTENT_HASH_MISMATCH" },
            ],
          },
          { status: 409 },
        ),
      connect: () => {
        throw new Error("not implemented");
      },
    };
    const client = new PointsApiClient(fetcher, async () => "m2m-token");

    await expect(
      client.checkPointPackageAuctionEligibility(
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
        "preview-key-1",
      ),
    ).rejects.toMatchObject({
      code: "POINT_PACKAGE_AUCTION_INELIGIBLE",
      errors: [
        { auctionItemId: "row-1", code: "POINT_PACKAGE_INACTIVE" },
        { auctionItemId: "row-2", code: "CONTENT_HASH_MISMATCH" },
      ],
      status: 409,
    } satisfies Partial<PointsApiError>);
  });

  it("has no caller-controlled return target and keeps the fixed settings path", async () => {
    const state = await createPointsOAuthState({
      callbackUri: "https://markets.example.test/api/points-connection/callback",
      now: new Date("2026-07-13T00:00:00.000Z"),
      sessionId: "session-1",
    });
    expect(state.returnPath).toBe("/settings/points-connection");
    expect(() => assertNoPointsReturnTargetInput(new URLSearchParams("returnTo=/evil"))).toThrow(
      "POINTS_RETURN_TARGET_FORBIDDEN",
    );
  });
});

describe("Points OAuth shared client", () => {
  it("accepts the same non-empty client ID and signing key for all three flows", () => {
    const fetcher = new RecordingFetcher();
    expect(() => new PointsOAuthClient(fetcher, sharedOAuthConfig)).not.toThrow();
  });

  it("rejects an empty client ID or signing key", () => {
    const fetcher = new RecordingFetcher();
    for (const field of ["clientId", "privateKeyJwk"] as const) {
      expect(() => new PointsOAuthClient(fetcher, { ...sharedOAuthConfig, [field]: "" })).toThrow(
        "POINTS_OAUTH_CLIENT_MISSING",
      );
    }
  });

  it("uses the shared client for user authorization and the requested user scope", () => {
    const oauth = new PointsOAuthClient(new RecordingFetcher(), sharedOAuthConfig);
    const url = new URL(
      oauth.authorizationUrl({
        callbackUri: "https://markets.example.test/api/points-connection/callback",
        nonce: "nonce_1",
        pkceChallenge: "challenge_1",
        scopes: ["openid", "offline_access", "points.balance.read"],
        state: "state_1",
      }),
    );

    expect(url.searchParams.get("client_id")).toBe("shared-client");
    expect(url.searchParams.get("resource")).toBe(sharedOAuthConfig.audience);
    expect(url.searchParams.get("scope")).toBe("openid offline_access points.balance.read");
  });

  it("exchanges a user code with the shared client and keeps the user subject check", async () => {
    const { fetcher, requests } = recordingOAuthFetcher(
      {
        access_token: "jwt-user-token",
        expires_in: 300,
        refresh_token: "jwt-refresh-token",
        token_type: "Bearer",
      },
      {
        active: true,
        aud: sharedOAuthConfig.audience,
        client_id: "shared-client",
        exp: Math.floor(Date.now() / 1000) + 300,
        iss: sharedOAuthConfig.issuer,
        scope: "openid offline_access points.balance.read",
        sub: "pairwise-subject",
      },
    );
    const oauth = new PointsOAuthClient(fetcher, sharedOAuthConfig);

    const token = await oauth.exchangeAuthorizationCode({
      callbackUri: "https://markets.example.test/api/points-connection/callback",
      code: "authorization-code",
      pkceVerifier: "pkce-verifier",
      requiredScopes: ["points.balance.read"],
    });

    expect(token.clientId).toBe("shared-client");
    expect(token.subject).toBe("pairwise-subject");
    expect(requests).toHaveLength(2);
    expect(requests[0]?.headers.get("Authorization")).toBe(
      null,
    );
    const tokenBody = new URLSearchParams(await requests[0]!.text());
    const endpoint = `${sharedOAuthConfig.issuer}/oauth2/token`;
    const assertion = tokenBody.get("client_assertion");
    expect(tokenBody.get("client_assertion_type")).toBe(
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );
    expect(assertion).toBeTruthy();
    const signingKey = JSON.parse(sharedOAuthConfig.privateKeyJwk);
    const { payload, protectedHeader } = await jwtVerify(
      assertion!,
      await importJWK({ kty: signingKey.kty, crv: signingKey.crv, x: signingKey.x }, "EdDSA"),
      { audience: endpoint, issuer: sharedOAuthConfig.clientId, subject: sharedOAuthConfig.clientId },
    );
    expect(protectedHeader.kid).toBe(signingKey.kid);
    expect(payload.exp! - payload.iat!).toBe(60);
    expect(payload.jti).toBeTruthy();
    expect(tokenBody.get("client_id")).toBe("shared-client");
    expect(tokenBody.get("grant_type")).toBe("authorization_code");
    expect(tokenBody.get("resource")).toBe(sharedOAuthConfig.audience);
    expect(requests[1]?.headers.get("Authorization")).toBeNull();
    const introspectionBody = new URLSearchParams(await requests[1]!.text());
    const introspection = await jwtVerify(
      introspectionBody.get("client_assertion")!,
      await importJWK({ kty: signingKey.kty, crv: signingKey.crv, x: signingKey.x }, "EdDSA"),
      {
        audience: `${sharedOAuthConfig.issuer}/oauth2/introspect`,
        issuer: sharedOAuthConfig.clientId,
        subject: sharedOAuthConfig.clientId,
      },
    );
    expect(introspection.payload.jti).not.toBe(payload.jti);
  });

  it("authenticates revocation with an endpoint-bound signed assertion", async () => {
    const { fetcher, requests } = recordingOAuthFetcher({}, {});
    const oauth = new PointsOAuthClient(fetcher, sharedOAuthConfig);
    await oauth.revoke("refresh-token", "refresh_token");
    const body = new URLSearchParams(await requests[0]!.text());
    const key = JSON.parse(sharedOAuthConfig.privateKeyJwk);
    await expect(
      jwtVerify(
        body.get("client_assertion")!,
        await importJWK({ kty: key.kty, crv: key.crv, x: key.x }, "EdDSA"),
        {
          audience: `${sharedOAuthConfig.issuer}/oauth2/revoke`,
          issuer: sharedOAuthConfig.clientId,
          subject: sharedOAuthConfig.clientId,
        },
      ),
    ).resolves.toBeTruthy();
    expect(body.get("token")).toBe("refresh-token");
    expect(body.get("token_type_hint")).toBe("refresh_token");
  });

  it("uses the shared client for M2M and sends only the requested M2M scope", async () => {
    const { fetcher, requests } = recordingOAuthFetcher(
      {
        access_token: "jwt-m2m-token",
        expires_in: 300,
        token_type: "Bearer",
      },
      {
        active: true,
        aud: sharedOAuthConfig.audience,
        client_id: "shared-client",
        exp: Math.floor(Date.now() / 1000) + 300,
        iss: sharedOAuthConfig.issuer,
        scope: "points.reservations.status",
        sub: "shared-client",
      },
    );
    const oauth = new PointsOAuthClient(fetcher, sharedOAuthConfig);

    await expect(oauth.getM2MAccessToken(["points.reservations.status"])).resolves.toBe(
      "jwt-m2m-token",
    );
    expect(requests).toHaveLength(2);
    expect(requests[0]?.headers.get("Authorization")).toBe(
      null,
    );
    const tokenBody = new URLSearchParams(await requests[0]!.text());
    expect(tokenBody.get("grant_type")).toBe("client_credentials");
    expect(tokenBody.get("resource")).toBe(sharedOAuthConfig.audience);
    expect(tokenBody.get("scope")).toBe("points.reservations.status");
    expect(requests[1]?.headers.get("Authorization")).toBeNull();
  });

  it("distinguishes user and M2M principals even when their client IDs match", async () => {
    const introspection = {
      active: true,
      aud: sharedOAuthConfig.audience,
      client_id: "shared-client",
      exp: Math.floor(Date.now() / 1000) + 300,
      iss: sharedOAuthConfig.issuer,
      scope: "points.balance.read",
    };
    const { fetcher: userFetcher } = recordingOAuthFetcher({}, introspection);
    const userOAuth = new PointsOAuthClient(userFetcher, sharedOAuthConfig);
    await expect(
      userOAuth.introspectUserAccessToken("jwt-token", ["points.balance.read"]),
    ).rejects.toThrow("POINTS_USER_INTROSPECTION_INVALID");

    const { fetcher: m2mFetcher } = recordingOAuthFetcher(
      { access_token: "jwt-token", expires_in: 300, token_type: "Bearer" },
      { ...introspection, scope: "points.reservations.status", sub: "points-user-id" },
    );
    const m2mOAuth = new PointsOAuthClient(m2mFetcher, sharedOAuthConfig);
    await expect(m2mOAuth.getM2MAccessToken(["points.reservations.status"])).rejects.toThrow(
      "POINTS_M2M_INTROSPECTION_INVALID",
    );
  });

  it("rejects user scopes before requesting an M2M client-credentials token", async () => {
    const fetcher = new RecordingFetcher();
    const oauth = new PointsOAuthClient(fetcher, sharedOAuthConfig);
    await expect(oauth.getM2MAccessToken(["points.balance.read"])).rejects.toThrow(
      "POINTS_M2M_SCOPE_INVALID",
    );
    expect(fetcher.requests).toHaveLength(0);
  });
});
