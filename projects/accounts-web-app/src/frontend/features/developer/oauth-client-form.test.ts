import { describe, expect, it } from "vitest";

import { emptyOAuthClientForm, parseOAuthClientForm, toOAuthClientForm } from "./oauth-client-form";
import type { OAuthClientForm } from "./oauth-client-form";

const validJwksText = JSON.stringify({ keys: [{ kty: "EC", crv: "P-256", x: "x", y: "y" }] });

const validForm: OAuthClientForm = {
  name: " Points ",
  uri: "",
  description: "",
  redirectUris: ["https://points.example/callback"],
  jwksText: validJwksText,
};

describe("parseOAuthClientForm", () => {
  it("必須項目を満たせば、未入力の紹介URL・説明文をnullにした送信内容を返す", () => {
    const result = parseOAuthClientForm(validForm);

    expect(result.errors).toEqual({ redirectUris: [undefined] });
    expect(result.input).toEqual({
      name: "Points",
      uri: null,
      description: null,
      redirectUris: ["https://points.example/callback"],
      jwks: { keys: [{ kty: "EC", crv: "P-256", x: "x", y: "y" }] },
    });
  });

  it("アプリ名が空白だけなら必須エラーにする", () => {
    const result = parseOAuthClientForm({ ...validForm, name: "  " });

    expect(result.input).toBeNull();
    expect(result.errors.name).toBe("required");
  });

  it("紹介URLがURLの形式でなければエラーにする", () => {
    const result = parseOAuthClientForm({ ...validForm, uri: "points" });

    expect(result.input).toBeNull();
    expect(result.errors.uri).toBe("invalidUrl");
  });

  it("リダイレクトURLは、HTTPSとlocalhostのHTTPを許可し、それ以外の行と空の行をエラーにする", () => {
    const result = parseOAuthClientForm({
      ...validForm,
      redirectUris: [
        "https://points.example/callback",
        "http://localhost:3000/callback",
        "http://points.example/callback",
        "https://points.example/callback#top",
        "",
      ],
    });

    expect(result.input).toBeNull();
    expect(result.errors.redirectUris).toEqual([
      undefined,
      undefined,
      "invalidRedirectUri",
      "invalidRedirectUri",
      "required",
    ]);
  });

  it("公開鍵が未入力・JSONの構文不正・keysの不備をそれぞれ区別する", () => {
    expect(parseOAuthClientForm({ ...validForm, jwksText: " " }).errors.jwks).toBe("required");
    expect(parseOAuthClientForm({ ...validForm, jwksText: "{keys:" }).errors.jwks).toBe("invalidJson");
    expect(parseOAuthClientForm({ ...validForm, jwksText: '{"keys":[]}' }).errors.jwks).toBe("invalidKeys");
    expect(parseOAuthClientForm({ ...validForm, jwksText: '[{"kty":"EC"}]' }).errors.jwks).toBe("invalidKeys");
  });
});

describe("toOAuthClientForm", () => {
  it("登録済みクライアントの内容を入力欄の値にする", () => {
    const form = toOAuthClientForm({
      clientId: "client-1",
      name: "Points",
      uri: null,
      description: "説明",
      redirectUris: ["https://points.example/callback"],
      jwks: { keys: [{ kty: "EC" }] },
    });

    expect(form).toEqual({
      name: "Points",
      uri: "",
      description: "説明",
      redirectUris: ["https://points.example/callback"],
      jwksText: JSON.stringify({ keys: [{ kty: "EC" }] }, null, 2),
    });
    expect(parseOAuthClientForm(form).input).not.toBeNull();
  });

  it("新規登録の入力欄はリダイレクトURLを1行持つ", () => {
    expect(emptyOAuthClientForm.redirectUris).toEqual([""]);
  });
});
