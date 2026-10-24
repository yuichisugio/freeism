import * as v from "valibot";
import { describe, expect, it } from "vite-plus/test";

import externalAccounts from "../../../test/fixtures/accounts/external-accounts.json";
import resolveInvalidInput from "../../../test/fixtures/accounts/resolve-invalid-input.json";
import {
  accountsExternalAccountListSchema,
  accountsResolveResponseSchema,
  accountsResourceErrorResponseSchema,
} from "./accounts-api-schema";

describe("Accounts資源APIの応答schema", () => {
  it("仕様例の一覧取得・照合・エラーの応答を読める", () => {
    expect(v.parse(accountsExternalAccountListSchema, externalAccounts)).toEqual(externalAccounts);
    expect(v.parse(accountsResolveResponseSchema, resolveInvalidInput)).toEqual(
      resolveInvalidInput,
    );
    expect(
      v.parse(accountsResourceErrorResponseSchema, {
        errors: [{ code: "NOT_FOUND", message: "Not found.", path: null }],
      }),
    ).toEqual({ errors: [{ code: "NOT_FOUND", message: "Not found.", path: null }] });
  });

  it("未知の項目は取り除いて読む", () => {
    const [externalAccount] = externalAccounts.externalAccounts;
    const extended = {
      ...externalAccounts,
      futureField: true,
      externalAccounts: [{ ...externalAccount, futureField: true }],
    };

    expect(v.parse(accountsExternalAccountListSchema, extended)).toEqual(externalAccounts);
  });

  it.each([
    [
      "accountsOriginが無い一覧",
      accountsExternalAccountListSchema,
      { ...externalAccounts, accountsOrigin: undefined },
    ],
    [
      "verificationStatusが範囲外の一覧",
      accountsExternalAccountListSchema,
      {
        ...externalAccounts,
        externalAccounts: [
          { ...externalAccounts.externalAccounts[0], verificationStatus: "pending" },
        ],
      },
    ],
    [
      "statusが範囲外の照合結果",
      accountsResolveResponseSchema,
      {
        ...resolveInvalidInput,
        results: [{ ...resolveInvalidInput.results[0], status: "unknown" }],
      },
    ],
    ["errorsが無いエラー応答", accountsResourceErrorResponseSchema, { message: "failed" }],
  ])("%sを拒否する", (_, schema, input) => {
    expect(v.is(schema, input)).toBe(false);
  });
});
