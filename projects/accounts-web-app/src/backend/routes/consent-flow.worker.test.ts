import { exports } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createVerifiedUrlAccount,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import { loginAsNewUser, testOrigin } from "../../../test/oauth-client-test-helpers";
import {
  registerTestClient,
  saveVisibility,
  testRedirectUri,
} from "../../../test/resource-api-test-helpers";
import { clientConsents, externalAccountVisibility, oauthConsent } from "../db/schema";

/**
 * 利用側サービスの連携開始から、「アカウント連携」画面（同意画面）での`oauth2.consent`までの往復。
 * 画面の`useConsentRequest`は、同意ONで公開設定を保存してから`accept: true`、拒否は`accept: false`を送る。
 * @see ../../frontend/features/account-links/hooks/use-consent-request.ts
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
function authorize(headers: Headers, clientId: string, { prompt }: { prompt?: string } = {}) {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: testRedirectUri,
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
  expect(location.pathname).toBe("/account-links");
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

async function readRedirectUrl(response: Response): Promise<URL> {
  expect(response.status).toBe(200);
  const body = (await response.json()) as { url: string };
  return new URL(body.url);
}

async function countOAuthConsents(userId: string, clientId: string) {
  const rows = await testDb
    .select()
    .from(oauthConsent)
    .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)));
  return rows.length;
}

// --------------------------------------------------
// 同意画面
// --------------------------------------------------

describe("連携開始と同意画面", () => {
  it("ログイン後の認可要求は、署名付きクエリを付けて「アカウント連携」画面へ302で移動する", async () => {
    const { headers, clientId } = await setUpUser();

    const response = await authorize(headers, clientId, { prompt: "consent" });

    const query = new URLSearchParams(readConsentPageQuery(response));
    expect(query.get("client_id")).toBe(clientId);
    expect(query.get("redirect_uri")).toBe(testRedirectUri);
  });

  it("同意ONで公開設定を保存してからaccept:trueを送ると、認可コードを付けて戻り先へ戻る", async () => {
    const { userId, headers, accountId, clientId } = await setUpUser();
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );

    const saved = await saveVisibility(headers, {
      clients: [{ clientId, consented: true, visibleAccountIds: [accountId] }],
    });
    const redirect = await readRedirectUrl(await sendConsent(headers, oauthQuery, true));

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
      clients: [{ clientId, consented: true, visibleAccountIds: [accountId] }],
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
      clients: [{ clientId, consented: true, visibleAccountIds: [accountId] }],
    });
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );

    const redirect = await readRedirectUrl(await sendConsent(headers, oauthQuery, false));

    expect(redirect.searchParams.get("error")).toBe("access_denied");
    expect(redirect.searchParams.get("code")).toBeNull();
    expect(
      await testDb.select().from(clientConsents).where(eq(clientConsents.userId, userId)),
    ).toEqual([expect.objectContaining({ clientId, consented: true })]);
    expect(
      await testDb
        .select()
        .from(externalAccountVisibility)
        .where(eq(externalAccountVisibility.accountId, accountId)),
    ).toEqual([{ accountId, clientId, isPublic: true }]);
  });

  it("同意をOFFで保存するとOAuth同意が消え、次の認可要求はpromptが無くても同意画面を表示する", async () => {
    const { userId, headers, accountId, clientId } = await setUpUser();
    const oauthQuery = readConsentPageQuery(
      await authorize(headers, clientId, { prompt: "consent" }),
    );
    await saveVisibility(headers, {
      clients: [{ clientId, consented: true, visibleAccountIds: [accountId] }],
    });
    await sendConsent(headers, oauthQuery, true);

    await saveVisibility(headers, {
      clients: [{ clientId, consented: false, visibleAccountIds: [accountId] }],
    });

    expect(await countOAuthConsents(userId, clientId)).toBe(0);
    readConsentPageQuery(await authorize(headers, clientId));
  });
});
