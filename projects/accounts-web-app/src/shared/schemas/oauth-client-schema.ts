import * as v from "valibot";

import { urlMaxBytes } from "../constants";
import { httpsUrlSchema } from "./identifier-schema";

/**
 * `/api/oauth-clients`の入力と応答。
 * アプリ名・リダイレクトURL・公開鍵（JWK Set）を必須、紹介URL・説明文を任意とする。
 * 鍵の内容の検査はバックエンドが標準の検査関数で行う。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */

// --------------------------------------------------
// リダイレクトURL
// --------------------------------------------------

/**
 * HTTPで登録できるローカル開発用のhost。
 */
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * リダイレクトURLとして登録できるか判定する。
 * HTTPSのURLと、ローカル開発用hostのHTTPのURLを許可する。
 * fragmentはOAuthの戻り先に使えないため拒否する。
 */
export function isAllowedRedirectUri(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  if (url.hash !== "" || value.includes("#")) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && loopbackHosts.has(url.hostname);
}

export const redirectUriSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.maxBytes(urlMaxBytes),
  v.check(isAllowedRedirectUri, "HTTPS, or HTTP on localhost, 127.0.0.1 or [::1], without a fragment."),
);

// --------------------------------------------------
// 公開鍵
// --------------------------------------------------

/**
 * インラインのJWK Set（`{"keys":[...]}`）。
 */
export const jwksSchema = v.object({
  keys: v.pipe(v.array(v.looseObject({ kty: v.string() })), v.minLength(1)),
});

// --------------------------------------------------
// 入力と応答
// --------------------------------------------------

/**
 * `POST /api/oauth-clients`・`PUT /api/oauth-clients/:clientId`の入力。
 */
export const oauthClientSchema = v.strictObject({
  name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  uri: v.nullable(v.pipe(v.string(), v.trim(), httpsUrlSchema)),
  description: v.nullable(v.pipe(v.string(), v.trim())),
  redirectUris: v.pipe(v.array(redirectUriSchema), v.minLength(1)),
  jwks: jwksSchema,
});

/**
 * 登録済みクライアント1件。
 */
export const oauthClientDetailSchema = v.object({
  clientId: v.string(),
  name: v.string(),
  uri: v.nullable(v.string()),
  description: v.nullable(v.string()),
  redirectUris: v.array(v.string()),
  jwks: jwksSchema,
});

/**
 * `GET /api/oauth-clients`の`data`。
 */
export const oauthClientListSchema = v.object({
  clients: v.array(oauthClientDetailSchema),
});

export type OAuthClientInput = v.InferInput<typeof oauthClientSchema>;
export type OAuthClientDetail = v.InferOutput<typeof oauthClientDetailSchema>;
export type Jwks = v.InferOutput<typeof jwksSchema>;
