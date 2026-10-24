import { describe, expect, it } from "vitest";

import { buildUrlIdentifierKey, buildUrlRuleIdentifierKeys } from "./url-identifier-keys";

describe("buildUrlIdentifierKey", () => {
  it("正規化URL全体を値、正規化hostをhostにしたURL識別子を作る", () => {
    expect(buildUrlIdentifierKey("https://blog.example.com/about")).toEqual({
      kind: "url",
      provider: "",
      issuer: "",
      value: "https://blog.example.com/about",
      host: "blog.example.com",
    });
  });
});

describe("buildUrlRuleIdentifierKeys", () => {
  it("個別対応サービスのプロフィールURLから、小文字化したユーザー名とプロフィールURLの識別子を作る", () => {
    expect(buildUrlRuleIdentifierKeys("https://github.com/Alice")).toEqual([
      { kind: "provider_username", provider: "github", issuer: "", value: "alice", host: null },
      {
        kind: "url",
        provider: "",
        issuer: "",
        value: "https://github.com/Alice",
        host: "github.com",
      },
    ]);
  });

  it("Stack Overflowは数値IDをユーザー名相当の識別子にする", () => {
    expect(buildUrlRuleIdentifierKeys("https://stackoverflow.com/users/22656/jon-skeet")).toEqual([
      { kind: "provider_username", provider: "stackoverflow", issuer: "", value: "22656", host: null },
      {
        kind: "url",
        provider: "",
        issuer: "",
        value: "https://stackoverflow.com/users/22656/jon-skeet",
        host: "stackoverflow.com",
      },
    ]);
  });

  it.each(["https://github.com/alice/repository", "https://example.com/alice"])(
    "プロフィールでない%sからは識別子を作らない",
    (url) => {
      expect(buildUrlRuleIdentifierKeys(url)).toEqual([]);
    },
  );
});
