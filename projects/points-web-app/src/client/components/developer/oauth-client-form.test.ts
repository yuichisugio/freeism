import { describe, expect, it } from "vite-plus/test";

import { emptyOAuthClientForm, parseOAuthClientForm, toOAuthClientForm } from "./oauth-client-form";

const jwks = { keys: [{ kty: "EC", crv: "P-256", x: "x", y: "y" }] };
const completeForm = {
  ...emptyOAuthClientForm,
  name: "Markets",
  redirectUris: ["https://markets.example/callback", "http://localhost:3000/callback"],
  jwksText: JSON.stringify(jwks),
};

describe("OAuth クライアントの入力", () => {
  it("必須項目だけで登録でき、任意項目を null として送る", () => {
    const { input, errors } = parseOAuthClientForm(completeForm);
    expect(errors).toEqual({ redirectUris: [undefined, undefined] });
    expect(input).toEqual({
      name: "Markets",
      uri: null,
      description: null,
      redirectUris: completeForm.redirectUris,
      jwks,
    });
  });

  it("リダイレクト URL と JWKS を共有 schema で検査する", () => {
    const { input, errors } = parseOAuthClientForm({
      ...completeForm,
      uri: "http://markets.example",
      redirectUris: ["http://markets.example/callback", ""],
      jwksText: '{"keys":[]}',
    });
    expect(input).toBeNull();
    expect(errors.uri).toBeDefined();
    expect(errors.redirectUris).toEqual([
      "HTTPS またはローカル開発用 HTTP の URL を入力してください。",
      "リダイレクト URL を入力してください。",
    ]);
    expect(errors.jwks).toBeDefined();
  });

  it("編集時は登録済みの任意項目と複数 URL を表示する", () => {
    expect(
      toOAuthClientForm({
        clientId: "client-1",
        name: "Markets",
        uri: "https://markets.example",
        description: "市場",
        redirectUris: completeForm.redirectUris,
        jwks,
      }),
    ).toEqual({
      ...completeForm,
      uri: "https://markets.example",
      description: "市場",
      jwksText: JSON.stringify(jwks, null, 2),
    });
  });
});
