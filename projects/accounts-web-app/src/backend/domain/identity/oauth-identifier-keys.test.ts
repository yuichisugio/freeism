import { describe, expect, it } from "vitest";

import { buildOAuthIdentifierKeys } from "./oauth-identifier-keys";

describe("buildOAuthIdentifierKeys", () => {
  it("Googleは固有IDだけを識別子にする", () => {
    expect(
      buildOAuthIdentifierKeys({ providerId: "google", accountId: "1234567890", username: null }),
    ).toEqual([
      { kind: "provider_account", provider: "google", issuer: "", value: "1234567890", host: null },
    ]);
  });

  it("GitHubは固有ID・小文字化したユーザー名・Provider応答の表記のプロフィールURLを識別子にする", () => {
    expect(
      buildOAuthIdentifierKeys({ providerId: "github", accountId: "42", username: "Alice-Dev" }),
    ).toEqual([
      { kind: "provider_account", provider: "github", issuer: "", value: "42", host: null },
      { kind: "provider_username", provider: "github", issuer: "", value: "alice-dev", host: null },
      {
        kind: "url",
        provider: "",
        issuer: "",
        value: "https://github.com/Alice-Dev",
        host: "github.com",
      },
    ]);
  });

  it("GitHubでユーザー名を取得できない場合は固有IDだけを識別子にする", () => {
    expect(
      buildOAuthIdentifierKeys({ providerId: "github", accountId: "42", username: null }),
    ).toEqual([
      { kind: "provider_account", provider: "github", issuer: "", value: "42", host: null },
    ]);
  });

  it("ORCIDは固有IDとiDのプロフィールURLを識別子にする", () => {
    expect(
      buildOAuthIdentifierKeys({
        providerId: "orcid",
        accountId: "0000-0002-1825-0097",
        username: null,
      }),
    ).toEqual([
      {
        kind: "provider_account",
        provider: "orcid",
        issuer: "",
        value: "0000-0002-1825-0097",
        host: null,
      },
      {
        kind: "url",
        provider: "",
        issuer: "",
        value: "https://orcid.org/0000-0002-1825-0097",
        host: "orcid.org",
      },
    ]);
  });
});
