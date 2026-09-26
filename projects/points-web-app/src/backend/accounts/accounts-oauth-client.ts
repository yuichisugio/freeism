import {
  AuthorizationResponseError,
  OperationProcessingError,
  PrivateKeyJwt,
  ResponseBodyError,
  WWWAuthenticateChallengeError,
  authorizationCodeGrantRequest,
  calculatePKCECodeChallenge,
  clientCredentialsGrantRequest,
  generateRandomCodeVerifier,
  generateRandomNonce,
  generateRandomState,
  getValidatedIdTokenClaims,
  modifyAssertion,
  processAuthorizationCodeResponse,
  processClientCredentialsResponse,
  validateApplicationLevelSignature,
  validateAuthResponse,
  type AuthorizationServer,
  type Client,
  type ClientAuth,
  type TokenEndpointResponse,
} from "oauth4webapi";

import { createAccountsDpopHandle, withDpopNonceRetry } from "./accounts-dpop";
import {
  AccountsClientError,
  toAccountsRequestOptions,
  toAccountsUnavailableError,
  type AccountsClientErrorCode,
  type AccountsEndpoint,
} from "./accounts-http";
import type { AccountsSigningKeyPair } from "./accounts-key-vault";
import { toAccountsResourceIdentifier } from "./accounts-origin";

/**
 * AccountsのOAuthクライアント。
 * 利用者の連携（Authorization Code + PKCE + nonce + `prompt=consent`）と、資源API用のClient Credentialsを扱う。
 * token要求は、`private_key_jwt`のclient assertionとDPoP proofを付けて送る。
 * @see ../../../../accounts-web-app/docs/specification/v0.1/main.ja.md
 * @see ../../../../accounts-web-app/test/contract/points-client.worker.test.ts
 * @see ./accounts-oauth-client.test.ts
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

/**
 * Accountsへ登録したPointsのクライアント。
 * `clientKey`はclient assertion用、`dpopKey`はDPoP proof用の鍵。
 */
export type AccountsClient = {
  clientId: string;
  clientKey: AccountsSigningKeyPair;
  dpopKey: AccountsSigningKeyPair;
};

/**
 * token endpointを呼ぶための接続先・メタデータ・クライアント。
 */
export type AccountsOAuthContext = {
  endpoint: AccountsEndpoint;
  authorizationServer: AuthorizationServer;
  client: AccountsClient;
};

/**
 * 連携の開始時に作り、戻り先の処理まで保持する値。
 */
export type AccountsAuthorizationAttempt = {
  state: string;
  nonce: string;
  codeVerifier: string;
};

/**
 * 資源API用のAccess Token。
 * `expiresAt`はUNIX時刻（ミリ秒）。
 */
export type AccountsAccessToken = {
  accessToken: string;
  expiresAt: number;
};

// --------------------------------------------------
// 共通
// --------------------------------------------------

function toOAuthClient(client: AccountsClient): Client {
  return { client_id: client.clientId, id_token_signed_response_alg: "EdDSA" };
}

/**
 * `private_key_jwt`のclient assertion。
 * header `{alg: "EdDSA", typ: "JWT", kid}`、`aud`はtoken endpoint、有効期間は60秒にする。
 */
function toClientAuthentication(
  authorizationServer: AuthorizationServer,
  client: AccountsClient,
): ClientAuth {
  return PrivateKeyJwt(
    { key: client.clientKey.privateKey, kid: client.clientKey.kid },
    {
      [modifyAssertion]: (header, payload) => {
        header.alg = "EdDSA";
        header.typ = "JWT";
        payload.aud = authorizationServer.token_endpoint;
      },
    },
  );
}

/**
 * token endpointの応答が429・5xxの場合は、応答の内容を読まずに失敗とする。
 */
function assertTokenEndpointAvailable(response: Response): Response {
  const failure = toAccountsUnavailableError(response);
  if (failure !== null) throw failure;
  return response;
}

/**
 * token endpointの失敗を分類する。
 * OAuthのエラー応答でない200以外の応答（WAFのHTMLなど）は`INVALID_RESPONSE`にする。
 * @param fallback 200の応答の内容の検査の失敗に使う種類
 */
function toTokenEndpointError(
  error: unknown,
  fallback: AccountsClientErrorCode,
): AccountsClientError {
  if (error instanceof AccountsClientError) return error;
  if (error instanceof ResponseBodyError || error instanceof WWWAuthenticateChallengeError) {
    const oauthError = error instanceof ResponseBodyError ? error.error : null;
    if (error.status === 401 || oauthError === "invalid_client") {
      return new AccountsClientError("CLIENT_UNAUTHORIZED", null, { cause: error });
    }
    if (oauthError === "invalid_grant") {
      return new AccountsClientError("AUTHORIZATION_CODE_INVALID", null, { cause: error });
    }
    return new AccountsClientError("TOKEN_REQUEST_REJECTED", null, { cause: error });
  }
  const isUnexpectedStatus =
    error instanceof OperationProcessingError &&
    error.cause instanceof Response &&
    error.cause.status !== 200;
  return new AccountsClientError(isUnexpectedStatus ? "INVALID_RESPONSE" : fallback, null, {
    cause: error,
  });
}

/**
 * Accountsはトークンを常にDPoPへ結び付け、有効期間を返す。
 */
