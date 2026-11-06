import { describe, expect, it } from "vite-plus/test";

import resolveInvalidInput from "../../../test/fixtures/accounts/resolve-invalid-input.json";
import {
  createFakeAccounts,
  sampleExternalAccounts,
  type FakeAccounts,
} from "../../../test/support/fake-accounts";
import { discoverAccounts } from "./accounts-discovery";
import {
  generateAccountsSigningKey,
  importAccountsSigningKeyPair,
  toAccountsPublicJwks,
} from "./accounts-key-vault";
import {
  requestAccountsClientCredentialsToken,
  type AccountsOAuthContext,
} from "./accounts-oauth-client";
import {
  createAccountsResourceClient,
  type AccountsAccessTokenSource,
} from "./accounts-resource-client";
import { decodeBase64Url, encodeBase64Url } from "./base64url";

// --------------------------------------------------
// 準備
// --------------------------------------------------

/**
 * Client Credentialsのトークンを1つ保持するだけのtoken source。
 */
function createTestTokenSource(context: AccountsOAuthContext) {
  let accessToken: string | null = null;
  const calls = { get: 0, invalidate: 0 };
  const source: AccountsAccessTokenSource = {
    async get() {
      calls.get += 1;
      accessToken ??= (await requestAccountsClientCredentialsToken(context)).accessToken;
      return accessToken;
    },
    async invalidate() {
      calls.invalidate += 1;
      accessToken = null;
    },
  };
  return { source, calls };
}

async function setUp(tokenSource?: AccountsAccessTokenSource) {
  const accounts = await createFakeAccounts();
  const clientKey = await generateAccountsSigningKey();
  const dpopKey = await importAccountsSigningKeyPair(
    (await generateAccountsSigningKey()).privateJwk,
  );
  accounts.registerClient("points-client", toAccountsPublicJwks(clientKey.publicJwk));
  const endpoint = { accountsOrigin: accounts.origin, fetch: accounts.fetch };
  const context: AccountsOAuthContext = {
    endpoint,
    authorizationServer: await discoverAccounts(endpoint),
    client: {
      clientId: "points-client",
      clientKey: await importAccountsSigningKeyPair(clientKey.privateJwk),
      dpopKey,
    },
  };
  const { source, calls } = createTestTokenSource(context);
  const client = createAccountsResourceClient({
    endpoint,
    dpopKey,
    accessTokenSource: tokenSource ?? source,
  });
  accounts.requests.length = 0;
  return { accounts, client, calls };
}

function resourceRequests(accounts: FakeAccounts) {
  return accounts.requests.filter(({ url }) => new URL(url).pathname.startsWith("/api/v1/"));
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const [, payload = ""] = jwt.split(".");
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as Record<string, unknown>;
}

const urlIdentifier = { type: "url", url: "https://example.org/alice" } as const;

// --------------------------------------------------
// 一覧取得
// --------------------------------------------------

