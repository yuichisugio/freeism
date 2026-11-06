import * as v from "valibot";

import { oauthClientSchema } from "../../../shared/schemas/oauth-client-schema";
import type { OAuthClientDetail } from "../../../shared/schemas/oauth-client-schema";

/**
 * OAuthクライアントの入力欄の値と、送信前の検査。
 * 検査は共有schemaで行い、公開鍵のJSON構文だけを画面側で先に確認する。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./oauth-client-form.test.ts
 */

// --------------------------------------------------
// 入力欄の値
// --------------------------------------------------

/**
 * 入力欄の値。
 * 公開鍵は編集できるようJSONの文字列で持つ。
 */
export type OAuthClientForm = {
  name: string;
  uri: string;
  description: string;
  redirectUris: string[];
  jwksText: string;
};

export type OAuthClientTextField = "name" | "uri" | "description" | "jwksText";

/**
 * 新規登録の入力欄の初期値。
 */
export const emptyOAuthClientForm: OAuthClientForm = {
  name: "",
  uri: "",
  description: "",
  redirectUris: [""],
  jwksText: "",
};

/**
 * 登録済みクライアントの内容を入力欄の値にする。
 */
export function toOAuthClientForm(client: OAuthClientDetail): OAuthClientForm {
  return {
    name: client.name,
    uri: client.uri ?? "",
    description: client.description ?? "",
    redirectUris: client.redirectUris.length === 0 ? [""] : client.redirectUris,
    jwksText: JSON.stringify(client.jwks, null, 2),
  };
}

/**
 * 入力欄の値が同じか判定する。
 */
export function isSameOAuthClientForm(left: OAuthClientForm, right: OAuthClientForm): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

// --------------------------------------------------
// 検査
// --------------------------------------------------

/**
 * 項目ごとの入力不備。
 * `redirectUris`は入力欄の行と同じ並びで、不備の無い行は`undefined`。
 */
export type OAuthClientFieldErrors = {
  name?: "required";
  uri?: "invalidUrl";
  redirectUris: ("required" | "invalidRedirectUri" | undefined)[];
  jwks?: "required" | "invalidJson" | "invalidKeys";
};

export type OAuthClientRequestBody = v.InferOutput<typeof oauthClientSchema>;

/**
 * 入力欄の値を検査し、送信内容と項目ごとの入力不備を返す。
 * 未入力の紹介URL・説明文は`null`として送る。
 */
export function parseOAuthClientForm(form: OAuthClientForm): {
  input: OAuthClientRequestBody | null;
  errors: OAuthClientFieldErrors;
} {
  const errors: OAuthClientFieldErrors = { redirectUris: form.redirectUris.map(() => undefined) };
  const jwks = parseJwksText(form.jwksText);
  if (!jwks.success) errors.jwks = jwks.error;

  const result = v.safeParse(oauthClientSchema, {
    name: form.name,
    uri: form.uri.trim() === "" ? null : form.uri,
    description: form.description.trim() === "" ? null : form.description,
    redirectUris: form.redirectUris,
    jwks: jwks.success ? jwks.value : undefined,
  });
  if (result.success) return { input: jwks.success ? result.output : null, errors };

  for (const issue of result.issues) {
    const [field, index] = issue.path?.map((item) => item.key) ?? [];
    if (field === "name") errors.name = "required";
    if (field === "uri") errors.uri = "invalidUrl";
    if (field === "jwks") errors.jwks ??= "invalidKeys";
    if (field === "redirectUris" && typeof index === "number") {
      errors.redirectUris[index] = form.redirectUris[index]?.trim() === "" ? "required" : "invalidRedirectUri";
    }
  }
  return { input: null, errors };
}

/**
 * 公開鍵の入力をJSONとして読む。
 * `keys`の内容は共有schemaで検査する。
 */
function parseJwksText(
  text: string,
): { success: true; value: unknown } | { success: false; error: "required" | "invalidJson" } {
  if (text.trim() === "") return { success: false, error: "required" };
  try {
    return { success: true, value: JSON.parse(text) };
  } catch {
    return { success: false, error: "invalidJson" };
  }
}
