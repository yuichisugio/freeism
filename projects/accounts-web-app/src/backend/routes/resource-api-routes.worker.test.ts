import { exports } from "cloudflare:workers";
import { deriveDpopJkt } from "better-auth/oauth2";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { testAuth } from "../../../test/auth-test-helpers";
import {
  createVerifiedUrlAccount,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import {
  fetchOAuthClients,
  generateTestKeyPair,
  loginAsNewUser,
  resourceApiIdentifier,
  testOrigin,
} from "../../../test/oauth-client-test-helpers";
import {
  createResourceApiCaller,
  fetchResourceApi,
  registerTestClient,
  saveVisibility,
  type ResourceApiCaller,
} from "../../../test/resource-api-test-helpers";
import { createRandomId } from "../db/id";
import {
  externalAccounts,
  externalAccountVerifications,
  externalIdentifiers,
  user,
  verificationIdentifiers,
} from "../db/schema";

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

/**
 * テストごとに重ならない、大文字を含むGitHubのユーザー名を作る。
 */
function uniqueLogin(): string {
  return `Alice${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
}

/**
 * 成功したOAuth証明と、失敗だけのリンク証明を持つGitHubの外部アカウントを作る。
 */
async function createGitHubAccount(userId: string, login = uniqueLogin()) {
  const accountId = createRandomId("eac_");
  const verifiedAt = new Date("2026-09-01T00:00:00Z");
  const identifiers = [
    { kind: "provider_account" as const, provider: "github", value: createRandomId("gh-") },
    { kind: "provider_username" as const, provider: "github", value: login.toLowerCase() },
    {
      kind: "url" as const,
      provider: "",
      value: `https://github.com/${login}`,
      host: "github.com",
    },
  ].map((identifier) => ({
    id: createRandomId("eid_"),
    accountId,
    userId,
    isActive: true,
    ...identifier,
  }));
  const oauthVerificationId = createRandomId("evf_");
  await testDb
    .insert(externalAccounts)
    .values({ id: accountId, userId, service: "github", displayName: login, linkedAt: verifiedAt });
  await testDb.insert(externalIdentifiers).values(identifiers);
  await testDb.insert(externalAccountVerifications).values([
    {
      id: oauthVerificationId,
      accountId,
      method: "oauth",
      evidenceKey: createRandomId(),
      verifiedAt,
      checkedAt: verifiedAt,
      result: "verified",
    },
    {
      id: createRandomId("evf_"),
      accountId,
      method: "bidirectional_link",
      evidenceKey: `https://github.com/${login}`,
      checkedAt: new Date("2026-09-02T00:00:00Z"),
      result: "not_verified",
      failureCode: "LINK_NOT_FOUND",
    },
  ]);
  await testDb.insert(verificationIdentifiers).values(
    identifiers.map((identifier) => ({
      verificationId: oauthVerificationId,
      identifierId: identifier.id,
    })),
  );
  const [accountIdentifier, usernameIdentifier] = identifiers;
  return {
    accountId,
    login,
    githubAccountId: accountIdentifier?.value ?? "",
    username: usernameIdentifier?.value ?? "",
  };
}

/**
 * 候補（未証明）のURLだけを持つ外部アカウントを作る。
 */
async function createCandidateAccount(userId: string, url: string) {
  const accountId = createRandomId("eac_");
  await testDb.insert(externalAccounts).values({ id: accountId, userId });
  await testDb.insert(externalIdentifiers).values({
    id: createRandomId("eid_"),
    accountId,
    userId,
    kind: "url",
    value: url,
    host: new URL(url).hostname,
  });
  return accountId;
}

/**
 * 連携サービスのクライアントを登録し、Access Tokenを取得する。
 */
async function setUpClient() {
  const developer = await loginAsNewUser();
  const { clientId, clientKey } = await registerTestClient(developer.headers);
  const caller = await createResourceApiCaller(clientId, clientKey);
  return { developer, clientId, caller };
}

let sharedClient: ReturnType<typeof setUpClient> | undefined;

/**
 * このファイルで共有するクライアント。
 * token endpointのレート制限に掛からないよう、Access Tokenの取得を1回にする。
 */
function getSharedClient() {
  sharedClient ??= setUpClient();
  return sharedClient;
}