describe("listExternalAccounts", () => {
  it("提供された外部アカウントを返す", async () => {
    const { accounts, client } = await setUp();
    accounts.setList((accountsUserId) =>
      accountsUserId === "ausr_owner" ? sampleExternalAccounts() : null,
    );

    await expect(client.listExternalAccounts("ausr_owner")).resolves.toEqual({
      status: "PROVIDED",
      externalAccounts: sampleExternalAccounts(),
    });
  });

  it("HTTP QUERYでJSON bodyとDPoP付きのAccess Tokenを送る", async () => {
    const { accounts, client } = await setUp();
    accounts.setList(() => []);

    await client.listExternalAccounts("ausr_owner");

    const [request] = resourceRequests(accounts);
    const accessToken = request?.headers.get("Authorization")?.replace(/^DPoP /, "") ?? "";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken));
    expect(request).toMatchObject({
      method: "QUERY",
      url: `${accounts.origin}/api/v1/external-accounts`,
      body: JSON.stringify({ accountsUserId: "ausr_owner" }),
    });
    expect(request?.headers.get("Content-Type")).toBe("application/json");
    expect(request?.headers.get("Authorization")).toMatch(/^DPoP .+/);
    expect(decodeJwtPayload(request?.headers.get("DPoP") ?? "")).toEqual({
      iat: expect.any(Number),
      jti: expect.any(String),
      htm: "QUERY",
      htu: `${accounts.origin}/api/v1/external-accounts`,
      ath: encodeBase64Url(new Uint8Array(digest)),
    });
  });

  it("404（対象なし・同意OFF・ban・退会）をNOT_PROVIDEDにする", async () => {
    const { client } = await setUp();

    await expect(client.listExternalAccounts("ausr_owner")).resolves.toEqual({
      status: "NOT_PROVIDED",
    });
  });

  it("NOT_FOUNDのエラー本文でない404はINVALID_RESPONSEにする", async () => {
    const { accounts, client } = await setUp();
    accounts.interceptNext(
      "/api/v1/external-accounts",
      new Response("<html>not found</html>", { status: 404 }),
    );

    await expect(client.listExternalAccounts("ausr_owner")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("要求と異なるaccountsUserId・accountsOriginの応答をINVALID_RESPONSEにする", async () => {
    const { accounts, client } = await setUp();

    accounts.interceptNext(
      "/api/v1/external-accounts",
      Response.json({
        accountsOrigin: accounts.origin,
        accountsUserId: "ausr_other",
        externalAccounts: [],
      }),
    );
    await expect(client.listExternalAccounts("ausr_owner")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    accounts.interceptNext(
      "/api/v1/external-accounts",
      Response.json({
        accountsOrigin: "https://other.example.test",
        accountsUserId: "ausr_owner",
        externalAccounts: [],
      }),
    );
    await expect(client.listExternalAccounts("ausr_owner")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});

// --------------------------------------------------
// 照合
// --------------------------------------------------

describe("resolveIdentifiers", () => {
  it("入力順の照合結果を返す", async () => {
    const { accounts, client } = await setUp();
    accounts.setResolve((identifier) =>
      JSON.stringify(identifier) === JSON.stringify(urlIdentifier)
        ? { status: "matched", accountsUserId: "ausr_owner" }
        : { status: "no_match" },
    );
    const identifiers = [
      urlIdentifier,
      { type: "accounts_user", accountsUserId: "ausr_unknown" },
    ] as const;

    await expect(client.resolveIdentifiers([...identifiers])).resolves.toEqual([
      {
        index: 0,
        identifier: urlIdentifier,
        status: "matched",
        accountsUserId: "ausr_owner",
        errors: [],
      },
      {
        index: 1,
        identifier: identifiers[1],
        status: "no_match",
        accountsUserId: null,
        errors: [],
      },
    ]);
    expect(resourceRequests(accounts)).toEqual([
      expect.objectContaining({ method: "QUERY", body: JSON.stringify({ identifiers }) }),
    ]);
  });

  it("1,000件を分割せずに1回で送り、1,001件は送らずに拒否する", async () => {
    const { accounts, client } = await setUp();
    const identifiers = Array.from({ length: 1000 }, (_, index) => ({
      type: "url" as const,
      url: `https://example.org/${index}`,
    }));

    await expect(client.resolveIdentifiers(identifiers)).resolves.toHaveLength(1000);
    await expect(client.resolveIdentifiers([...identifiers, urlIdentifier])).rejects.toThrow(
      RangeError,
    );
    expect(resourceRequests(accounts)).toHaveLength(1);
  });

  it("入力不備を含む400は、入力ごとの結果として返す", async () => {
    const { accounts, client } = await setUp();
    accounts.interceptNext(
      "/api/v1/identities/resolve",
      Response.json(resolveInvalidInput, { status: 400 }),
    );

    const results = await client.resolveIdentifiers([
      { type: "accounts_user", accountsUserId: "ausr_sample" },
      { type: "url", url: "https://example.org/unlinked/" },
      { type: "url", url: "https://example.org:8443/" },
    ]);

    expect(results.map(({ status }) => status)).toEqual(["matched", "no_match", "invalid_input"]);
  });

  it.each([
    [
      "要求全体の400",
      Response.json(
        { errors: [{ code: "INVALID_VALUE", message: "invalid", path: ["identifiers"] }] },
        { status: 400 },
      ),
      "REQUEST_INVALID",
      null,
    ],
    [
      "415",
      Response.json(
        { errors: [{ code: "UNSUPPORTED_MEDIA_TYPE", message: "invalid", path: null }] },
        { status: 415 },
      ),
      "REQUEST_INVALID",
      null,
    ],
    [
      "403",
      Response.json(
        { errors: [{ code: "INSUFFICIENT_SCOPE", message: "forbidden", path: null }] },
        { status: 403, headers: { "WWW-Authenticate": 'DPoP error="insufficient_scope"' } },
      ),
      "FORBIDDEN",
      null,
    ],
    [
      "404",
      Response.json(
        { errors: [{ code: "NOT_FOUND", message: "not found", path: null }] },
        { status: 404 },
      ),
      "INVALID_RESPONSE",
      null,
    ],
    ["413", new Response(null, { status: 413 }), "PAYLOAD_TOO_LARGE", null],
    [
      "WAFの429",
      new Response("<html>rate limited</html>", { status: 429, headers: { "Retry-After": "120" } }),
      "RATE_LIMITED",
      "120",
    ],
    [
      "500",
      Response.json(
        { errors: [{ code: "INTERNAL_SERVER_ERROR", message: "failed", path: null }] },
        { status: 500 },
      ),
      "UNAVAILABLE",
      null,
    ],
    ["503", new Response(null, { status: 503 }), "UNAVAILABLE", null],
    ["通信失敗", "network" as const, "NETWORK_ERROR", null],
    ["JSONでない200", new Response("<html>", { status: 200 }), "INVALID_RESPONSE", null],
    [
      "schemaに合わない200",
      Response.json({ accountsOrigin: "https://accounts.example.test", results: [{ index: 0 }] }),
      "INVALID_RESPONSE",
      null,
    ],
    [
      "accountsOriginの不一致",
      Response.json({
        accountsOrigin: "https://other.example.test",
        results: [
          {
            index: 0,
            identifier: urlIdentifier,
            status: "no_match",
            accountsUserId: null,
            errors: [],
          },
        ],
      }),
      "INVALID_RESPONSE",
      null,
    ],
    [
      "件数の不一致",
      Response.json({ accountsOrigin: "https://accounts.example.test", results: [] }),
      "INVALID_RESPONSE",
      null,
    ],
    [
      "indexの不一致",
      Response.json({
        accountsOrigin: "https://accounts.example.test",
        results: [
          {
            index: 1,
            identifier: urlIdentifier,
            status: "no_match",
            accountsUserId: null,
            errors: [],
          },
        ],
      }),
      "INVALID_RESPONSE",
      null,
    ],
  ])("%sを分類する", async (_, interception, code, retryAfter) => {
    const { accounts, client } = await setUp();
    accounts.interceptNext("/api/v1/identities/resolve", interception);

    await expect(client.resolveIdentifiers([urlIdentifier])).rejects.toMatchObject({
      code,
      retryAfter,
    });
  });
});

// --------------------------------------------------
// 認証の失敗とDPoP-Nonce
// --------------------------------------------------

describe("Access Tokenの再取得", () => {
  it("401ではトークンを破棄して1回だけ再取得・再送する", async () => {
    const { accounts, client, calls } = await setUp();
    await client.resolveIdentifiers([urlIdentifier]);
    accounts.revokeAccessTokens();

    await expect(client.resolveIdentifiers([urlIdentifier])).resolves.toHaveLength(1);
    const [first, rejected, retried] = resourceRequests(accounts).map(({ headers }) =>
      headers.get("Authorization"),
    );
    expect(calls.invalidate).toBe(1);
    expect(rejected).toBe(first);
    expect(retried).not.toBe(first);
  });

  it("再送しても401ならCLIENT_UNAUTHORIZEDにする", async () => {
    let invalidated = 0;
    const { accounts, client } = await setUp({
      get: async () => "revoked-token",
      invalidate: async () => {
        invalidated += 1;
      },
    });

    await expect(client.resolveIdentifiers([urlIdentifier])).rejects.toMatchObject({
      code: "CLIENT_UNAUTHORIZED",
    });
    expect(invalidated).toBe(1);
    expect(resourceRequests(accounts)).toHaveLength(2);
  });

  it("DPoP-Nonceを要求された場合は、nonce付きのproofで送り直す", async () => {
    const { accounts, client } = await setUp();
    accounts.requireDpopNonce("server-nonce");

    await expect(client.resolveIdentifiers([urlIdentifier])).resolves.toHaveLength(1);

    const proofs = resourceRequests(accounts).map(({ headers }) =>
      decodeJwtPayload(headers.get("DPoP") ?? ""),
    );
    expect(proofs).toHaveLength(2);
    expect(proofs[1]).toMatchObject({ nonce: "server-nonce", htm: "QUERY" });
  });
});
