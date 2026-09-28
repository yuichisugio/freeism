import { exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getTestAuthContext } from "../../../test/auth-test-helpers";
import {
  createVerifiedUrlAccount,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import {
  fetchOAuthClients,
  generateTestKeyPair,
  loginAsNewUser,
  testOrigin,
  toJwks,
} from "../../../test/oauth-client-test-helpers";
import {
  countOAuthConsents,
  insertOAuthConsent,
  registerTestClient,
  saveVisibility,
  testRedirectUri,
} from "../../../test/resource-api-test-helpers";
import { createRandomId } from "../db/id";
import { clientConsents, externalAccounts, externalAccountVisibility } from "../db/schema";

/**
 * 利用側サービスの連携開始から、同意画面（`/consent`）での`oauth2.consent`までの往復。
 * 画面の`useConsentRequest`は、今回のクライアントの公開選択だけを保存してから`accept: true`、拒否は`accept: false`を送る。
 * `accept: true`は、今回のクライアントへ証明済みの外部アカウントを1件以上公開選択している場合だけ受け付ける。
 * @see ../../frontend/features/consent/hooks/use-consent-request.ts
 */

// --------------------------------------------------
// 利用側サービスとブラウザーの操作
// --------------------------------------------------

/**
 * ログインし、証明済みの外部アカウントと連携先のクライアントを用意する。
 */
async function setUpUser() {
  const { userId, headers } = await loginAsNewUser();
  const { accountId } = await createVerifiedUrlAccount(
    userId,
    [`https://${uniqueHost()}/alice`],
    "bidirectional_link",
    new Date(),
  );
  const { clientId } = await registerTestClient(headers);
  return { userId, headers, accountId, clientId };
}

/**
 * ブラウザーで認可エンドポイントを開く。
 * PKCEの`code_challenge`は固定値でよい（トークン交換はこのテストの対象外）。
 */
function authorize(
  headers: Headers,
  clientId: string,
  { prompt, redirectUri = testRedirectUri }: { prompt?: string; redirectUri?: string } = {},
) {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid",
    state: "state-1",
    nonce: "nonce-1",
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256",
    ...(prompt === undefined ? {} : { prompt }),
  });
  // 移動先を確認するため、リダイレクトをたどらない。
  return exports.default.fetch(`${testOrigin}/api/auth/oauth2/authorize?${query.toString()}`, {
    headers,
    redirect: "manual",
  });
}

/**
 * 認可要求が同意画面へ移動したことを確認し、画面が`oauth2.consent`へ渡す署名付きクエリを返す。
 */
function readConsentPageQuery(response: Response): string {
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("location") ?? "", testOrigin);
  expect(location.pathname).toBe("/consent");
  expect(location.searchParams.get("sig")).toEqual(expect.any(String));
  return location.search.slice(1);
}

/**
 * 同意画面の「同意して戻る」「同意しない」（Better Auth標準の`oauth2.consent`）。
 */