/**
 * 共有のクライアントへ情報を提供するユーザーを用意する。
 * GitHubとWebページはクライアントへ公開し、別のWebページは公開せず、候補の行も公開選択だけ行う。
 */
async function setUpProvision() {
  const { developer, clientId, caller } = await getSharedClient();

  const owner = await loginAsNewUser();
  const github = await createGitHubAccount(owner.userId);
  const blogUrl = `https://${uniqueHost()}/about`;
  const { accountId: blogId } = await createVerifiedUrlAccount(
    owner.userId,
    [blogUrl],
    "dns_txt",
    new Date("2026-09-03T00:00:00Z"),
  );
  const hiddenUrl = `https://${uniqueHost()}/hidden`;
  await createVerifiedUrlAccount(owner.userId, [hiddenUrl], "bidirectional_link", new Date());
  const candidateUrl = `https://${uniqueHost()}/candidate`;
  const candidateId = await createCandidateAccount(owner.userId, candidateUrl);
  const saved = await saveVisibility(owner.headers, {
    clients: [
      { clientId, consented: true, visibleAccountIds: [github.accountId, blogId, candidateId] },
    ],
  });
  expect(saved.status).toBe(200);

  return {
    developer,
    clientId,
    caller,
    owner,
    github,
    blogId,
    blogUrl,
    hiddenUrl,
    candidateUrl,
  };
}

function listExternalAccounts(caller: ResourceApiCaller, accountsUserId: string) {
  return fetchResourceApi(caller, "/api/v1/external-accounts", { body: { accountsUserId } });
}

function resolve(caller: ResourceApiCaller, identifiers: unknown[]) {
  return fetchResourceApi(caller, "/api/v1/identities/resolve", { body: { identifiers } });
}

async function banUser(userId: string) {
  await testDb.update(user).set({ banned: true }).where(eq(user.id, userId));
}

// --------------------------------------------------
// 一覧取得
// --------------------------------------------------

describe("QUERY /api/v1/external-accounts", () => {
  it("問い合わせ元へ公開を選択した証明済みの外部アカウントを、有効な識別子と成功した証明だけで返す", async () => {
    const { caller, owner, github, blogUrl } = await setUpProvision();

    const response = await listExternalAccounts(caller, owner.userId);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const githubIdentifiers = [
      { type: "provider_account", provider: "github", accountId: github.githubAccountId },
      { type: "provider_username", provider: "github", username: github.username },
      { type: "url", url: `https://github.com/${github.login}` },
    ];
    expect(await response.json()).toEqual({
      accountsOrigin: testOrigin,
      accountsUserId: owner.userId,
      externalAccounts: [
        {
          service: "github",
          displayName: github.login,
          identifiers: githubIdentifiers,
          linkedAt: "2026-09-01T00:00:00.000Z",
          verificationStatus: "verified",
          verifications: [
            {
              method: "oauth",
              identifiers: githubIdentifiers,
              verifiedAt: "2026-09-01T00:00:00.000Z",
              checkedAt: "2026-09-01T00:00:00.000Z",
              result: "verified",
              evidenceUrl: null,
            },
          ],
        },
        {
          service: null,
          displayName: null,
          identifiers: [{ type: "url", url: blogUrl }],
          linkedAt: "2026-09-03T00:00:00.000Z",
          verificationStatus: "verified",
          verifications: [
            {
              method: "dns_txt",
              identifiers: [{ type: "url", url: blogUrl }],
              verifiedAt: "2026-09-03T00:00:00.000Z",
              checkedAt: "2026-09-03T00:00:00.000Z",
              result: "verified",
              evidenceUrl: null,
            },
          ],
        },
      ],
    });
  });

  it("証明を失った外部アカウントは返さず、提供対象が0件なら空配列を返す", async () => {
    const { caller, owner } = await setUpProvision();
    await testDb
      .update(externalIdentifiers)
      .set({ isActive: false })
      .where(eq(externalIdentifiers.userId, owner.userId));

    const response = await listExternalAccounts(caller, owner.userId);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ externalAccounts: [] });
  });

  it("存在しないユーザー・同意の無いユーザー・ban中のユーザーは同じ404にする", async () => {
    const { clientId, caller, owner, github } = await setUpProvision();
    const withdrawn = await loginAsNewUser();
    const { accountId } = await createVerifiedUrlAccount(
      withdrawn.userId,
      [`https://${uniqueHost()}/`],
      "dns_txt",
      new Date(),
    );
    await saveVisibility(withdrawn.headers, {
      clients: [{ clientId, consented: false, visibleAccountIds: [accountId] }],
    });
    const banned = await loginAsNewUser();
    await createGitHubAccount(banned.userId);
    await saveVisibility(banned.headers, {
      clients: [{ clientId, consented: true, visibleAccountIds: [github.accountId] }],
    });
    await banUser(owner.userId);

    const responses = await Promise.all(
      [createRandomId("ausr_"), withdrawn.userId, owner.userId].map((userId) =>
        listExternalAccounts(caller, userId),
      ),
    );

    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
    expect(bodies).toEqual([
      { errors: [{ code: "NOT_FOUND", message: expect.any(String), path: null }] },
      bodies[0],
      bodies[0],
    ]);
  });

  it("accountsUserIdの不足・未定義の項目は要求全体の400にする", async () => {
    const { caller } = await setUpProvision();

    const response = await fetchResourceApi(caller, "/api/v1/external-accounts", {
      body: { accountsUserID: "x" },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      errors: [
        { code: "MISSING_REQUIRED_FIELD", message: expect.any(String), path: ["accountsUserId"] },
        { code: "UNKNOWN_FIELD", message: expect.any(String), path: ["accountsUserID"] },
      ],
    });
  });
});

