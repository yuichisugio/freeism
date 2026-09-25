import { env, exports } from "cloudflare:workers";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { createUnsignedIdToken, getTestAuthContext } from "../../../test/auth-test-helpers";
import {
  fillUrlIdentifiers,
  readIdentifierActivity,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import { urlIdentifierLimitPerUser } from "../../shared/constants";
import { accountLinksSchema } from "../../shared/schemas/account-link-schema";
import { saveUnverifiedUrlResultSchema } from "../../shared/schemas/external-url-schema";
import {
  dataResponseSchema,
  okSchema,
  problemDetailsSchema,
} from "../../shared/schemas/problem-details-schema";
import { meSchema } from "../../shared/schemas/profile-schema";
import { createRandomId } from "../db/id";

const origin = "http://localhost:5173";

// --------------------------------------------------
// テスト用の要求
// --------------------------------------------------

/**
 * Better Authの標準処理でGoogleのOAuth accountを持つユーザーを作り、ログインしたセッションのヘッダーを返す。
 */
async function createLoggedInUser(accountCount = 1) {
  const context = await getTestAuthContext();
  const user = await context.test.saveUser(context.test.createUser());
  for (let index = 0; index < accountCount; index += 1) {
    const subject = createRandomId("google-");
    await context.internalAdapter.createAccount({
      userId: user.id,
      providerId: "google",
      accountId: subject,
      idToken: createUnsignedIdToken({ sub: subject, name: `Google ${index}` }),
    });
  }
  const { headers } = await context.test.login({ userId: user.id });
  return { userId: user.id, headers };
}

/**
 * BFFへ要求する。
 * 状態変更の要求には、ブラウザーと同じく同一originの`Origin`を付ける。
 */
function requestBff(
  path: string,
  { method = "GET", headers, body }: { method?: string; headers?: Headers; body?: unknown } = {},
) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Origin", origin);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  return exports.default.fetch(`${origin}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * 成功応答の`data`を共有schemaで検査して読む。
 */
async function readData<TSchema extends v.GenericSchema>(
  response: Response,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  return v.parse(dataResponseSchema(schema), await response.json()).data;
}

/**
 * 失敗応答をRFC 9457の問題詳細として読む。
 */
async function readProblem(response: Response) {
  expect(response.headers.get("Content-Type")).toContain("application/problem+json");
  return v.parse(problemDetailsSchema, await response.json());
}

// --------------------------------------------------
// テスト
// --------------------------------------------------

describe("BFFのセッション確認", () => {
  it.each([
    ["GET", "/api/me"],
    ["GET", "/api/account-links"],
    ["POST", "/api/external-urls"],
    ["DELETE", "/api/external-accounts/eac_x"],
    ["DELETE", "/api/external-accounts/eac_x/oauth/account_x"],
  ])("セッションの無い%s %sは401を返す", async (method, path) => {
    const response = await requestBff(path, {
      method,
      body: method === "POST" ? { url: "https://example.com/", mode: "unverified" } : undefined,
    });

    expect(response.status).toBe(401);
    expect(await readProblem(response)).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });
});

describe("GET /api/me", () => {
  it("セッション本人のIDと公開プロフィールURLを返す", async () => {
    const { userId, headers } = await createLoggedInUser();

    const me = await readData(await requestBff("/api/me", { headers }), meSchema);

    expect(me).toEqual({
      accountsUserId: userId,
      displayName: "仮ユーザー",
      profileUrl: `${origin}/profiles/${userId}`,
    });
  });
});

describe("POST /api/external-urls", () => {
  it("未検証で保存したURLを、本人向け一覧に候補として表示する", async () => {
    const { userId, headers } = await createLoggedInUser();
    const url = `https://${uniqueHost()}/`;

    const saved = await readData(
      await requestBff("/api/external-urls", {
        method: "POST",
        headers,
        body: { url, mode: "unverified" },
      }),
      saveUnverifiedUrlResultSchema,
    );
    const links = await readData(await requestBff("/api/account-links", { headers }), accountLinksSchema);

    expect(saved.created).toBe(true);
    expect(links.accounts).toContainEqual(
      expect.objectContaining({
        id: saved.externalAccountId,
        verificationStatus: "unverified",
        identifiers: [expect.objectContaining({ type: "url", value: url, isActive: false })],
      }),
    );
    expect(await readIdentifierActivity(userId)).toMatchObject({ [`url:${url}`]: false });
  });

  it("本人のURLが上限に達していれば、mode: verifyでもURL_LIMIT_REACHEDの409を返す", async () => {
    const { userId, headers } = await createLoggedInUser();
    await fillUrlIdentifiers(userId, urlIdentifierLimitPerUser);

    const response = await requestBff("/api/external-urls", {
      method: "POST",
      headers,
      body: { url: `https://${uniqueHost()}/`, mode: "verify" },
    });

    expect(response.status).toBe(409);
    expect(await readProblem(response)).toMatchObject({ code: "URL_LIMIT_REACHED" });
  });

  it("検証要求がレート制限を超えた場合は、RATE_LIMITEDの429を返す", async () => {
    const { userId, headers } = await createLoggedInUser();
    // 同じbindingで本人の上限まで数え、次の検証要求が外部通信の前に拒否されることを確かめる。
    for (let count = 0; count < 10; count += 1) {
      await env.URL_VERIFICATION_RATE_LIMITER.limit({ key: userId });
    }

    const response = await requestBff("/api/external-urls", {
      method: "POST",
      headers,
      body: { url: `https://${uniqueHost()}/`, mode: "verify" },
    });

    expect(response.status).toBe(429);
    expect(await readProblem(response)).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("URLの不備は、urlを指す入力エラーの400を返す", async () => {
    const { headers } = await createLoggedInUser();

    const response = await requestBff("/api/external-urls", {
      method: "POST",
      headers,
      body: { url: "https://127.0.0.1/", mode: "verify" },
    });

    expect(response.status).toBe(400);
    expect(await readProblem(response)).toMatchObject({
      code: "HOST_NOT_ALLOWED",
      errors: [{ code: "HOST_NOT_ALLOWED", path: ["url"] }],
    });
  });

  it("共有schemaに合わない要求bodyは、項目ごとの不備の400を返す", async () => {
    const { headers } = await createLoggedInUser();

    const response = await requestBff("/api/external-urls", {
      method: "POST",
      headers,
      body: { url: "https://example.com/", mode: "save", extra: true },
    });

    expect(response.status).toBe(400);
    expect(await readProblem(response)).toMatchObject({
      code: "INVALID_VALUE",
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_VALUE", path: ["mode"] }),
        expect.objectContaining({ code: "UNKNOWN_FIELD", path: ["extra"] }),
      ]),
    });
  });
});

describe("DELETE /api/external-accounts", () => {
  it("本人の行全体を解除する", async () => {
    const { userId, headers } = await createLoggedInUser();
    const url = `https://${uniqueHost()}/`;
    const saved = await readData(
      await requestBff("/api/external-urls", {
        method: "POST",
        headers,
        body: { url, mode: "unverified" },
      }),
      saveUnverifiedUrlResultSchema,
    );

    const response = await requestBff(`/api/external-accounts/${saved.externalAccountId}`, {
      method: "DELETE",
      headers,
    });

    expect(await readData(response, okSchema)).toEqual({ ok: true });
    expect(await readIdentifierActivity(userId)).not.toHaveProperty(`url:${url}`);
  });

  it("最後のログイン手段の解除はLAST_LOGIN_METHODの400を返す", async () => {
    const { headers } = await createLoggedInUser();
    const links = await readData(await requestBff("/api/account-links", { headers }), accountLinksSchema);
    const [googleAccount] = links.accounts;
    const authAccountId = googleAccount?.verifications[0]?.authAccountId ?? "";

    const response = await requestBff(
      `/api/external-accounts/${googleAccount?.id}/oauth/${authAccountId}`,
      { method: "DELETE", headers },
    );

    expect(response.status).toBe(400);
    expect(await readProblem(response)).toMatchObject({ code: "LAST_LOGIN_METHOD" });
  });

  it("本人の行でなければ404を返す", async () => {
    const { headers } = await createLoggedInUser();

    const response = await requestBff("/api/external-accounts/eac_missing", {
      method: "DELETE",
      headers,
    });

    expect(response.status).toBe(404);
    expect(await readProblem(response)).toMatchObject({ code: "NOT_FOUND" });
  });
});
