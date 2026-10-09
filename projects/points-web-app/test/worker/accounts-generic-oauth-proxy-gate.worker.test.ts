import { createAuthMiddleware, getOAuthState, addOAuthServerContext } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { genericOAuth, oAuthProxy } from "better-auth/plugins";
import { expect, it, vi } from "vitest";

it("公開 plugin.init で読み取った接続先を Generic OAuth に登録できる", async () => {
  const readConnections = vi.fn(async () => [
    {
      providerId: "accounts-connection-1",
      clientId: "accounts-client",
      authorizationUrl: "https://accounts.example/oauth2/authorize",
      tokenUrl: "https://accounts.example/oauth2/token",
    },
  ]);
  const auth = betterAuth({
    baseURL: "https://preview.example",
    secret: "test-secret-with-at-least-thirty-two-characters",
    plugins: [
      {
        id: "dynamic-accounts-provider-gate",
        async init(context) {
          return genericOAuth({ config: await readConnections() }).init(context);
        },
      },
    ],
  });
  const context = await auth.$context;
  expect(readConnections).toHaveBeenCalledOnce();
  expect(context.socialProviders.some((provider) => provider.id === "accounts-connection-1")).toBe(
    true,
  );
});

it("Generic OAuth の公開 getToken に Proxy と同じ codeVerifier が渡る", async () => {
  const getToken = vi.fn(
    async (_data: { code: string; redirectURI: string; codeVerifier?: string }) => ({
      accessToken: "access-token",
      tokenType: "dpop" as const,
    }),
  );
  const auth = betterAuth({
    baseURL: "https://staging.example",
    secret: "test-secret-with-at-least-thirty-two-characters",
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: "accounts-test",
            clientId: "accounts-client",
            authorizationUrl: "https://accounts.example/oauth2/authorize",
            getToken,
          },
        ],
      }),
    ],
  });
  const context = await auth.$context;
  const provider = context.socialProviders.find((candidate) => candidate.id === "accounts-test");
  expect(provider).toBeDefined();
  await provider!.validateAuthorizationCode({
    code: "authorization-code",
    redirectURI: "https://staging.example/api/auth/callback/accounts-test",
    codeVerifier: "stored-code-verifier",
  });
  expect(getToken).toHaveBeenCalledWith({
    code: "authorization-code",
    redirectURI: "https://staging.example/api/auth/callback/accounts-test",
    codeVerifier: "stored-code-verifier",
  });
});

it("公開 hook は Proxy 開始時に nonce・PKCE verifier・本人識別子を取得できる", async () => {
  const observed: Array<Awaited<ReturnType<typeof getOAuthState>>> = [];
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input) === "https://accounts.example/.well-known/openid-configuration") {
      return Response.json({
        issuer: "https://accounts.example",
        authorization_endpoint: "https://accounts.example/oauth2/authorize",
        token_endpoint: "https://accounts.example/oauth2/token",
        jwks_uri: "https://accounts.example/oauth2/jwks",
        id_token_signing_alg_values_supported: ["EdDSA"],
      });
    }
    throw new Error(`unexpected fetch: ${String(input)}`);
  });

  try {
    const auth = betterAuth({
      baseURL: "https://preview.example",
      secret: "test-secret-with-at-least-thirty-two-characters",
      account: { storeStateStrategy: "cookie" },
      hooks: {
        before: createAuthMiddleware(async (ctx) => {
          if (ctx.path === "/sign-in/social" && ctx.body?.provider === "accounts-test") {
            await addOAuthServerContext({ pointsUserId: "points-user-1" });
          }
        }),
        after: createAuthMiddleware(async (ctx) => {
          if (ctx.path === "/sign-in/social" && ctx.body?.provider === "accounts-test") {
            observed.push(await getOAuthState());
          }
        }),
      },
      plugins: [
        genericOAuth({
          config: [
            {
              providerId: "accounts-test",
              clientId: "accounts-client",
              discoveryUrl: "https://accounts.example/.well-known/openid-configuration",
              requireIdTokenVerification: true,
            },
          ],
        }),
        oAuthProxy({
          productionURL: "https://staging.example",
          secret: "shared-proxy-secret-with-at-least-32-characters",
        }),
      ],
    });

    const response = await auth.handler(
      new Request("https://preview.example/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://preview.example" },
        body: JSON.stringify({ provider: "accounts-test", disableRedirect: true }),
      }),
    );
    expect(response.status).toBe(200);
    expect(observed).toHaveLength(1);
    const state = observed[0];
    expect(state?.idTokenNonce).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(state?.codeVerifier).toMatch(/^[A-Za-z0-9_-]{128}$/);
    expect(state?.serverContext).toMatchObject({ pointsUserId: "points-user-1" });
    const result = (await response.json()) as { url: string };
    expect(new URL(result.url).searchParams.get("nonce")).toBe(state?.idTokenNonce);
  } finally {
    fetchMock.mockRestore();
  }
});
