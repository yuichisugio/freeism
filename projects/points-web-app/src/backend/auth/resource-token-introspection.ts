import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";

type AccessTokenPayload = Record<string, unknown> & {
  client_id?: unknown;
  iss?: unknown;
  scope?: unknown;
  sub?: unknown;
};

export interface PointsOAuthResourceConfig {
  allowedScopes: readonly string[];
  audience: string;
  db: D1Database;
  issuer: string;
  jwksUrl: string;
  kind: "USER" | "M2M";
}

export interface PointsUserOAuthPrincipal {
  clientId: string;
  issuer: string;
  kind: "USER";
  scopes: string[];
  subject: string;
}

export interface PointsM2MOAuthPrincipal {
  clientId: string;
  issuer: string;
  kind: "M2M";
  scopes: string[];
}

export type PointsOAuthPrincipal = PointsUserOAuthPrincipal | PointsM2MOAuthPrincipal;

type VerifyResourceRequest = (
  request: Request,
  options: {
    jwksUrl: string;
    requiredScopes: string[];
    verifyOptions: { audience: string; issuer: string };
  },
) => Promise<AccessTokenPayload>;

const standardResourceClient = oauthProviderResourceClient().getActions();

function scopeList(payload: AccessTokenPayload): string[] {
  if (typeof payload.scope !== "string") return [];
  return [...new Set(payload.scope.split(/\s+/).filter(Boolean))].sort();
}

/**
 * Points APIのJWT Access Tokenを検証し、登録中のClientと利用者状態を確認する。
 */
export async function verifyPointsResourceRequest(
  request: Request,
  config: PointsOAuthResourceConfig,
  requiredScopes: readonly string[],
  verify: VerifyResourceRequest = standardResourceClient.verifyAccessTokenRequest,
): Promise<PointsOAuthPrincipal> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+\.\S+\.\S+$/.test(authorization)) {
    throw new Error("INVALID_ACCESS_TOKEN");
  }

  let payload: AccessTokenPayload;
  try {
    payload = await verify(request, {
      jwksUrl: config.jwksUrl,
      requiredScopes: [...requiredScopes],
      verifyOptions: { audience: config.audience, issuer: config.issuer },
    });
  } catch {
    throw new Error("INVALID_ACCESS_TOKEN");
  }

  const clientId = payload.client_id;
  const subject = payload.sub;
  const scopes = scopeList(payload);
  if (
    typeof clientId !== "string" ||
    clientId.length === 0 ||
    payload.iss !== config.issuer ||
    typeof subject !== "string" ||
    subject.length === 0 ||
    scopes.some((scope) => !config.allowedScopes.includes(scope)) ||
    requiredScopes.some((scope) => !scopes.includes(scope))
  ) {
    throw new Error("INVALID_ACCESS_TOKEN");
  }

  const client = await config.db
    .prepare("SELECT 1 FROM oauth_client WHERE client_id = ? AND coalesce(disabled, 0) = 0")
    .bind(clientId)
    .first();
  if (!client) throw new Error("INVALID_ACCESS_TOKEN");

  if (config.kind === "M2M") {
    if (subject !== clientId) throw new Error("INVALID_ACCESS_TOKEN");
    return { clientId, issuer: config.issuer, kind: "M2M", scopes };
  }

  if (subject === clientId) throw new Error("INVALID_ACCESS_TOKEN");
  const user = await config.db
    .prepare("SELECT 1 FROM points_user WHERE auth_user_id = ? AND account_status = 'ACTIVE'")
    .bind(subject)
    .first();
  if (!user) throw new Error("INVALID_ACCESS_TOKEN");
  return { clientId, issuer: config.issuer, kind: "USER", scopes, subject };
}
