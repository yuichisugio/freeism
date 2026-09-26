import { describe, expect, it } from "vite-plus/test";

import type { AccountsResolveIdentifier } from "../accounts/accounts-api-schema";
import { AccountsClientError } from "../accounts/accounts-http";
import type { AccountsResourceClient } from "../accounts/accounts-resource-client";
import {
  AccountsRecipientResolutionError,
  createAccountsRecipientResolver,
  recipientBusinessKey,
  type RecipientIdentifier,
} from "./accounts-recipient-resolver";

// --------------------------------------------------
// 準備
// --------------------------------------------------

const accountsOrigin = "https://accounts.example.test";

type ResolveIdentifiers = AccountsResourceClient["resolveIdentifiers"];

/**
 * 照合要求を記録し、`answer`の結果を返す資源APIクライアントで照合関数を作る。
 */
function createResolverWith(answer: ResolveIdentifiers) {
  const requests: AccountsResolveIdentifier[][] = [];
  const resolve = createAccountsRecipientResolver(async (accountsConnectionId) =>
    accountsConnectionId === "acon_active"
      ? {
          connection: { accountsOrigin },
          resourceClient: {
            resolveIdentifiers: (identifiers) => {
              requests.push(identifiers);
              return answer(identifiers);
            },
          },
        }
      : null,
  )("acon_active");
  return { requests, resolve };
}

/** すべての識別子を`no_match`にする応答。 */
const answerNoMatch: ResolveIdentifiers = async (identifiers) =>
  identifiers.map((identifier, index) => ({
    index,
    identifier,
    status: "no_match",
    accountsUserId: null,
    errors: [],
  }));

const url = (value: string): RecipientIdentifier => ({ type: "url", value });

// --------------------------------------------------
// 照合
// --------------------------------------------------

describe("createAccountsRecipientResolver", () => {
  it("入力識別子をAccountsの識別子へ変換し、結果を入力順で返す", async () => {
    const { requests, resolve } = createResolverWith(async (identifiers) =>
      identifiers.map((identifier, index) => ({
        index,
        identifier,
        status: index === 0 ? "matched" : index === 1 ? "no_match" : "invalid_input",
        accountsUserId: index === 0 ? "ausr_alice" : null,
        errors: [],
      })),
    );

    await expect(
      resolve([
        { type: "accounts_user", value: "ausr_alice" },
        url("https://example.com/bob"),
        url("not a url"),
      ]),
    ).resolves.toEqual({
      accountsOrigin,
      results: [
        { status: "matched", accountsUserId: "ausr_alice" },
        { status: "no_match" },
        { status: "invalid_input" },
      ],
    });
    expect(requests).toEqual([
      [
        { type: "accounts_user", accountsUserId: "ausr_alice" },
        { type: "url", url: "https://example.com/bob" },
        { type: "url", url: "not a url" },
      ],
    ]);
  });

  it("同じ識別子は1回だけ照合し、同じ結果を各入力へ戻す", async () => {
    const { requests, resolve } = createResolverWith(async (identifiers) =>
      identifiers.map((identifier, index) => ({
        index,
        identifier,
        status: "matched",
        accountsUserId: `ausr_${index}`,
        errors: [],
      })),
    );

    const { results } = await resolve([
      url("https://example.com/alice"),
      url("https://example.com/bob"),
      url("https://example.com/alice"),
      { type: "accounts_user", value: "https://example.com/alice" },
    ]);

    expect(requests[0]).toHaveLength(3);
    expect(results).toEqual([
      { status: "matched", accountsUserId: "ausr_0" },
      { status: "matched", accountsUserId: "ausr_1" },
      { status: "matched", accountsUserId: "ausr_0" },
      { status: "matched", accountsUserId: "ausr_2" },
    ]);
  });

  it("1,000件を超える識別子は1,000件ずつに分けて照合する", async () => {
    const { requests, resolve } = createResolverWith(answerNoMatch);

    const { results } = await resolve(
      Array.from({ length: 2001 }, (_, index) => url(`https://example.com/${index}`)),
    );

    expect(requests.map((request) => request.length)).toEqual([1000, 1000, 1]);
    expect(results).toHaveLength(2001);
  });

  it("識別子が無い場合はAccountsへ要求せず、接続先のoriginを返す", async () => {
    const { requests, resolve } = createResolverWith(answerNoMatch);

    await expect(resolve([])).resolves.toEqual({ accountsOrigin, results: [] });
    expect(requests).toEqual([]);
  });

  it("ACTIVEでない接続先はACCOUNTS_CONNECTION_NOT_ACTIVEで拒否する", async () => {
    const resolve = createAccountsRecipientResolver(async () => null)("acon_withdrawn");

    await expect(resolve([url("https://example.com/alice")])).rejects.toMatchObject({
      code: "ACCOUNTS_CONNECTION_NOT_ACTIVE",
    });
  });

  it("matchedなのにAccountsユーザーIDが無い応答はACCOUNTS_UNAVAILABLEにする", async () => {
    const { resolve } = createResolverWith(async ([identifier]) => [
      { index: 0, identifier, status: "matched", accountsUserId: null, errors: [] },
    ]);

    await expect(resolve([url("https://example.com/alice")])).rejects.toMatchObject({
      code: "ACCOUNTS_UNAVAILABLE",
    });
  });

  it.each([
    ["NETWORK_ERROR", "ACCOUNTS_UNAVAILABLE"],
    ["UNAVAILABLE", "ACCOUNTS_UNAVAILABLE"],
    ["INVALID_RESPONSE", "ACCOUNTS_UNAVAILABLE"],
    ["PAYLOAD_TOO_LARGE", "ACCOUNTS_UNAVAILABLE"],
    ["REQUEST_INVALID", "ACCOUNTS_UNAVAILABLE"],
    ["CLIENT_UNAUTHORIZED", "ACCOUNTS_CLIENT_UNAUTHORIZED"],
  ] as const)("Accountsとのやり取りの失敗%sを%sにする", async (clientCode, code) => {
    const { resolve } = createResolverWith(async () => {
      throw new AccountsClientError(clientCode);
    });

    await expect(resolve([url("https://example.com/alice")])).rejects.toMatchObject({ code });
  });

  it("制限超過はRetry-Afterの値を引き継ぐ", async () => {
    const { resolve } = createResolverWith(async () => {
      throw new AccountsClientError("RATE_LIMITED", "30");
    });

    const error = await resolve([url("https://example.com/alice")]).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(AccountsRecipientResolutionError);
    expect(error).toMatchObject({ code: "ACCOUNTS_UNAVAILABLE", retryAfter: "30" });
  });
});

// --------------------------------------------------
// 補助
// --------------------------------------------------

describe("FIX recipient business key", () => {
  it("keeps the URL value as entered without normalization", () => {
    expect(
      recipientBusinessKey({ type: "url", value: "https://github.com/alice/" }, "https://a.test"),
    ).toBe("url:https://github.com/alice/");
  });

  it("scopes an Accounts user ID by the Accounts origin", () => {
    expect(
      recipientBusinessKey({ type: "accounts_user", value: "ausr_1" }, "https://a.test"),
    ).not.toBe(recipientBusinessKey({ type: "accounts_user", value: "ausr_1" }, "https://b.test"));
  });
});
