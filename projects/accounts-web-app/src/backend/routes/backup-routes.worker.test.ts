import { exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { createUnsignedIdToken, getTestAuthContext } from "../../../test/auth-test-helpers";
import { readExternalAccounts, testDb, uniqueHost } from "../../../test/external-account-test-helpers";
import { jsonFileMaxBytes } from "../../shared/constants";
import {
  backupSchema,
  backupSummarySchema,
  restoreBackupResultSchema,
  type Backup,
} from "../../shared/schemas/backup-schema";
import { dataResponseSchema, problemDetailsSchema } from "../../shared/schemas/problem-details-schema";
import { createRandomId } from "../db/id";
import { clientConsents, externalAccounts, user } from "../db/schema";

const origin = "http://localhost:5173";

// --------------------------------------------------
// テスト用の要求
// --------------------------------------------------

/**
 * Better Authの標準処理でGoogleのOAuth accountを持つユーザーを作り、ログインしたセッションのヘッダーを返す。
 * accountの作成後のフックで、メールアドレスを持つ外部アカウント行と`oauth`証明が作られる。
 */
async function createLoggedInUser() {
  const context = await getTestAuthContext();
  const createdUser = await context.test.saveUser(context.test.createUser());
  const subject = createRandomId("google-");
  const externalEmail = `${subject.toLowerCase()}@external.example.com`;
  await context.internalAdapter.createAccount({
    userId: createdUser.id,
    providerId: "google",
    accountId: subject,
    idToken: createUnsignedIdToken({ sub: subject, name: "Google", email: externalEmail }),
  });
  const { headers } = await context.test.login({ userId: createdUser.id });
  return { userId: createdUser.id, userEmail: createdUser.email, externalEmail, subject, headers };
}

/**
 * BFFへ要求する。
 * 状態変更の要求には、ブラウザーと同じく同一originの`Origin`を付ける。
 * `rawBody`は容量の境界を確かめるため、文字列のまま送る。
 */
function requestBff(
  path: string,
  {
    method = "GET",
    headers,
    body,
    rawBody,
  }: { method?: string; headers?: Headers; body?: unknown; rawBody?: string } = {},
) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Origin", origin);
  if (body !== undefined || rawBody !== undefined) requestHeaders.set("Content-Type", "application/json");
  return exports.default.fetch(`${origin}${path}`, {
    method,
    headers: requestHeaders,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

async function readData<TSchema extends v.GenericSchema>(
  response: Response,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  return v.parse(dataResponseSchema(schema), await response.json()).data;
}

async function readProblem(response: Response) {
  expect(response.headers.get("Content-Type")).toContain("application/problem+json");
  return v.parse(problemDetailsSchema, await response.json());
}

/**
 * 本人のバックアップJSONを出力し、ファイルの文字列を返す。
 */
async function exportBackupFile(headers: Headers): Promise<string> {
  const response = await requestBff("/api/backup", { headers });
  expect(response.status).toBe(200);
  return response.text();
}

// --------------------------------------------------
// テスト
// --------------------------------------------------

describe("バックアップのセッション確認", () => {
  it.each([
    ["GET", "/api/backup"],
    ["GET", "/api/backup/summary"],
    ["POST", "/api/backup/restore"],
  ])("セッションの無い%s %sは401を返す", async (method, path) => {
    const response = await requestBff(path, { method, body: method === "POST" ? {} : undefined });

    expect(response.status).toBe(401);
    expect(await readProblem(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("GET /api/backup", () => {
  it("本人の情報をファイルとして出力し、メールアドレスと過去の証明情報を含めない", async () => {
    const { userId, userEmail, externalEmail, subject, headers } = await createLoggedInUser();
    const [externalAccount] = await readExternalAccounts(userId);
    await testDb
      .update(externalAccounts)
      .set({ importedVerificationsJson: JSON.stringify([{ marker: "imported-marker" }]) })
      .where(eq(externalAccounts.id, externalAccount?.id ?? ""));

    const response = await requestBff("/api/backup", { headers });
    const json = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="accounts-backup-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(json).not.toContain(userEmail);
    expect(json).not.toContain(externalEmail);
    expect(json).not.toContain("imported-marker");

    const backup = v.parse(backupSchema, JSON.parse(json));
    expect(backup).toMatchObject({ schemaVersion: 1, accountsUserId: userId, profile: { displayName: "仮ユーザー" } });
    expect(backup.externalAccounts).toEqual([
      expect.objectContaining({
        metadata: expect.objectContaining({
          service: "google",
          identifiers: [{ type: "provider_account", provider: "google", accountId: subject }],
          verificationStatus: "verified",
          verifications: [expect.objectContaining({ method: "oauth", result: "verified" })],
        }),
        isPublic: false,
      }),
    ]);
  });
});

describe("GET /api/backup/summary", () => {
  it("件数と非公開情報を含むかを返す", async () => {
    const { headers } = await createLoggedInUser();
    await requestBff("/api/external-urls", {
      method: "POST",
      headers,
      body: { url: `https://${uniqueHost()}/`, mode: "unverified" },
    });

    const summary = await readData(await requestBff("/api/backup/summary", { headers }), backupSummarySchema);

    expect(summary).toEqual({
      externalAccountCount: 2,
      unverifiedAccountCount: 1,
      clientConsentCount: 0,
      includesPrivateData: true,
    });
  });
});

describe("POST /api/backup/restore", () => {
  it("出力したファイルをそのまま復元できる", async () => {
    const { userId, headers } = await createLoggedInUser();
    const json = await exportBackupFile(headers);
    await testDb.update(user).set({ name: "変更後の名前" }).where(eq(user.id, userId));

    const result = await readData(
      await requestBff("/api/backup/restore", { method: "POST", headers, rawBody: json }),
      restoreBackupResultSchema,
    );

    expect(result).toEqual({ updatedAccountCount: 1, addedCandidateCount: 0, clientConsentCount: 0 });
    const [userRow] = await testDb.select({ name: user.name }).from(user).where(eq(user.id, userId));
    expect(userRow?.name).toBe("仮ユーザー");
  });

  it("長い表示名の外部アカウントと連携先を含むファイルも、出力したまま復元できる", async () => {
    const { userId, headers } = await createLoggedInUser();
    const longName = "あ".repeat(90);
    await testDb
      .update(externalAccounts)
      .set({ displayName: longName })
      .where(eq(externalAccounts.userId, userId));
    await testDb
      .insert(clientConsents)
      .values({ userId, clientId: createRandomId("client-"), displayName: longName, consented: true });
    const json = await exportBackupFile(headers);

    const result = await readData(
      await requestBff("/api/backup/restore", { method: "POST", headers, rawBody: json }),
      restoreBackupResultSchema,
    );

    expect(result).toEqual({ updatedAccountCount: 1, addedCandidateCount: 0, clientConsentCount: 1 });
  });

  it("5MiBちょうどのファイルを受け付け、1 byte超えると413 `REQUEST_TOO_LARGE`にしてデータを変更しない", async () => {
    const { userId, headers } = await createLoggedInUser();
    const backup: Backup = {
      ...v.parse(backupSchema, JSON.parse(await exportBackupFile(headers))),
      profile: { displayName: "境界の名前" },
    };
    const json = JSON.stringify(backup);
    const padded = (bytes: number) => json + " ".repeat(bytes - new TextEncoder().encode(json).length);

    const tooLarge = await requestBff("/api/backup/restore", {
      method: "POST",
      headers,
      rawBody: padded(jsonFileMaxBytes + 1),
    });
    expect(tooLarge.status).toBe(413);
    expect(await readProblem(tooLarge)).toMatchObject({ code: "REQUEST_TOO_LARGE" });
    const [unchanged] = await testDb.select({ name: user.name }).from(user).where(eq(user.id, userId));
    expect(unchanged?.name).toBe("仮ユーザー");

    const atLimit = await requestBff("/api/backup/restore", {
      method: "POST",
      headers,
      rawBody: padded(jsonFileMaxBytes),
    });
    expect(atLimit.status).toBe(200);
    const [restored] = await testDb.select({ name: user.name }).from(user).where(eq(user.id, userId));
    expect(restored?.name).toBe("境界の名前");
  });

  it("形式の不備を項目ごとにまとめて400で返し、データを変更しない", async () => {
    const { userId, headers } = await createLoggedInUser();
    const backup = JSON.parse(await exportBackupFile(headers)) as Record<string, unknown>;

    const response = await requestBff("/api/backup/restore", {
      method: "POST",
      headers,
      body: { ...backup, schemaVersion: 2, profile: { displayName: "反映されない名前" }, email: "x" },
    });

    expect(response.status).toBe(400);
    const problem = await readProblem(response);
    expect(problem.errors?.map((issue) => ({ code: issue.code, path: issue.path }))).toEqual([
      { code: "INVALID_VALUE", path: ["schemaVersion"] },
      { code: "UNKNOWN_FIELD", path: ["email"] },
    ]);
    const [userRow] = await testDb.select({ name: user.name }).from(user).where(eq(user.id, userId));
    expect(userRow?.name).toBe("仮ユーザー");
  });

  it("照合の不備も項目ごとに400で返す", async () => {
    const { headers } = await createLoggedInUser();
    const backup = v.parse(backupSchema, JSON.parse(await exportBackupFile(headers)));

    const response = await requestBff("/api/backup/restore", {
      method: "POST",
      headers,
      body: {
        ...backup,
        clientConsents: [
          { clientId: "points-client", displayName: "Points", consented: true },
          { clientId: "points-client", displayName: "Points", consented: false },
        ],
      },
    });

    expect(response.status).toBe(400);
    expect((await readProblem(response)).errors).toEqual([
      expect.objectContaining({ code: "INVALID_VALUE", path: ["clientConsents", 1, "consented"] }),
    ]);
  });
});