async function sendConsent(headers: Headers, oauthQuery: string, accept: boolean) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Content-Type", "application/json");
  return exports.default.fetch(`${testOrigin}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ accept, oauth_query: oauthQuery }),
  });
}

/**
 * `fetch`で送った要求の応答（`{ redirect: true, url }`）から移動先を読む。
 * 同意画面への移動先はAccounts内の相対URLになる。
 */
async function readRedirectUrl(response: Response): Promise<URL> {
  expect(response.status).toBe(200);
  const body = (await response.json()) as { url: string };
  return new URL(body.url, testOrigin);
}

/**
 * 同じブラウザーで別のユーザーもログインした状態にし、そのユーザーのセッショントークンを返す。
 * `testUtils`のログインはMulti Sessionのcookieを発行しないため、標準のログインと同じ名前と値のcookieを要求のCookieへ加える。
 * Multi Sessionのcookieの値は、セッションのcookieと同じ署名付きのセッショントークンになる。
 */
async function loginAnotherUserInSameBrowser(headers: Headers) {
  const context = await getTestAuthContext();
  const user = await context.test.saveUser(context.test.createUser());
  const login = await context.test.login({ userId: user.id });
  const sessionCookie = login.headers.get("cookie") ?? "";
  const signedToken = sessionCookie.slice(sessionCookie.indexOf("=") + 1);
  const multiSessionCookieName = `${context.authCookies.sessionToken.name}_multi-${login.token.toLowerCase()}`;
  headers.set("cookie", `${headers.get("cookie")}; ${multiSessionCookieName}=${signedToken}`);
  return { userId: user.id, sessionToken: login.token };
}

/**
 * 同意画面のアカウントのメニューで別のユーザーを選ぶ（Multi Sessionの`setActive`）。
 * 画面のBetter Authクライアントは、同意画面の署名付きクエリを`oauth_query`として加えて送る。
 */
function switchUserOnConsentPage(headers: Headers, sessionToken: string, oauthQuery: string) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Content-Type", "application/json");
  return exports.default.fetch(`${testOrigin}/api/auth/multi-session/set-active`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ sessionToken, oauth_query: oauthQuery }),
  });
}

// --------------------------------------------------
// 同意画面
// --------------------------------------------------

/**
 * 監査ログ（`console.log`・`console.warn`）に出た1行のJSONを読む。
 */
function readAuditEvents(...spies: { mock: { calls: unknown[][] } }[]) {
  return spies
    .flatMap((spy) => spy.mock.calls.map(([line]) => String(line)))
    .filter((line) => line.includes('"type":"audit"'))
    .map((line) => JSON.parse(line) as { event: string; outcome: string });
}

describe("連携開始と同意画面", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ログイン後の認可要求は、署名付きクエリを付けて同意画面へ302で移動する", async () => {
    const { headers, clientId } = await setUpUser();

    const response = await authorize(headers, clientId, { prompt: "consent" });

    const query = new URLSearchParams(readConsentPageQuery(response));
    expect(query.get("client_id")).toBe(clientId);
    expect(query.get("redirect_uri")).toBe(testRedirectUri);
  });

  it("証明済みの外部アカウントを公開選択して保存してからaccept:trueを送ると、認可コードを付けて戻り先へ戻る", async () => {
    const { userId, headers, accountId, clientId } = await setUpUser();
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );

    const saved = await saveVisibility(headers, {
      clients: [{ clientId, visibleAccountIds: [accountId] }],
    });
    const log = vi.spyOn(console, "log");
    const redirect = await readRedirectUrl(await sendConsent(headers, oauthQuery, true));

    expect(readAuditEvents(log)).toContainEqual(
      expect.objectContaining({ event: "oauth_consent_accepted", outcome: "success" }),
    );
    expect(saved.status).toBe(200);
    expect(`${redirect.origin}${redirect.pathname}`).toBe(testRedirectUri);
    expect(redirect.searchParams.get("code")).toEqual(expect.any(String));
    expect(redirect.searchParams.get("state")).toBe("state-1");
    expect(await countOAuthConsents(userId, clientId)).toBe(1);
  });

  it("保存済みのOAuth同意があれば、prompt=consentの無い要求は同意画面を省き、prompt=consentでは同意画面を表示する", async () => {
    const { headers, accountId, clientId } = await setUpUser();
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );
    await saveVisibility(headers, {
      clients: [{ clientId, visibleAccountIds: [accountId] }],
    });
    await sendConsent(headers, oauthQuery, true);

    const withoutPrompt = await authorize(headers, clientId);
    const withPrompt = await authorize(headers, clientId, { prompt: "consent" });

    expect(withoutPrompt.status).toBe(302);
    const location = new URL(withoutPrompt.headers.get("location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(testRedirectUri);
    expect(location.searchParams.get("code")).toEqual(expect.any(String));
    readConsentPageQuery(withPrompt);
  });

  it("accept:falseはaccess_deniedで戻り、保存済みの同意と公開設定を変えない", async () => {
    const { userId, headers, accountId, clientId } = await setUpUser();
    await saveVisibility(headers, {
      clients: [{ clientId, visibleAccountIds: [accountId] }],
    });
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );

    const log = vi.spyOn(console, "log");
    const redirect = await readRedirectUrl(await sendConsent(headers, oauthQuery, false));

    expect(readAuditEvents(log)).toContainEqual(
      expect.objectContaining({ event: "oauth_consent_denied", outcome: "success" }),
    );
    expect(redirect.searchParams.get("error")).toBe("access_denied");
    expect(redirect.searchParams.get("code")).toBeNull();
    expect(
      await testDb.select().from(clientConsents).where(eq(clientConsents.userId, userId)),
    ).toEqual([expect.objectContaining({ clientId })]);
    expect(
      await testDb
        .select()
        .from(externalAccountVisibility)
        .where(eq(externalAccountVisibility.accountId, accountId)),
    ).toEqual([{ accountId, clientId, isPublic: true }]);
  });

  it("公開選択をすべて外して保存するとOAuth同意が消え、次の認可要求はpromptが無くても同意画面を表示する", async () => {
    const { userId, headers, accountId, clientId } = await setUpUser();
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );
    await saveVisibility(headers, {
      clients: [{ clientId, visibleAccountIds: [accountId] }],
    });
    await sendConsent(headers, oauthQuery, true);

    await saveVisibility(headers, { clients: [{ clientId, visibleAccountIds: [] }] });

    expect(await countOAuthConsents(userId, clientId)).toBe(0);
    readConsentPageQuery(await authorize(headers, clientId));
  });

  it("ローカル開発用のリダイレクトURLは、ポートだけが異なる戻り先を受け付ける", async () => {
    const { headers } = await loginAsNewUser();
    const clientKey = await generateTestKeyPair("client-key");
    const registered = await fetchOAuthClients(headers, "", {
      method: "POST",
      body: {
        name: "Points (local)",
        uri: null,
        description: null,
        redirectUris: ["http://127.0.0.1:8787/callback"],
        jwks: toJwks(clientKey),
      },
    });
    const { data } = (await registered.json()) as { data: { clientId: string } };

    const otherPort = await authorize(headers, data.clientId, {
      prompt: "consent",
      redirectUri: "http://127.0.0.1:53123/callback",
    });
    const otherPath = await authorize(headers, data.clientId, {
      prompt: "consent",
      redirectUri: "http://127.0.0.1:8787/other",
    });

    expect(new URLSearchParams(readConsentPageQuery(otherPort)).get("redirect_uri")).toBe(
      "http://127.0.0.1:53123/callback",
    );
    expect(new URL(otherPath.headers.get("location") ?? "").searchParams.get("error")).toBe(
      "invalid_redirect",
    );
  });

  it("保存済みのOAuth同意がある状態でaccept:falseを送っても、標準のOAuth同意を変えない", async () => {
    const { userId, headers, accountId, clientId } = await setUpUser();
    await saveVisibility(headers, {
      clients: [{ clientId, visibleAccountIds: [accountId] }],
    });
    await sendConsent(
      headers,
      readConsentPageQuery(await authorize(headers, clientId, { prompt: "consent" })),
      true,
    );

    await sendConsent(
      headers,
      readConsentPageQuery(await authorize(headers, clientId, { prompt: "consent" })),
      false,
    );

    expect(await countOAuthConsents(userId, clientId)).toBe(1);
  });

  it("公開選択を外した後も、同意画面で選び直して保存すれば連携を再開できる", async () => {
    const { userId, headers, accountId, clientId } = await setUpUser();
    await saveVisibility(headers, {
      clients: [{ clientId, visibleAccountIds: [accountId] }],
    });
    await sendConsent(
      headers,
      readConsentPageQuery(await authorize(headers, clientId, { prompt: "consent" })),
      true,
    );
    await saveVisibility(headers, { clients: [{ clientId, visibleAccountIds: [] }] });

    const oauthQuery = readConsentPageQuery(await authorize(headers, clientId));
    await saveVisibility(headers, {
      clients: [{ clientId, visibleAccountIds: [accountId] }],
    });
    const redirect = await readRedirectUrl(await sendConsent(headers, oauthQuery, true));

    expect(redirect.searchParams.get("code")).toEqual(expect.any(String));
    expect(await countOAuthConsents(userId, clientId)).toBe(1);
  });
  it.each([
    ["公開設定を保存していない", "none"],
    ["未検証の外部アカウントだけを公開選択した", "unverified"],
    ["別のクライアントにだけ公開選択した", "otherClient"],
  ] as const)(
    "今回のクライアントへ%s場合、accept:trueを400で拒否し、OAuth同意と認可コードを作らない",
    async (_, selection) => {
      const { userId, headers, accountId, clientId } = await setUpUser();
      const oauthQuery = readConsentPageQuery(
        await authorize(headers, clientId, { prompt: "consent" }),
      );
      if (selection === "unverified") {
        const candidateId = createRandomId("eac_");
        await testDb.insert(externalAccounts).values({ id: candidateId, userId });
        await saveVisibility(headers, { clients: [{ clientId, visibleAccountIds: [candidateId] }] });
      }
      if (selection === "otherClient") {
        const { clientId: otherClientId } = await registerTestClient(headers, "Markets");
        await saveVisibility(headers, {
          clients: [{ clientId: otherClientId, visibleAccountIds: [accountId] }],
        });
      }

      const warn = vi.spyOn(console, "warn");
      const response = await sendConsent(headers, oauthQuery, true);

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "CONSENT_REQUIRES_VERIFIED_ACCOUNT" });
      expect(readAuditEvents(warn)).toContainEqual(
        expect.objectContaining({ event: "oauth_consent_accepted", outcome: "failure" }),
      );
      expect(await countOAuthConsents(userId, clientId)).toBe(0);
      readConsentPageQuery(await authorize(headers, clientId));
    },
  );

  it("証明済みの公開選択が無くても、accept:falseはaccess_deniedで戻る", async () => {
    const { headers, clientId } = await setUpUser();
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );

    const redirect = await readRedirectUrl(await sendConsent(headers, oauthQuery, false));

    expect(redirect.searchParams.get("error")).toBe("access_denied");
  });

  it("ログインしていない要求のaccept:trueは、提供の確認をせずに標準の401にする", async () => {
    const { headers, clientId } = await setUpUser();
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );

    const response = await sendConsent(
      new Headers({ Origin: testOrigin }),
      oauthQuery,
      true,
    );

    expect(response.status).toBe(401);
  });
});

describe("同意画面でのユーザーの切り替え", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("prompt=consentの要求では、選んだユーザーで署名し直した同意画面へ移動する", async () => {
    const { headers, clientId } = await setUpUser();
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );
    const other = await loginAnotherUserInSameBrowser(headers);

    const response = await switchUserOnConsentPage(headers, other.sessionToken, oauthQuery);

    const redirect = await readRedirectUrl(response);
    expect(redirect.pathname).toBe("/consent");
    expect(redirect.searchParams.get("client_id")).toBe(clientId);
    expect(redirect.searchParams.get("sig")).toEqual(expect.any(String));
    expect(response.headers.getSetCookie().join("\n")).toContain(other.sessionToken);
  });

  it("prompt=consentの無い要求で、選んだユーザーが保存済みのOAuth同意を持てば、認可コードを付けて戻り先へ戻る", async () => {
    const { headers, clientId } = await setUpUser();
    const oauthQuery = readConsentPageQuery(await authorize(headers, clientId));
    const other = await loginAnotherUserInSameBrowser(headers);
    await insertOAuthConsent(other.userId, clientId);

    const redirect = await readRedirectUrl(
      await switchUserOnConsentPage(headers, other.sessionToken, oauthQuery),
    );

    expect(`${redirect.origin}${redirect.pathname}`).toBe(testRedirectUri);
    expect(redirect.searchParams.get("code")).toEqual(expect.any(String));
    expect(redirect.searchParams.get("state")).toBe("state-1");
  });

  it("同意画面の署名付きクエリが失効した後は、invalid_signatureの400で切り替えない", async () => {
    const { headers, clientId } = await setUpUser();
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );
    const other = await loginAnotherUserInSameBrowser(headers);
    const exp = Number(new URLSearchParams(oauthQuery).get("exp"));
    vi.setSystemTime((exp + 1) * 1000);

    const response = await switchUserOnConsentPage(headers, other.sessionToken, oauthQuery);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_signature" });
    expect(response.headers.getSetCookie().join("\n")).not.toContain(other.sessionToken);
  });
});