function assertDpopBoundToken(
  response: TokenEndpointResponse,
): asserts response is TokenEndpointResponse & {
  expires_in: number;
} {
  if (response.token_type !== "dpop" || response.expires_in === undefined) {
    throw new AccountsClientError("INVALID_RESPONSE");
  }
}

// --------------------------------------------------
// 利用者の連携（Authorization Code）
// --------------------------------------------------

/**
 * 認可URLと、戻り先の処理で照合するstate・nonce・code verifierを作る。
 * 同意画面を毎回表示するため、`prompt=consent`を付ける。
 */
export async function createAccountsAuthorizationRequest(
  authorizationServer: AuthorizationServer,
  { clientId, redirectUri }: { clientId: string; redirectUri: string },
): Promise<{ authorizationUrl: string; attempt: AccountsAuthorizationAttempt }> {
  const attempt = {
    state: generateRandomState(),
    nonce: generateRandomNonce(),
    codeVerifier: generateRandomCodeVerifier(),
  };
  const url = new URL(String(authorizationServer.authorization_endpoint));
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid",
    state: attempt.state,
    nonce: attempt.nonce,
    code_challenge: await calculatePKCECodeChallenge(attempt.codeVerifier),
    code_challenge_method: "S256",
    prompt: "consent",
  }).toString();
  return { authorizationUrl: url.href, attempt };
}

/**
 * 認可応答（戻り先のquery）を検査してコードを交換し、ID Tokenを検証して本人のAccountsユーザーIDを返す。
 * ID Tokenは`iss`・`aud`・`exp`・`iat`・`nonce`に加え、署名をAccountsのJWKSで検証する。
 * 認可応答のAccess Tokenは使わない。
 */
export async function exchangeAccountsAuthorizationCode(
  { endpoint, authorizationServer, client }: AccountsOAuthContext,
  {
    callbackParameters,
    redirectUri,
    attempt,
  }: {
    callbackParameters: URLSearchParams;
    redirectUri: string;
    attempt: AccountsAuthorizationAttempt;
  },
): Promise<{ accountsUserId: string }> {
  const oauthClient = toOAuthClient(client);
  let authorizationResponse: URLSearchParams;
  try {
    authorizationResponse = validateAuthResponse(
      authorizationServer,
      oauthClient,
      callbackParameters,
      attempt.state,
    );
  } catch (error) {
    const isDenied = error instanceof AuthorizationResponseError && error.error === "access_denied";
    throw new AccountsClientError(
      isDenied ? "AUTHORIZATION_DENIED" : "AUTHORIZATION_RESPONSE_INVALID",
      null,
      {
        cause: error,
      },
    );
  }

  const options = {
    ...toAccountsRequestOptions(endpoint),
    DPoP: createAccountsDpopHandle(client.dpopKey),
  };
  const clientAuthentication = toClientAuthentication(authorizationServer, client);
  const { response, tokenResponse } = await withDpopNonceRetry(async () => {
    const response = assertTokenEndpointAvailable(
      await authorizationCodeGrantRequest(
        authorizationServer,
        oauthClient,
        clientAuthentication,
        authorizationResponse,
        redirectUri,
        attempt.codeVerifier,
        options,
      ),
    );
    const tokenResponse = await processAuthorizationCodeResponse(
      authorizationServer,
      oauthClient,
      response,
      {
        expectedNonce: attempt.nonce,
        requireIdToken: true,
      },
    );
    return { response, tokenResponse };
  }).catch((error: unknown) => {
    throw toTokenEndpointError(error, "ID_TOKEN_INVALID");
  });

  try {
    await validateApplicationLevelSignature(authorizationServer, response, options);
  } catch (error) {
    throw error instanceof AccountsClientError
      ? error
      : new AccountsClientError("ID_TOKEN_INVALID", null, { cause: error });
  }
  const claims = getValidatedIdTokenClaims(tokenResponse);
  if (claims === undefined) throw new AccountsClientError("ID_TOKEN_INVALID");
  return { accountsUserId: claims.sub };
}

// --------------------------------------------------
// 資源API用のトークン（Client Credentials）
// --------------------------------------------------

/**
 * `identities:read`と資源APIの識別子（`{origin}/api/v1`）で、DPoPへ結び付いたAccess Tokenを取得する。
 * 資源APIの要求には、同じ`dpopKey`のproofが必要になる。
 */
export async function requestAccountsClientCredentialsToken({
  endpoint,
  authorizationServer,
  client,
}: AccountsOAuthContext): Promise<AccountsAccessToken> {
  const oauthClient = toOAuthClient(client);
  const options = {
    ...toAccountsRequestOptions(endpoint),
    DPoP: createAccountsDpopHandle(client.dpopKey),
  };
  const clientAuthentication = toClientAuthentication(authorizationServer, client);
  const requestedAt = Date.now();
  const tokenResponse = await withDpopNonceRetry(async () => {
    const response = assertTokenEndpointAvailable(
      await clientCredentialsGrantRequest(
        authorizationServer,
        oauthClient,
        clientAuthentication,
        {
          scope: "identities:read",
          resource: toAccountsResourceIdentifier(endpoint.accountsOrigin),
        },
        options,
      ),
    );
    return processClientCredentialsResponse(authorizationServer, oauthClient, response);
  }).catch((error: unknown) => {
    throw toTokenEndpointError(error, "INVALID_RESPONSE");
  });

  assertDpopBoundToken(tokenResponse);
  return {
    accessToken: tokenResponse.access_token,
    expiresAt: requestedAt + tokenResponse.expires_in * 1000,
  };
}
