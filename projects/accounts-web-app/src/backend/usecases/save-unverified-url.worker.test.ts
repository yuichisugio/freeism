import { describe, expect, it } from "vitest";

import {
  createTestUser,
  createVerifiedUrlAccount,
  fillUrlIdentifiers,
  readExternalAccounts,
  readIdentifierActivity,
  readVerifications,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import { urlIdentifierLimitPerUser } from "../../shared/constants";
import { saveUnverifiedUrl } from "./save-unverified-url";

const verifiedAt = new Date("2026-09-20T00:00:00.000Z");

describe("saveUnverifiedUrl", () => {
  it("プロフィールURLを、サービス名とURL規則のユーザー名とともに未検証の候補として登録する", async () => {
    const userId = await createTestUser();
    const username = `Alice-${uniqueHost().slice(0, 8)}`;
    const url = `https://github.com/${username}`;

    const result = await saveUnverifiedUrl({ db: testDb }, { userId, url });

    expect(result.created).toBe(true);
    expect(await readExternalAccounts(userId)).toEqual([
      expect.objectContaining({
        id: result.externalAccountId,
        service: "github",
        isPublic: false,
        linkedAt: null,
      }),
    ]);
    expect(await readIdentifierActivity(userId)).toEqual({
      [`url:${url}`]: false,
      [`provider_username:${username.toLowerCase()}`]: false,
    });
    expect(await readVerifications(result.externalAccountId)).toEqual([]);
  });

  it("汎用Webページは、正規化したURLだけを登録する", async () => {
    const userId = await createTestUser();
    const host = uniqueHost();

    await saveUnverifiedUrl({ db: testDb }, { userId, url: `https://${host.toUpperCase()}#top` });

    expect(await readIdentifierActivity(userId)).toEqual({ [`url:https://${host}/`]: false });
    expect(await readExternalAccounts(userId)).toEqual([
      expect.objectContaining({ service: null }),
    ]);
  });

  it("登録済みのURLは、既存の登録・証明・紐付けを変更せずに返す", async () => {
    const userId = await createTestUser();
    const url = `https://${uniqueHost()}/`;
    const existing = await createVerifiedUrlAccount(userId, [url], "bidirectional_link", verifiedAt);

    const result = await saveUnverifiedUrl({ db: testDb }, { userId, url });

    expect(result).toEqual({ externalAccountId: existing.accountId, created: false });
    expect(await readIdentifierActivity(userId)).toEqual({ [`url:${url}`]: true });
    expect(await readVerifications(existing.accountId)).toEqual([
      expect.objectContaining({ verifiedAt, coveredValues: [url] }),
    ]);
  });

  it("本人のURLが上限に達していれば、未登録URLの追加を拒否する", async () => {
    const userId = await createTestUser();
    await fillUrlIdentifiers(userId, urlIdentifierLimitPerUser);

    await expect(
      saveUnverifiedUrl({ db: testDb }, { userId, url: `https://${uniqueHost()}/` }),
    ).rejects.toMatchObject({ status: 409, code: "URL_LIMIT_REACHED" });
  });

  it("上限の1件手前までは追加できる", async () => {
    const userId = await createTestUser();
    await fillUrlIdentifiers(userId, urlIdentifierLimitPerUser - 1);

    await expect(
      saveUnverifiedUrl({ db: testDb }, { userId, url: `https://${uniqueHost()}/` }),
    ).resolves.toMatchObject({ created: true });
  });
});
