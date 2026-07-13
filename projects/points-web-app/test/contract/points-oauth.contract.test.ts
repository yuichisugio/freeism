import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  createPointsOAuthProvider,
  pointsOAuthClients,
  pointsOAuthScopes,
  requiresPointsLinkAttemptBinding,
} from "../../src/backend/auth/points-oauth-provider";
import { pointsOAuthBootstrapRegistrations } from "../../src/backend/auth/register-points-oauth-clients";

const expectedOperations = [
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
].sort();

describe("Points OAuth contract", () => {
  it("separates USER, M2M and SETTLEMENT client grants and scopes", () => {
    expect(pointsOAuthClients.USER.grantTypes).toEqual(["authorization_code", "refresh_token"]);
    expect(pointsOAuthClients.M2M.grantTypes).toEqual(["client_credentials"]);
    expect(pointsOAuthClients.SETTLEMENT.grantTypes).toEqual(["authorization_code"]);
    expect(pointsOAuthClients.USER.subjectType).toBe("pairwise");
    expect(pointsOAuthClients.SETTLEMENT.subjectType).toBe("pairwise");
    expect(pointsOAuthClients.M2M.subjectType).toBeUndefined();

    const groups = Object.values(pointsOAuthScopes).map((scopes) => new Set(scopes));
    for (let left = 0; left < groups.length; left += 1) {
      for (let right = left + 1; right < groups.length; right += 1) {
        expect([...groups[left]!].filter((scope) => groups[right]!.has(scope))).toEqual([]);
      }
    }
  });

  it("uses the standard opaque OAuth Provider configuration", () => {
    const plugin = createPointsOAuthProvider({
      APP_ORIGIN: "https://points.example.test",
      MARKETS_SETTLEMENT_RETRY_RESOURCE: "https://markets.example.test/api/settlements/retry",
      POINTS_OAUTH_PAIRWISE_SECRET: "pairwise-secret-at-least-32-characters",
    });
    expect(plugin.id).toBe("oauth-provider");
    expect(plugin.options).toMatchObject({
      allowDynamicClientRegistration: false,
      consentPage: "/oauth/consent",
      disableJwtPlugin: true,
      grantTypes: ["authorization_code", "refresh_token", "client_credentials"],
      loginPage: "/login",
      pairwiseSecret: "pairwise-secret-at-least-32-characters",
    });
  });

  it("requires a link attempt only for the initial user connection flow", () => {
    expect(
      requiresPointsLinkAttemptBinding("openid points.connection.read points.balance.read"),
    ).toBe(true);
    expect(requiresPointsLinkAttemptBinding("points.connection.unlink")).toBe(false);
    expect(requiresPointsLinkAttemptBinding("points.admin.settlement.retry")).toBe(false);
  });

  it("opens standard dynamic registration only while the bootstrap token exists", async () => {
    const bootstrapToken = crypto.randomUUID();
    const plugin = createPointsOAuthProvider({
      APP_ORIGIN: "https://points.example.test",
      MARKETS_SETTLEMENT_RETRY_RESOURCE: "https://markets.example.test/api/settlements/retry",
      POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN: bootstrapToken,
      POINTS_OAUTH_PAIRWISE_SECRET: "pairwise-secret-at-least-32-characters",
    });

    expect(plugin.options?.allowDynamicClientRegistration).toBe(true);
    expect(
      await plugin.options?.validateInitialAccessToken?.({
        clientMetadata: {},
        headers: new Headers(),
        initialAccessToken: bootstrapToken,
      }),
    ).toEqual({});
    expect(
      await plugin.options?.validateInitialAccessToken?.({
        clientMetadata: {},
        headers: new Headers(),
        initialAccessToken: crypto.randomUUID(),
      }),
    ).toBe(false);

    expect(
      pointsOAuthBootstrapRegistrations({
        marketsOrigin: "https://markets.example.test",
        pointsResource: "https://points.example.test/api/v1",
        settlementResource: "https://markets.example.test/api/settlements/retry",
      }),
    ).toEqual([
      expect.objectContaining({
        grant_types: ["authorization_code", "refresh_token"],
        scope: pointsOAuthScopes.USER.join(" "),
        subject_type: "pairwise",
      }),
      expect.objectContaining({
        grant_types: ["client_credentials"],
        scope: pointsOAuthScopes.M2M.join(" "),
      }),
      expect.objectContaining({
        grant_types: ["authorization_code"],
        scope: pointsOAuthScopes.SETTLEMENT.join(" "),
        subject_type: "pairwise",
      }),
    ]);
  });

  it("keeps the generated interservice contract to exactly eleven operations", async () => {
    const openapi = JSON.parse(
      await readFile(
        path.resolve(process.cwd(), "../../docs/web-app/v0.2/points-markets.openapi.json"),
        "utf8",
      ),
    ) as { paths: Record<string, Record<string, { operationId?: string }>> };
    const operationIds = Object.values(openapi.paths)
      .flatMap((path) => Object.values(path))
      .map(({ operationId }) => operationId)
      .filter((operationId): operationId is string => operationId !== undefined)
      .sort();
    expect(operationIds).toEqual(expectedOperations);
    expect(
      Object.keys(openapi.paths).some(
        (path) =>
          /\/profiles|\/search|\/evaluation-criteria|\/point-packages\//.test(path) &&
          !path.includes("point-package-revisions"),
      ),
    ).toBe(false);
  });
});