// --------------------------------------------------
// 照合
// --------------------------------------------------

describe("QUERY /api/v1/identities/resolve", () => {
  it("入力ごとに照合し、不正な入力があれば有効な入力の結果も含めて入力順に400で返す", async () => {
    const { caller, owner, github, blogUrl, hiddenUrl, candidateUrl } = await setUpProvision();
    const identifiers = [
      { type: "provider_account", provider: "github", accountId: github.githubAccountId },
      { type: "url", url: "https://example.org/unlinked/" },
      { type: "provider_account", provider: "github" },
      { type: "provider_username", provider: "github", username: github.login.toUpperCase() },
      { type: "url", url: `${blogUrl.replace("https://", "HTTPS://")}#section` },
      { type: "url", url: hiddenUrl },
      { type: "url", url: candidateUrl },
      { type: "accounts_user", accountsUserId: owner.userId },
      { type: "accounts_user", accountsUserId: createRandomId("ausr_") },
    ];

    const response = await resolve(caller, identifiers);

    expect(response.status).toBe(400);
    const matched = (index: number) => ({
      index,
      identifier: identifiers[index],
      status: "matched",
      accountsUserId: owner.userId,
      errors: [],
    });
    const noMatch = (index: number) => ({
      index,
      identifier: identifiers[index],
      status: "no_match",
      accountsUserId: null,
      errors: [],
    });
    expect(await response.json()).toEqual({
      accountsOrigin: testOrigin,
      results: [
        matched(0),
        noMatch(1),
        {
          index: 2,
          identifier: identifiers[2],
          status: "invalid_input",
          accountsUserId: null,
          errors: [
            {
              code: "MISSING_REQUIRED_FIELD",
              message: expect.any(String),
              path: ["identifiers", 2, "accountId"],
            },
          ],
        },
        matched(3),
        matched(4),
        noMatch(5),
        noMatch(6),
        matched(7),
        noMatch(8),
      ],
    });
  });

  it("すべての入力が有効なら200、空配列なら空のresultsを200で返す", async () => {
    const { caller, blogUrl } = await setUpProvision();

    const valid = await resolve(caller, [{ type: "url", url: blogUrl }]);
    const empty = await resolve(caller, []);

    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({ results: [{ status: "matched" }] });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ accountsOrigin: testOrigin, results: [] });
  });

  it("同意OFF・ban中のユーザーの識別子とAccountsユーザーIDは該当なしにする", async () => {
    const { clientId, caller, owner, github, blogId, blogUrl } = await setUpProvision();
    const other = await loginAsNewUser();
    const otherUrl = `https://${uniqueHost()}/`;
    const { accountId: otherAccountId } = await createVerifiedUrlAccount(
      other.userId,
      [otherUrl],
      "dns_txt",
      new Date(),
    );
    await saveVisibility(other.headers, {
      clients: [{ clientId, consented: true, visibleAccountIds: [otherAccountId] }],
    });
    await saveVisibility(owner.headers, {
      clients: [{ clientId, consented: false, visibleAccountIds: [github.accountId, blogId] }],
    });
    await banUser(other.userId);

    const response = await resolve(caller, [
      { type: "url", url: blogUrl },
      { type: "accounts_user", accountsUserId: owner.userId },
      { type: "url", url: otherUrl },
      { type: "accounts_user", accountsUserId: other.userId },
    ]);

    expect(response.status).toBe(200);
    const { results } = (await response.json()) as { results: { status: string }[] };
    expect(results.map((result) => result.status)).toEqual([
      "no_match",
      "no_match",
      "no_match",
      "no_match",
    ]);
  });

  it("別のクライアントへの同意・公開選択は、問い合わせ元のクライアントへの提供に使わない", async () => {
    const { owner, blogUrl } = await setUpProvision();
    const { caller: otherCaller } = await setUpClient();

    const listed = await listExternalAccounts(otherCaller, owner.userId);
    const resolved = await resolve(otherCaller, [
      { type: "url", url: blogUrl },
      { type: "accounts_user", accountsUserId: owner.userId },
    ]);

    expect(listed.status).toBe(404);
    const { results } = (await resolved.json()) as { results: { status: string }[] };
    expect(results.map((result) => result.status)).toEqual(["no_match", "no_match"]);
  });

  it.each([
    [
      "識別子内の未定義の項目",
      { type: "url", url: "https://example.org/", extra: 1 },
      "UNKNOWN_FIELD",
      ["identifiers", 0, "extra"],
    ],
    [
      "typeの不足",
      { url: "https://example.org/" },
      "MISSING_REQUIRED_FIELD",
      ["identifiers", 0, "type"],
    ],
    [
      "未定義のtype",
      { type: "email", value: "a@example.org" },
      "INVALID_VALUE",
      ["identifiers", 0, "type"],
    ],
    ["オブジェクトでない入力", "https://example.org/", "INVALID_TYPE", ["identifiers", 0]],
    [
      "Provider表に無いProvider",
      { type: "provider_username", provider: "myspace", username: "alice" },
      "INVALID_VALUE",
      ["identifiers", 0, "provider"],
    ],
    [
      "文字列でない固有ID",
      { type: "provider_account", provider: "github", accountId: 123 },
      "INVALID_TYPE",
      ["identifiers", 0, "accountId"],
    ],
    [
      "256 bytesを超えるユーザー名",
      { type: "provider_username", provider: "github", username: "a".repeat(257) },
      "INVALID_VALUE",
      ["identifiers", 0, "username"],
    ],
    [
      "受付制約に違反するURL",
      { type: "url", url: "https://example.org:8443/" },
      "INVALID_VALUE",
      ["identifiers", 0, "url"],
    ],
  ])("%sは、その入力のerrorsへ位置付きで返す", async (_, identifier, code, path) => {
    const { caller } = await setUpProvision();

    const response = await resolve(caller, [identifier]);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      results: [{ index: 0, identifier, status: "invalid_input", errors: [{ code, path }] }],
    });
  });

  it("1,000件を500件ずつ照合し、入力順に返す", async () => {
    const { caller, owner, blogUrl } = await setUpProvision();
    const matchedIndexes = [0, 499, 500, 999];
    const identifiers = Array.from({ length: 1000 }, (_, index) =>
      matchedIndexes.includes(index)
        ? { type: "url", url: blogUrl }
        : { type: "url", url: `https://unlinked.example.org/${index}` },
    );

    const response = await resolve(caller, identifiers);

    expect(response.status).toBe(200);
    const { results } = (await response.json()) as {
      results: { index: number; status: string; accountsUserId: string | null }[];
    };
    expect(results.map((result) => result.index)).toEqual(identifiers.map((_, index) => index));
    expect(
      results.flatMap((result) => (result.status === "matched" ? [result.index] : [])),
    ).toEqual(matchedIndexes);
    expect(results[999]?.accountsUserId).toBe(owner.userId);
  });
});

