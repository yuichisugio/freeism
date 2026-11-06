import { oauthClientLimitPerUser } from "../../../shared/constants";
import type { OAuthClientDetail } from "../../../shared/schemas/oauth-client-schema";
import { identitiesReadScope } from "../../auth/create-auth";
import { OAuthClientError, toOAuthClientError } from "./oauth-client-error";
import {
  toOAuthClientDetail,
  toStandardClientFields,
  assertValidClientJwks,
  type OAuthClientDeps,
  type OAuthClientInput,
} from "./oauth-client-fields";

/**
 * 本人のOAuthクライアントを登録する。
 * 本人の所有件数の上限を確認し、公開鍵を標準の検査関数で検査してから、Better Authの管理用登録API（サーバー専用）を呼ぶ。
 * Client Credentials用scopeを設定できるのは管理用登録APIだけのため、通常の登録APIは使わない。
 * クライアント認証は`private_key_jwt`（インラインのJWKS）、Access TokenはDPoPに結び付け、Authorization Codeのscopeは`openid`だけにする。
 * resourceはOAuth Providerの`clientRegistrationDefaultResources`で登録と同じ処理により関連付く。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/oauth-client-routes.worker.test.ts
 */
export async function registerOAuthClient(
  deps: Pick<OAuthClientDeps, "auth" | "headers">,
  input: OAuthClientInput,
): Promise<OAuthClientDetail> {
  const ownedClients = await deps.auth.api.getOAuthClients({ headers: deps.headers });
  if ((ownedClients?.length ?? 0) >= oauthClientLimitPerUser) {
    throw new OAuthClientError("CLIENT_LIMIT_REACHED");
  }
  assertValidClientJwks(input.jwks);

  try {
    const client = await deps.auth.api.adminCreateOAuthClient({
      headers: deps.headers,
      body: {
        ...toStandardClientFields(input),
        jwks: input.jwks,
        token_endpoint_auth_method: "private_key_jwt",
        grant_types: ["authorization_code", "client_credentials"],
        response_types: ["code"],
        scope: "openid",
        client_credentials_scopes: [identitiesReadScope],
        dpop_bound_access_tokens: true,
      },
    });
    return toOAuthClientDetail(client);
  } catch (error) {
    throw toOAuthClientError(error);
  }
}
