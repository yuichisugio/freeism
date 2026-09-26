import { describe, expect, it } from "vitest";

import { buildResolveTarget } from "./resolve-target";

describe("buildResolveTarget", () => {
  it.each([
    [
      "URLは登録と同じ規則で正規化した値で照合する",
      { type: "url", url: "HTTPS://Example.COM:443/%7Ealice#top" },
      {
        kind: "identifier",
        key: { kind: "url", provider: "", value: "https://example.com/~alice" },
      },
    ],
    [
      "固有IDはそのままの値で照合する",
      { type: "provider_account", provider: "github", accountId: "AbC123" },
      {
        kind: "identifier",
        key: { kind: "provider_account", provider: "github", value: "AbC123" },
      },
    ],
    [
      "ユーザー名はProvider表の規則で小文字化する",
      { type: "provider_username", provider: "github", username: "Alice" },
      {
        kind: "identifier",
        key: { kind: "provider_username", provider: "github", value: "alice" },
      },
    ],
    [
      "小文字化しないProviderのユーザー名は表記を保つ",
      { type: "provider_username", provider: "stackoverflow", username: "Jon" },
      {
        kind: "identifier",
        key: { kind: "provider_username", provider: "stackoverflow", value: "Jon" },
      },
    ],
    [
      "AccountsユーザーIDはIDの存在と同意の確認に回す",
      { type: "accounts_user", accountsUserId: "ausr_example" },
      { kind: "accounts_user", accountsUserId: "ausr_example" },
    ],
  ] as const)("%s", (_, identifier, expected) => {
    expect(buildResolveTarget(identifier)).toEqual({ ok: true, target: expected });
  });

  it.each([
    ["port", "https://example.com:8443/alice"],
    ["userinfo", "https://user@example.com/alice"],
    ["localhost", "https://localhost/alice"],
    ["IP literal", "https://192.0.2.1/alice"],
    ["末尾ドットのhost", "https://example.com./alice"],
    ["正規化後の2,048 bytes超過", `https://example.com/${"%E3%81%82".repeat(230)}`],
  ])("URLの受付制約（%s）に違反する入力はurlのINVALID_VALUEにする", (_, url) => {
    expect(buildResolveTarget({ type: "url", url })).toEqual({
      ok: false,
      error: { code: "INVALID_VALUE", message: expect.any(String), path: ["url"] },
    });
  });
});
