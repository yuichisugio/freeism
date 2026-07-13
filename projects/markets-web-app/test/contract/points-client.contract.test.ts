import { describe, expect, it } from "vite-plus/test";

import {
  assertNoPointsReturnTargetInput,
  createPointsOAuthState,
} from "../../src/backend/points/oauth-state";
import { PointsApiClient } from "../../src/backend/points/points-api-client";
import { PointsOAuthClient } from "../../src/backend/points/points-oauth-client";

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

describe("Points generated API client contract", () => {
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
        pkceChallenge: "challenge",
        redirectUri: "https://markets.example.test/api/points-connection/callback",
        requestedScopes: ["openid"],
        returnUrlHash: "sha256:return",
        stateHash: "sha256:state",
      },
      "link-attempt-1",
    );
    await client.getPointsConnection("opaque-user-token");

    expect(fetcher.requests[0]?.headers.get("Authorization")).toBe(
      "Bearer m2m:points.connection.link-attempt.create",
    );
    expect(fetcher.requests[1]?.headers.get("Authorization")).toBe("Bearer opaque-user-token");
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

describe("Points OAuth client separation", () => {
  it("requires distinct user, M2M, and settlement clients and secrets", () => {
    const fetcher = new RecordingFetcher();
    expect(
      () =>
        new PointsOAuthClient(fetcher, {
          audience: "https://points.example.test/api/v1",
          issuer: "https://points.example.test/api/auth",
          m2mClientId: "shared-client",
          m2mClientSecret: "shared-secret",
          settlementClientId: "settlement-client",
          settlementClientSecret: "settlement-secret",
          userClientId: "shared-client",
          userClientSecret: "shared-secret",
        }),
    ).toThrow("POINTS_OAUTH_CLIENTS_NOT_SEPARATE");
  });

  it("rejects user scopes before requesting an M2M client-credentials token", async () => {
    const fetcher = new RecordingFetcher();
    const oauth = new PointsOAuthClient(fetcher, {
      audience: "https://points.example.test/api/v1",
      issuer: "https://points.example.test/api/auth",
      m2mClientId: "m2m-client",
      m2mClientSecret: "m2m-secret",
      settlementClientId: "settlement-client",
      settlementClientSecret: "settlement-secret",
      userClientId: "user-client",
      userClientSecret: "user-secret",
    });
    await expect(oauth.getM2MAccessToken(["points.balance.read"])).rejects.toThrow(
      "POINTS_M2M_SCOPE_INVALID",
    );
    expect(fetcher.requests).toHaveLength(0);
  });
});
