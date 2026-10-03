import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import {
  createDpopReplayStore,
  createInsufficientScopeError,
  enforceDpopBinding,
  isDpopBindingError,
  parseAccessTokenAuthorization,
  verifyJwsAccessToken,
} from "better-auth/oauth2";

import { createResourceApiIdentifier, identitiesReadScope, type Auth } from "./create-auth";

/**
 * 資源API（`/api/v1/*`）の要求を送ったクライアントの認証結果。
 * 失敗時の`wwwAuthenticate`はBetter Authの標準の資源サーバー用challengeで、応答ヘッダーへそのまま付ける。
 */
export type ClientAccessTokenResult =
  | { ok: true; clientId: string }
  | { ok: false; status: 401 | 403; wwwAuthenticate: string };

/**
 * 検証済みのAccess Tokenのclaims。
 */
type AccessTokenPayload = Awaited<ReturnType<typeof verifyJwsAccessToken>>;

/**
 * トークン自体の不備による検証エラーか判定する。
 * 標準の`verifyAccessTokenRequest`と同じく、JWTとして読めない形式（`TypeError`）とjoseの検証エラー（`code`が`ERR_J`で始まる）を対象にする。
 * 検証鍵の読取（D1）の障害などは認証失敗にせず、そのまま投げる。
 */
function isTokenVerificationError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return error instanceof TypeError || (typeof code === "string" && code.startsWith("ERR_J"));
}

/**
 * 認証失敗（401 `invalid_token`）を作る。
 */
function invalidToken(description: string): APIError {
  return new APIError("UNAUTHORIZED", {
    message: description,
    error: "invalid_token",
    error_description: description,
  });
}

/**
 * Access Tokenの`scope`に必要なscopeが含まれるか確認する。
 */
function hasScope(payload: AccessTokenPayload, scope: string): boolean {
  return typeof payload.scope === "string" && payload.scope.split(" ").includes(scope);
}

/**
 * 資源APIの要求から、DPoPで送られたクライアント用Access Tokenを検証し、認証済みClient IDを返す。
 * 標準の`verifyAccessTokenRequest`と同じ順（Authorizationの解析、JWT検証、scope、DPoPの結び付け）で、同じ標準部品を使う。
 * 検証鍵はネットワーク経由のJWKS URLではなく、同じWorkerのJWTプラグインから読む。
 * そのうえで、DPoP方式の必須、`sub === client_id`（クライアント用トークン）、クライアントの存在・有効性を確認する。
 * DPoP proofの再送は、標準の`createDpopReplayStore`を認証DBへ接続して拒否する。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./verify-client-access-token.worker.test.ts
 */
export async function verifyClientAccessToken(
  request: Request,
  { auth, accountsOrigin }: { auth: Auth; accountsOrigin: string },
): Promise<ClientAccessTokenResult> {
  const resource = createResourceApiIdentifier(accountsOrigin);
  try {
    const authorization = parseAccessTokenAuthorization(request.headers.get("authorization"));
    if (authorization?.scheme !== "DPoP" || !authorization.token) {
      throw invalidToken("DPoP authorization scheme is required");
    }

    let payload: AccessTokenPayload;
    try {
      payload = await verifyJwsAccessToken(authorization.token, {
        jwksFetch: () => auth.api.getJwks(),
        jwksCacheKey: auth,
        verifyOptions: { issuer: accountsOrigin, audience: resource },
      });
    } catch (error) {
      if (isTokenVerificationError(error)) {
        throw invalidToken("invalid access token");
      }
      throw error;
    }
    if (typeof payload.client_id !== "string" || payload.sub !== payload.client_id) {
      throw invalidToken("client access token is required");
    }
    if (!hasScope(payload, identitiesReadScope)) {
      throw createInsufficientScopeError([identitiesReadScope]);
    }

    const context = await auth.$context;
    try {
      await enforceDpopBinding({
        payload,
        authorization,
        proofJwt: request.headers.get("dpop"),
        method: request.method,
        url: request.url,
        replayStore: createDpopReplayStore(context.internalAdapter),
      });
    } catch (error) {
      if (isDpopBindingError(error)) {
        throw new APIError("UNAUTHORIZED", {
          message: error.message,
          error: error.code,
          error_description: error.message,
        });
      }
      throw error;
    }

    // 削除・無効化されたクライアントの発行済みトークンは、期限内でも受け付けない。
    const client = await context.adapter.findOne<{ disabled: boolean | null }>({
      model: "oauthClient",
      where: [{ field: "clientId", value: payload.client_id }],
    });
    if (!client || client.disabled) {
      throw invalidToken("client is not active");
    }

    return { ok: true, clientId: payload.client_id };
  } catch (error) {
    const challenge = createResourceServerChallenge(error, resource);
    if (!challenge) {
      throw error;
    }
    return {
      ok: false,
      status: challenge.statusCode === 403 ? 403 : 401,
      wwwAuthenticate: new Headers(challenge.headers).get("WWW-Authenticate") ?? "",
    };
  }
}
