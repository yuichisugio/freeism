import {
  discoveryRequest,
  processDiscoveryResponse,
  processResourceDiscoveryResponse,
  resourceDiscoveryRequest,
  type AuthorizationServer,
} from "oauth4webapi";
import * as v from "valibot";

import {
  AccountsClientError,
  toAccountsRequestOptions,
  toAccountsUnavailableError,
  type AccountsEndpoint,
} from "./accounts-http";
import { toAccountsResourceIdentifier } from "./accounts-origin";

/**
 * 接続先Accountsの`/.well-known/*`メタデータの取得と検査。
 * 接続先の作成・有効化、連携の開始・戻り、トークンの取得のたびに取得し、永続化しない。
 * @see ../../../../accounts-web-app/src/backend/routes/well-known-routes.ts
 * @see ./accounts-discovery.test.ts
 */

// --------------------------------------------------
// 必須とするメタデータ
// --------------------------------------------------

/**
 * `values`をすべて含む文字列の配列。
 */
function arrayIncluding(...values: string[]) {
  return v.pipe(
    v.array(v.string()),
    v.check((items) => values.every((value) => items.includes(value))),
  );
}

/**
 * `accountsOrigin`配下のURL。
 */
function urlUnder(accountsOrigin: string) {
  return v.pipe(
    v.string(),
    v.check((value) => URL.parse(value)?.origin === accountsOrigin),
  );
}

/**
 * OpenID Providerメタデータのうち、Pointsが必須とする項目。
 */
function createOpenIdConfigurationSchema(accountsOrigin: string) {
  return v.object({
    authorization_endpoint: urlUnder(accountsOrigin),
    token_endpoint: urlUnder(accountsOrigin),
    jwks_uri: urlUnder(accountsOrigin),
    token_endpoint_auth_methods_supported: arrayIncluding("private_key_jwt"),
    token_endpoint_auth_signing_alg_values_supported: arrayIncluding("EdDSA"),
    dpop_signing_alg_values_supported: arrayIncluding("EdDSA"),
    id_token_signing_alg_values_supported: arrayIncluding("EdDSA"),
    code_challenge_methods_supported: arrayIncluding("S256"),
    scopes_supported: arrayIncluding("openid", "identities:read"),
    authorization_response_iss_parameter_supported: v.literal(true),
  });
}

/**
 * 資源APIメタデータのうち、Pointsが必須とする項目。
 * `resource`の一致はoauth4webapiが検査する。
 */
function createProtectedResourceSchema(accountsOrigin: string) {
  return v.object({
    authorization_servers: arrayIncluding(accountsOrigin),
    scopes_supported: arrayIncluding("identities:read"),
    dpop_signing_alg_values_supported: arrayIncluding("EdDSA"),
    dpop_bound_access_tokens_required: v.literal(true),
  });
}

// --------------------------------------------------
// 取得
// --------------------------------------------------

/**
 * メタデータを取得し、oauth4webapiの検査を通す。
 * 200以外の応答と、oauth4webapiの検査の失敗を分類する。
 */
async function fetchMetadata<T>(
  send: () => Promise<Response>,
  process: (response: Response) => Promise<T>,
): Promise<T> {
  const response = await send();
  if (response.status !== 200) {
    throw toAccountsUnavailableError(response) ?? new AccountsClientError("DISCOVERY_INVALID");
  }
  try {
    return await process(response);
  } catch (cause) {
    throw new AccountsClientError("DISCOVERY_INVALID", null, { cause });
  }
}

/**
 * 3つのメタデータを取得して検査し、認可サーバーのメタデータを返す。
 * - `openid-configuration`: `issuer`の一致と、Pointsが使うendpoint・方式への対応
 * - `oauth-authorization-server`: `issuer`とendpointが`openid-configuration`と一致すること
 * - `oauth-protected-resource/api/v1`: 資源APIの識別子・認可サーバー・scope・DPoP必須
 */
export async function discoverAccounts(endpoint: AccountsEndpoint): Promise<AuthorizationServer> {
  const { accountsOrigin } = endpoint;
  const issuer = new URL(accountsOrigin);
  const resourceIdentifier = new URL(toAccountsResourceIdentifier(accountsOrigin));
  const options = toAccountsRequestOptions(endpoint);

  const [openIdConfiguration, authorizationServerMetadata, protectedResource] = await Promise.all([
    fetchMetadata(
      () => discoveryRequest(issuer, { ...options, algorithm: "oidc" }),
      (response) => processDiscoveryResponse(issuer, response),
    ),
    fetchMetadata(
      () => discoveryRequest(issuer, { ...options, algorithm: "oauth2" }),
      (response) => processDiscoveryResponse(issuer, response),
    ),
    fetchMetadata(
      () => resourceDiscoveryRequest(resourceIdentifier, options),
      (response) => processResourceDiscoveryResponse(resourceIdentifier, response),
    ),
  ]);

  const isValid =
    v.is(createOpenIdConfigurationSchema(accountsOrigin), openIdConfiguration) &&
    v.is(createProtectedResourceSchema(accountsOrigin), protectedResource) &&
    (["authorization_endpoint", "token_endpoint", "jwks_uri"] as const).every(
      (name) => authorizationServerMetadata[name] === openIdConfiguration[name],
    );
  if (!isValid) throw new AccountsClientError("DISCOVERY_INVALID");
  return openIdConfiguration;
}
