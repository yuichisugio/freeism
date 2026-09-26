import type { OAuthClient } from "@better-auth/oauth-provider";
import { validatePublicClientJwks } from "@better-auth/oauth-provider/internal";
import type * as v from "valibot";

import type {
  OAuthClientDetail,
  oauthClientSchema,
} from "../../../shared/schemas/oauth-client-schema";
import type { Auth } from "../../auth/create-auth";
import type { Database } from "../../db/database";
import { decideApplicationType } from "../../domain/oauth-client/decide-application-type";
import { OAuthClientError } from "./oauth-client-error";

/**
 * OAuthクライアント管理のユースケースが共有する、入力・依存・標準APIとの変換。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

/**
 * 登録・更新の入力（共有schemaで検査済み）。
 */
export type OAuthClientInput = v.InferOutput<typeof oauthClientSchema>;

/**
 * OAuthクライアント管理の依存。
 * `headers`はセッション本人の要求ヘッダーで、Better Authの標準APIが所有者の確認に使う。
 * `userId`はHTTP層がセッションから確定した本人のID。
 */
export type OAuthClientDeps = {
  auth: Auth;
  db: Database;
  headers: Headers;
  userId: string;
};

// --------------------------------------------------
// 標準APIとの変換
// --------------------------------------------------

/**
 * 公開鍵をBetter Authの標準の登録時と同じ関数で検査する。
 * `@better-auth/oauth-provider/internal`は公開APIの互換性保証の対象外のため、版更新時は結合テストで挙動を確認する。
 */
export function assertValidClientJwks(jwks: unknown): void {
  const result = validatePublicClientJwks(jwks);
  if (!result.valid) {
    throw new OAuthClientError("INVALID_JWKS", result.error);
  }
}

/**
 * 登録・更新で共通の、アプリ情報・リダイレクトURL・`application_type`の標準の項目を作る。
 * 説明文は標準の列が無いため`metadata.description`に保存する。
 * 標準の更新APIは値の省略を「変更なし」と扱うため、説明文はnullを渡して消す。
 * 紹介URLは標準の更新APIでは消せないため、更新時は公開鍵と一緒にAccountsの保存処理でNULLにする。
 */
export function toStandardClientFields(input: OAuthClientInput) {
  return {
    client_name: input.name,
    client_uri: input.uri ?? undefined,
    redirect_uris: input.redirectUris,
    application_type: decideApplicationType(input.redirectUris),
    metadata: { description: input.description || null },
  };
}

/**
 * Better Authの標準形式のクライアントを、BFFの応答形式へ変換する。
 * `metadata`の項目は標準の応答の最上位へ展開されている。
 */
export function toOAuthClientDetail(
  client: OAuthClient & { description?: unknown },
): OAuthClientDetail {
  return {
    clientId: client.client_id,
    name: client.client_name ?? "",
    uri: client.client_uri || null,
    description: typeof client.description === "string" ? client.description : null,
    redirectUris: client.redirect_uris,
    // 保存済みの鍵は登録・更新時に標準の検査を通っており、各鍵が`kty`を持つ。
    jwks: (client.jwks ?? { keys: [] }) as OAuthClientDetail["jwks"],
  };
}
