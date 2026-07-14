import { describe, expect, it } from "vite-plus/test";

import {
  bootstrapStagingOAuthClients,
  type WranglerInvocation,
} from "../../scripts/bootstrap-oauth-clients";

const pointsOrigin = "https://staging.points.freeism.app";
const pointsConfigPath = "/repo/points/wrangler.jsonc";
const marketsConfigPath = "/repo/markets/wrangler.jsonc";

describe("staging OAuth client bootstrap runner", () => {
  it("saves each registered credential to both Workers through stdin, removes bootstrap mode, then verifies 403", async () => {
    const credentials = [
      { client_id: "user-client-id", client_secret: "user-client-secret" },
      { client_id: "m2m-client-id", client_secret: "m2m-client-secret" },
      { client_id: "settlement-client-id", client_secret: "settlement-client-secret" },
    ];
    const requests: Request[] = [];
    const invocations: WranglerInvocation[] = [];
    const events: string[] = [];

    const result = await bootstrapStagingOAuthClients({
      bootstrapToken: "bootstrap-token",
      fetch: async (request) => {
        requests.push(request.clone());
        if (requests.length <= credentials.length) {
          events.push(`register:${requests.length}`);
          return Response.json(credentials[requests.length - 1]);
        }
        events.push("verify:403");
        return new Response(null, { status: 403 });
      },
      marketsConfigPath,
      pointsConfigPath,
      runWrangler: (invocation) => {
        invocations.push(invocation);
        const values = JSON.parse(invocation.stdin) as Record<string, string | null>;
        events.push(
          values.POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN === null
            ? "delete:bootstrap-token"
            : `save:${invocation.configPath}:${Object.keys(values)[0]}`,
        );
      },
    });

    expect(result).toBeUndefined();
    expect(requests).toHaveLength(4);
    expect(requests.slice(0, 3).map((request) => request.url)).toEqual([
      `${pointsOrigin}/api/auth/oauth2/register`,
      `${pointsOrigin}/api/auth/oauth2/register`,
      `${pointsOrigin}/api/auth/oauth2/register`,
    ]);
    expect(requests[3]!.url).toBe(`${pointsOrigin}/api/auth/oauth2/register`);
    expect(await requests[3]!.json()).toEqual(await requests[0]!.json());
    expect(events.at(-2)).toBe("delete:bootstrap-token");
    expect(events.at(-1)).toBe("verify:403");

    expect(invocations).toHaveLength(7);
    expect(invocations.map(({ configPath }) => configPath)).toEqual([
      pointsConfigPath,
      marketsConfigPath,
      pointsConfigPath,
      marketsConfigPath,
      pointsConfigPath,
      marketsConfigPath,
      pointsConfigPath,
    ]);
    expect(invocations.map(({ stdin }) => JSON.parse(stdin))).toEqual([
      {
        MARKETS_USER_OAUTH_CLIENT_ID: "user-client-id",
        MARKETS_USER_OAUTH_CLIENT_SECRET: "user-client-secret",
      },
      {
        POINTS_USER_CLIENT_ID: "user-client-id",
        POINTS_USER_CLIENT_SECRET: "user-client-secret",
      },
      {
        MARKETS_M2M_OAUTH_CLIENT_ID: "m2m-client-id",
        MARKETS_M2M_OAUTH_CLIENT_SECRET: "m2m-client-secret",
      },
      {
        POINTS_M2M_CLIENT_ID: "m2m-client-id",
        POINTS_M2M_CLIENT_SECRET: "m2m-client-secret",
      },
      {
        MARKETS_SETTLEMENT_OAUTH_CLIENT_ID: "settlement-client-id",
        MARKETS_SETTLEMENT_OAUTH_CLIENT_SECRET: "settlement-client-secret",
      },
      {
        POINTS_SETTLEMENT_CLIENT_ID: "settlement-client-id",
        POINTS_SETTLEMENT_CLIENT_SECRET: "settlement-client-secret",
      },
      { POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN: null },
    ]);

    const secretValues = credentials.flatMap(({ client_id, client_secret }) => [
      client_id,
      client_secret,
    ]);
    for (const invocation of invocations) {
      expect(invocation.args).toEqual([
        "secret",
        "bulk",
        "--config",
        invocation.configPath,
        "--env",
        "staging",
      ]);
      for (const secretValue of secretValues) {
        expect(invocation.args).not.toContain(secretValue);
      }
    }
  });

  it("does not retry a failed registration request", async () => {
    let registrationRequests = 0;
    const invocations: WranglerInvocation[] = [];

    await expect(
      bootstrapStagingOAuthClients({
        bootstrapToken: "bootstrap-token",
        fetch: async () => {
          registrationRequests += 1;
          return new Response(null, { status: 503 });
        },
        marketsConfigPath,
        pointsConfigPath,
        runWrangler: (invocation) => invocations.push(invocation),
      }),
    ).rejects.toThrow("OAuth client registration failed with status 503");

    expect(registrationRequests).toBe(1);
    expect(invocations).toEqual([]);
  });
});
