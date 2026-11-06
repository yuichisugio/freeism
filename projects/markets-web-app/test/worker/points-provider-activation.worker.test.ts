import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { Bindings } from "../../src/backend/http/context";
import {
  activatePointsProvider,
  createPointsProvider,
} from "../../src/backend/points/manage-points-providers";

afterEach(() => vi.unstubAllGlobals());

describe("Points provider registration", () => {
  it("activates only after a real private_key_jwt and DPoP client credentials exchange", async () => {
    const origin = "https://registrable-points.example.test";
    const authUserId = `auth_${crypto.randomUUID()}`;
    const marketsUserId = `musr_${crypto.randomUUID()}`;
    await env.DB!.batch([
      env
        .DB!.prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)")
        .bind(authUserId, "Registry admin", `${authUserId}@example.test`),
      env
        .DB!.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)")
        .bind(marketsUserId, authUserId),
    ]);

    const scopes = [
      "points.connection.read",
      "points.balance.read",
      "points.reservations.create",
      "points.connection.unlink",
      "points.connection.link-attempt.create",
      "points.connection.link-attempt.finalize",
      "points.packages.auction-eligibility",
      "points.reservations.status",
      "points.reservations.capture",
      "points.reservations.release",
    ];
    const metadata = {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth2/authorize`,
      token_endpoint: `${origin}/oauth2/token`,
      introspection_endpoint: `${origin}/oauth2/introspect`,
      revocation_endpoint: `${origin}/oauth2/revoke`,
      jwks_uri: `${origin}/jwks`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
      token_endpoint_auth_methods_supported: ["private_key_jwt"],
      token_endpoint_auth_signing_alg_values_supported: ["EdDSA"],
      dpop_signing_alg_values_supported: ["EdDSA"],
      id_token_signing_alg_values_supported: ["EdDSA"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["openid", "profile", "offline_access", ...scopes],
      authorization_response_iss_parameter_supported: true,
    };
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        );
        requests.push(url.pathname);
        if (url.pathname === "/oauth2/token") {
          return Response.json({
            access_token: "opaque-access",
            token_type: "DPoP",
            expires_in: 3600,
            scope: "points.reservations.status",
          });
        }
        if (url.pathname === "/oauth2/introspect") {
          return Response.json({
            active: true,
            iss: origin,
            aud: `${origin}/api/v1`,
            client_id: "markets-client",
            sub: "markets-client",
            exp: Math.floor(Date.now() / 1000) + 3600,
            scope: "points.reservations.status",
          });
        }
        if (url.pathname.includes("oauth-protected-resource")) {
          return Response.json({
            resource: `${origin}/api/v1`,
            authorization_servers: [origin],
            scopes_supported: scopes,
            dpop_signing_alg_values_supported: ["EdDSA"],
            dpop_bound_access_tokens_required: true,
          });
        }
        return Response.json(metadata);
      }),
    );

    const created = await createPointsProvider(env as Bindings, {
      origin,
      displayName: "Provider",
      reason: "登録",
      actorMarketsUserId: marketsUserId,
      requestId: "req_create",
    });
    expect(created.status).toBe("PENDING_CLIENT_REGISTRATION");
    expect(JSON.stringify(created)).not.toContain('"d":');
    const pending = await env
      .DB!.prepare("SELECT status FROM points_provider WHERE id = ?")
      .bind(created.providerId)
      .first<{ status: string }>();
    expect(pending?.status).toBe("PENDING_CLIENT_REGISTRATION");

    const activated = await activatePointsProvider(env as Bindings, {
      providerId: created.providerId,
      clientId: "markets-client",
      reason: "接続確認",
      actorMarketsUserId: marketsUserId,
      requestId: "req_activate",
    });
    expect(activated.status).toBe("ACTIVE");
    expect(requests).toContain("/oauth2/token");
    expect(requests).toContain("/oauth2/introspect");
  });
});
