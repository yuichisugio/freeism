import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { pointsBackendApp } from "../../src/backend/app";
import type { Bindings } from "../../src/backend/http/context";

const origin = "http://localhost:3000";
const resource = `${origin}/api/v1`;

describe("Points OAuth discovery", () => {
  it("publishes one origin issuer and a DPoP protected resource", async () => {
    const paths = [
      "/.well-known/openid-configuration",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource/api/v1",
    ];
    const responses = [];
    for (const path of paths) {
      responses.push(await pointsBackendApp.request(`${origin}${path}`, {}, env as Bindings));
    }
    for (const response of responses) expect(response.status).toBe(200);
    const [openid, authorization, protectedResource] = await Promise.all(
      responses.map((response) => response.json() as Promise<Record<string, unknown>>),
    );
    expect(openid).toMatchObject({
      issuer: origin,
      token_endpoint: `${origin}/api/auth/oauth2/token`,
    });
    expect(authorization).toMatchObject({
      issuer: origin,
      token_endpoint: `${origin}/api/auth/oauth2/token`,
    });
    expect(protectedResource).toMatchObject({
      resource,
      authorization_servers: [origin],
      dpop_bound_access_tokens_required: true,
    });
    expect(authorization!.dpop_signing_alg_values_supported).toContain("EdDSA");
  });
});
