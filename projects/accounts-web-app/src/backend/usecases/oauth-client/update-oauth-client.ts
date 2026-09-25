import type { OAuthClientDetail } from "../../../shared/schemas/oauth-client-schema";
import { D1OAuthClientRepository } from "../../db/repositories/d1-oauth-client-repository";
import { OAuthClientError, toOAuthClientError } from "./oauth-client-error";
import {
  toOAuthClientDetail,
  toStandardClientFields,
  assertValidClientJwks,
  type OAuthClientDeps,
  type OAuthClientInput,
} from "./oauth-client-fields";

/**
 * 本人のOAuthクライアントのアプリ情報・リダイレクトURL・公開鍵を、1回の保存としてまとめて反映する。
 * 公開鍵を先に標準の検査関数で検査し、Better Authの管理用更新API（所有者の確認は標準）でアプリ情報・リダイレクトURL・`application_type`を更新した後、
 * 標準の更新APIが受け付けない公開鍵を、承認済みの拡張として`oauthClient.jwks`へ保存する。
 * 標準の更新APIで消せない紹介URLの削除も、同じ文で保存する。
 * この保存だけが失敗した場合は`CLIENT_KEY_SAVE_FAILED`を返し、同じ内容の再保存で反映する。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/oauth-client-routes.worker.test.ts
 */
export async function updateOAuthClient(
  deps: OAuthClientDeps,
  clientId: string,
  input: OAuthClientInput,
): Promise<OAuthClientDetail> {
  assertValidClientJwks(input.jwks);

  let client;
  try {
    client = await deps.auth.api.adminUpdateOAuthClient({
      headers: deps.headers,
      body: { client_id: clientId, update: toStandardClientFields(input) },
    });
  } catch (error) {
    throw toOAuthClientError(error);
  }

  let isSaved: boolean;
  try {
    isSaved = await new D1OAuthClientRepository(deps.db).updateAccountsManagedFields(
      clientId,
      deps.userId,
      { jwksJson: JSON.stringify(input.jwks), uri: input.uri },
    );
  } catch {
    // 失敗はルートの監査ログに`oauth_client_updated`の失敗として残る。
    throw new OAuthClientError("CLIENT_KEY_SAVE_FAILED");
  }
  if (!isSaved) {
    throw new OAuthClientError("CLIENT_NOT_FOUND");
  }
  return { ...toOAuthClientDetail(client), uri: input.uri, jwks: input.jwks };
}
