import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { decideApplicationType } from "../../backend/domain/oauth-client/decide-application-type";
import { oauthClientSchema } from "./oauth-client-schema";

const validInput = {
  name: "Markets",
  uri: null,
  description: null,
  redirectUris: ["https://markets.example.test/callback"],
  jwks: { keys: [{ kty: "OKP", crv: "Ed25519", x: "public-key" }] },
};

describe("OAuth クライアント登録入力", () => {
  it("任意項目が null でも受け付ける", () => {
    expect(v.safeParse(oauthClientSchema, validInput).success).toBe(true);
  });

  it("名前・リダイレクト URL・公開鍵を必須とする", () => {
    for (const input of [
      { ...validInput, name: "" },
      { ...validInput, redirectUris: [] },
      { ...validInput, jwks: { keys: [] } },
    ]) {
      expect(v.safeParse(oauthClientSchema, input).success).toBe(false);
    }
  });

  it("紹介 URL は HTTPS に限定する", () => {
    expect(
      v.safeParse(oauthClientSchema, { ...validInput, uri: "http://markets.example.test" }).success,
    ).toBe(false);
  });

  it("loopback HTTP を許可し、含むクライアントを native にする", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const redirectUris = [
        "https://markets.example.test/callback",
        `http://${host}:3000/callback`,
      ];
      expect(v.safeParse(oauthClientSchema, { ...validInput, redirectUris }).success).toBe(true);
      expect(decideApplicationType(redirectUris)).toBe("native");
    }
    expect(decideApplicationType(validInput.redirectUris)).toBe("web");
  });

  it("外部 HTTP・loopback HTTPS・fragment を拒否する", () => {
    for (const redirectUri of [
      "http://markets.example.test/callback",
      "https://localhost/callback",
      "https://markets.example.test/callback#fragment",
    ]) {
      expect(
        v.safeParse(oauthClientSchema, { ...validInput, redirectUris: [redirectUri] }).success,
      ).toBe(false);
    }
  });
});