// --------------------------------------------------
// 要求全体の検査
// --------------------------------------------------

describe("資源APIの要求全体の検査", () => {
  it.each([
    ["未定義の最上位項目", { identifiers: [], extra: true }, "UNKNOWN_FIELD", ["extra"]],
    ["identifiersの不足", {}, "MISSING_REQUIRED_FIELD", ["identifiers"]],
    ["配列でないidentifiers", { identifiers: "x" }, "INVALID_TYPE", ["identifiers"]],
    [
      "1,000件を超える入力",
      {
        identifiers: Array.from({ length: 1001 }, () => ({
          type: "url",
          url: "https://example.org/",
        })),
      },
      "INVALID_VALUE",
      ["identifiers"],
    ],
  ])("%sは照合を始めずに最上位のerrorsで400を返す", async (_, body, code, path) => {
    const { caller } = await setUpProvision();

    const response = await fetchResourceApi(caller, "/api/v1/identities/resolve", { body });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      errors: [{ code, message: expect.any(String), path }],
    });
  });

  it.each([
    ["JSONの構文不正", { body: "{", contentType: "application/json" }, 400, "INVALID_JSON"],
    ["Content-Typeの未指定", { body: "{}", contentType: null }, 400, "MISSING_REQUIRED_FIELD"],
    [
      "JSON以外のContent-Type",
      { body: "{}", contentType: "text/plain" },
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      "5MiBを超えるbody",
      {
        body: JSON.stringify({ identifiers: [], padding: "a".repeat(5_242_880) }),
        contentType: "application/json",
      },
      413,
      "REQUEST_TOO_LARGE",
    ],
  ] as const)("%sは要求全体のエラーを返す", async (_, init, status, code) => {
    const { caller } = await setUpProvision();

    const response = await fetchResourceApi(caller, "/api/v1/identities/resolve", init);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({
      errors: [{ code, message: expect.any(String), path: null }],
    });
  });

  it("QUERY以外のメソッドは資源APIとして受け付けない", async () => {
    const { caller } = await setUpProvision();

    const response = await fetchResourceApi(caller, "/api/v1/identities/resolve", {
      method: "POST",
      body: { identifiers: [] },
    });

    expect(response.status).toBe(404);
  });
});

