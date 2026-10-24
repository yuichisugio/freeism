import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { Bindings } from "../../src/backend/http/context";
import { openPointsProvider } from "../../src/backend/points/points-provider-context";
import { discoverPointsProvider } from "../../src/backend/points/points-provider-discovery";
import {
  generatePointsProviderKey,
  importPointsKeyEncryptionKey,
  sealPointsProviderKey,
} from "../../src/backend/points/points-provider-keys";

afterEach(() => vi.unstubAllGlobals());

describe("saved Points provider context", () => {
  it("rejects a stopped provider for new work and opens it for existing work", async () => {
    const providerId = `ppr_${crypto.randomUUID()}`;
    const origin = "https://stopped-points.example.test";
    const kek = await importPointsKeyEncryptionKey(env.POINTS_KEY_ENCRYPTION_KEY);
    const [signing, dpop] = await Promise.all([
      generatePointsProviderKey(),
      generatePointsProviderKey(),
    ]);
    await env
      .DB!.prepare(
        `INSERT INTO points_provider
       (id, display_name, origin, issuer, resource, client_id, client_public_jwk,
        signing_key_ciphertext, dpop_key_ciphertext, status)
       VALUES (?, 'Stopped provider', ?, ?, ?, 'markets-client', ?, ?, ?, 'STOPPED')`,
      )
      .bind(
        providerId,
        origin,
        origin,
        `${origin}/api/v1`,
        JSON.stringify(signing.publicJwk),
        await sealPointsProviderKey(kek, providerId, "client-assertion", signing.privateJwk),
        await sealPointsProviderKey(kek, providerId, "dpop", dpop.privateJwk),
      )
      .run();

    await expect(openPointsProvider(env as Bindings, providerId)).rejects.toThrow(
      "POINTS_PROVIDER_NOT_ACTIVE",
    );

    const pointsScopes = [
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
      jwks_uri: `${origin}/jwks`,
      introspection_endpoint: `${origin}/oauth2/introspect`,
      revocation_endpoint: `${origin}/oauth2/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
      token_endpoint_auth_methods_supported: ["private_key_jwt"],
      token_endpoint_auth_signing_alg_values_supported: ["EdDSA"],
      dpop_signing_alg_values_supported: ["EdDSA"],
      id_token_signing_alg_values_supported: ["EdDSA"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["openid", "profile", "offline_access", ...pointsScopes],
      authorization_response_iss_parameter_supported: true,
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      );
      const body = url.pathname.includes("oauth-protected-resource")
        ? {
            resource: `${origin}/api/v1`,
            authorization_servers: [origin],
            scopes_supported: pointsScopes,
            dpop_signing_alg_values_supported: ["EdDSA"],
            dpop_bound_access_tokens_required: true,
          }
        : metadata;
      return Response.json(body);
    });
    vi.stubGlobal("fetch", fetchMock);
    const opened = await openPointsProvider(env as Bindings, providerId, { allowStopped: true });
    expect(opened.provider.status).toBe("STOPPED");
    expect(opened.provider.id).toBe(providerId);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const unsafeMetadata = {
      ...metadata,
      introspection_endpoint: "https://other.example.test/introspect",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        );
        return Response.json(
          url.pathname.includes("oauth-protected-resource")
            ? {
                resource: `${origin}/api/v1`,
                authorization_servers: [origin],
                scopes_supported: pointsScopes,
                dpop_signing_alg_values_supported: ["EdDSA"],
                dpop_bound_access_tokens_required: true,
              }
            : unsafeMetadata,
        );
      }),
    );
    await expect(discoverPointsProvider(origin)).rejects.toThrow(
      "POINTS_PROVIDER_DISCOVERY_INVALID",
    );
  });
});
