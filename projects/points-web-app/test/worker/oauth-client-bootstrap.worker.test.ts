import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createPointsAuth } from "../../src/backend/auth/create-auth";
import {
  registerPointsOAuthClients,
  type RegisteredPointsOAuthClients,
} from "../../src/backend/auth/register-points-oauth-clients";
import { pointsOAuthScopes } from "../../src/backend/auth/points-oauth-provider";
import type { Bindings } from "../../src/backend/http/context";

const db = env.DB!;
const pointsOrigin = "http://localhost:3000";
const marketsOrigin = "https://markets.example.test";

describe("Points OAuth client bootstrap", () => {
  beforeEach(async () => {
    await db.exec(
      "DELETE FROM oauth_client_resource; DELETE FROM oauth_client; DELETE FROM oauth_resource;",
    );
  });

  it("registers the three clients and their resource links through standard registration", async () => {
    const bootstrapToken = crypto.randomUUID();
    const auth = createPointsAuth({
      ...(env as Bindings),
      POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN: bootstrapToken,
    });
    const persistedKinds: string[] = [];

    const clients = await registerPointsOAuthClients({
      bootstrapToken,
      fetch: (request) => auth.handler(request),
      marketsOrigin,
      onRegistered: async (kind, client) => {
        expect(client.clientId).toBeTruthy();
        expect(client.clientSecret).toBeTruthy();
        persistedKinds.push(kind);
      },
      pointsOrigin,
      settlementResource: `${marketsOrigin}/api/settlements/retry`,
    });
    expect(persistedKinds).toEqual(["USER", "M2M", "SETTLEMENT"]);

    const rows = await db
      .prepare(
        `SELECT client_id AS clientId, client_secret AS clientSecret, grant_types AS grantTypes,
                scopes, subject_type AS subjectType
           FROM oauth_client
          ORDER BY name`,
      )
      .all<{
        clientId: string;
        clientSecret: string;
        grantTypes: string;
        scopes: string;
        subjectType: string | null;
      }>();

    expect(rows.results).toHaveLength(3);
    const decodeStoredArray = (value: string) => {
      const decoded: unknown = JSON.parse(value);
      return typeof decoded === "string" ? JSON.parse(decoded) : decoded;
    };
    expect(rows.results.map((row) => decodeStoredArray(row.grantTypes))).toEqual([
      ["client_credentials"],
      ["authorization_code"],
      ["authorization_code", "refresh_token"],
    ]);
    expect(rows.results.map((row) => decodeStoredArray(row.scopes))).toEqual([
      [...pointsOAuthScopes.M2M],
      [...pointsOAuthScopes.SETTLEMENT],
      [...pointsOAuthScopes.USER],
    ]);
    expect(rows.results.map((row) => row.subjectType)).toEqual(["public", "pairwise", "pairwise"]);

    const registered = Object.values(
      clients,
    ) as RegisteredPointsOAuthClients[keyof RegisteredPointsOAuthClients][];
    expect(
      registered.every(
        ({ clientId, clientSecret }) => clientId.length > 0 && clientSecret.length > 0,
      ),
    ).toBe(true);
    expect(
      rows.results.every(
        (row) =>
          registered.some(({ clientId }) => clientId === row.clientId) &&
          registered.every(({ clientSecret }) => clientSecret !== row.clientSecret),
      ),
    ).toBe(true);

    const links = await db
      .prepare(
        `SELECT client_id AS clientId, resource_id AS resourceId
           FROM oauth_client_resource
          ORDER BY client_id`,
      )
      .all<{ clientId: string; resourceId: string }>();
    expect(links.results.map(({ resourceId }) => resourceId).sort()).toEqual(
      [
        `${pointsOrigin}/api/v1`,
        `${pointsOrigin}/api/v1`,
        `${marketsOrigin}/api/settlements/retry`,
      ].sort(),
    );

    const m2mTokenResponse = await auth.handler(
      new Request(`${pointsOrigin}/api/auth/oauth2/token`, {
        body: new URLSearchParams({
          grant_type: "client_credentials",
          resource: `${pointsOrigin}/api/v1`,
          scope: "points.reservations.status",
        }),
        headers: {
          Authorization: `Basic ${btoa(`${clients.M2M.clientId}:${clients.M2M.clientSecret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      }),
    );
    expect(m2mTokenResponse.status).toBe(200);
    const m2mToken = (await m2mTokenResponse.json()) as {
      access_token: string;
      scope: string;
    };
    expect(m2mToken.access_token.split(".")).toHaveLength(1);
    expect(m2mToken.scope).toBe("points.reservations.status");
  });

  it("rejects registration after bootstrap mode is removed", async () => {
    const auth = createPointsAuth(env as Bindings);
    const response = await auth.handler(
      new Request(`${pointsOrigin}/api/auth/oauth2/register`, {
        body: JSON.stringify({ client_name: "must-not-register" }),
        headers: {
          Authorization: `Bearer ${crypto.randomUUID()}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM oauth_client").first<{ count: number }>(),
    ).toEqual({ count: 0 });
  });

  it("persists each credential before attempting the next registration", async () => {
    let calls = 0;
    const persisted: string[] = [];
    await expect(
      registerPointsOAuthClients({
        bootstrapToken: crypto.randomUUID(),
        fetch: async () => {
          calls += 1;
          if (calls === 2) return new Response(null, { status: 500 });
          return Response.json({
            client_id: `client-${calls}`,
            client_secret: `secret-${calls}`,
          });
        },
        marketsOrigin,
        onRegistered: async (kind) => {
          persisted.push(kind);
        },
        pointsOrigin,
        settlementResource: `${marketsOrigin}/api/settlements/retry`,
      }),
    ).rejects.toThrow("OAuth client registration failed with status 500");
    expect(persisted).toEqual(["USER"]);
  });
});
