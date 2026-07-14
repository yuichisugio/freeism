import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";

type IntrospectionPayload = Record<string, unknown> & {
  client_id?: unknown;
  iss?: unknown;
  scope?: unknown;
  sub?: unknown;
};

export interface PointsOAuthResourceConfig {
  allowedScopes: readonly string[];
  audience: string;
  clientId: string;
  clientSecret: string;
  introspectionUrl: string;
  issuer: string;
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
    remoteVerify: {
      clientId: string;
      clientSecret: string;
      force: true;
      introspectUrl: string;
    };
    scopes: string[];
    verifyOptions: { audience: string; issuer: string };
  },
) => Promise<IntrospectionPayload>;

const standardResourceClient = oauthProviderResourceClient().getActions();

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Error("INVALID_ACCESS_TOKEN");
  const token = header.slice(7).trim();
  if (token.length === 0 || token.split(".").length === 3) {
    throw new Error("INVALID_ACCESS_TOKEN");
  }
  return token;
}

function scopeList(payload: IntrospectionPayload): string[] {
  const raw = payload.scope;
  if (typeof raw !== "string") return [];
  return [...new Set(raw.split(/\s+/).filter(Boolean))].sort();
}

export async function introspectResourceRequest(
  request: Request,
  config: PointsOAuthResourceConfig,
  requiredScopes: readonly string[],
  verify: VerifyResourceRequest = standardResourceClient.verifyAccessTokenRequest,
): Promise<PointsOAuthPrincipal> {
  bearerToken(request);
  let payload: IntrospectionPayload;
  try {
    payload = await verify(request, {
      remoteVerify: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        force: true,
        introspectUrl: config.introspectionUrl,
      },
      scopes: [...requiredScopes],
      verifyOptions: { audience: config.audience, issuer: config.issuer },
    });
  } catch {
    throw new Error("INVALID_ACCESS_TOKEN");
  }

  const clientId = payload.client_id;
  const issuer = payload.iss;
  const scopes = scopeList(payload);
  if (
    clientId !== config.clientId ||
    issuer !== config.issuer ||
    scopes.some((scope) => !config.allowedScopes.includes(scope)) ||
    requiredScopes.some((scope) => !scopes.includes(scope))
  ) {
    throw new Error("INVALID_ACCESS_TOKEN");
  }

  if (config.kind === "USER") {
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new Error("INVALID_ACCESS_TOKEN");
    }
    return { clientId, issuer, kind: "USER", scopes, subject: payload.sub };
  }
  if (payload.sub !== undefined) throw new Error("INVALID_ACCESS_TOKEN");
  return { clientId, issuer, kind: "M2M", scopes };
}