// --------------------------------------------------
// クライアント認証
// --------------------------------------------------

describe("資源APIのクライアント認証", () => {
  it("Access Tokenの無い要求は、bodyを検査する前にWWW-Authenticate付きの401を返す", async () => {
    const response = await exports.default.fetch(`${testOrigin}/api/v1/identities/resolve`, {
      method: "QUERY",
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toMatch(/^DPoP error="invalid_token"/);
    expect(await response.json()).toEqual({
      errors: [{ code: "UNAUTHORIZED", message: expect.any(String), path: null }],
    });
  });

  it("identities:readを持たないトークンは403 INSUFFICIENT_SCOPEにする", async () => {
    const developer = await loginAsNewUser();
    const { clientId } = await registerTestClient(developer.headers);
    const dpopKey = await generateTestKeyPair("dpop-key");
    const now = Math.floor(Date.now() / 1000);
    const { token } = await testAuth.api.signJWT({
      body: {
        payload: {
          iss: testOrigin,
          aud: resourceApiIdentifier,
          sub: clientId,
          client_id: clientId,
          azp: clientId,
          iat: now,
          exp: now + 900,
          scope: "openid",
          cnf: { jkt: await deriveDpopJkt(dpopKey.publicJwk) },
        },
      },
    });

    const response = await resolve({ clientId, accessToken: token, dpopKey }, []);

    expect(response.status).toBe(403);
    expect(response.headers.get("www-authenticate")).toContain('error="insufficient_scope"');
    expect(await response.json()).toEqual({
      errors: [{ code: "INSUFFICIENT_SCOPE", message: expect.any(String), path: null }],
    });
  });

  it("削除したクライアントの発行済みトークンは401にする", async () => {
    const { developer, clientId, caller } = await setUpClient();

    const deleted = await fetchOAuthClients(developer.headers, `/${clientId}`, {
      method: "DELETE",
    });
    const response = await resolve(caller, []);

    expect(deleted.status).toBe(200);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toEqual(expect.any(String));
  });
});
