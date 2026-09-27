import type { OAuthClient } from "@better-auth/oauth-provider";
import { validatePublicClientJwks } from "@better-auth/oauth-provider/internal";
import { isAPIError } from "better-auth/api";
import type * as v from "valibot";

import {
  oauthClientLimitPerUser,
  type OAuthClientDetail,
  oauthClientSchema,
} from "../../shared/schemas/oauth-client-schema";
import { createPointsAuth } from "../auth/create-auth";
import { pointsOAuthScopes } from "../auth/points-oauth-provider";
import { decideApplicationType } from "../domain/oauth-client/decide-application-type";
import { updateOAuthClientManagedFields } from "../infrastructure/db/oauth-client-repository";

export type OAuthClientInput = v.InferOutput<typeof oauthClientSchema>;

export class OAuthClientManagementError extends Error {
  constructor(
    readonly code:
      | "CLIENT_NOT_FOUND"
      | "CLIENT_LIMIT_REACHED"
      | "INVALID_JWKS"
      | "INVALID_CLIENT_METADATA"
      | "CLIENT_KEY_SAVE_FAILED",
  ) {
    super(code);
  }
}

export type OAuthClientManagementDeps = {
  auth: ReturnType<typeof createPointsAuth>;
  database: D1Database;
  headers: Headers;
  userId: string;
};

/** Better Auth の登録処理と同じ公開鍵検査を更新時にも適用する。 */
function assertValidJwks(jwks: OAuthClientInput["jwks"]): void {
  if (!validatePublicClientJwks(jwks).valid) {
    throw new OAuthClientManagementError("INVALID_JWKS");
  }
}

/** Accounts v0.1 と同じ画面の入力を Better Auth の管理 API に渡す。 */
function toStandardClientFields(input: OAuthClientInput) {
  return {
    client_name: input.name,
    client_uri: input.uri ?? undefined,
    redirect_uris: input.redirectUris,
    application_type: decideApplicationType(input.redirectUris),
    metadata: { description: input.description || null },
  };
}

function toDetail(client: OAuthClient & { description?: unknown }): OAuthClientDetail {
  return {
    clientId: client.client_id,
    name: client.client_name ?? "",
    uri: client.client_uri || null,
    description: typeof client.description === "string" ? client.description : null,
    redirectUris: client.redirect_uris,
    jwks: (client.jwks ?? { keys: [] }) as OAuthClientDetail["jwks"],
  };
}

/** Better Auth の所有者検査エラーを管理画面用の応答へ変換する。 */
export function toOAuthClientManagementError(error: unknown): unknown {
  if (!isAPIError(error)) return error;
  if (error.status === "NOT_FOUND" || error.status === "UNAUTHORIZED") {
    return new OAuthClientManagementError("CLIENT_NOT_FOUND");
  }
  if (error.status === "BAD_REQUEST") {
    return new OAuthClientManagementError("INVALID_CLIENT_METADATA");
  }
  return error;
}

export async function listOAuthClients(
  deps: Pick<OAuthClientManagementDeps, "auth" | "headers">,
): Promise<OAuthClientDetail[]> {
  const clients = await deps.auth.api.getOAuthClients({ headers: deps.headers });
  return (clients ?? []).map(toDetail);
}

export async function readOAuthClient(
  deps: Pick<OAuthClientManagementDeps, "auth" | "headers">,
  clientId: string,
): Promise<OAuthClientDetail> {
  try {
    const client = await deps.auth.api.getOAuthClient({
      headers: deps.headers,
      query: { client_id: clientId },
    });
    return toDetail(client);
  } catch (error) {
    throw toOAuthClientManagementError(error);
  }
}

/** 1人5件の上限を確認して private_key_jwt クライアントを発行する。 */
export async function registerOAuthClient(
  deps: Pick<OAuthClientManagementDeps, "auth" | "headers">,
  input: OAuthClientInput,
): Promise<OAuthClientDetail> {
  const ownedClients = await deps.auth.api.getOAuthClients({ headers: deps.headers });
  if ((ownedClients?.length ?? 0) >= oauthClientLimitPerUser) {
    throw new OAuthClientManagementError("CLIENT_LIMIT_REACHED");
  }
  assertValidJwks(input.jwks);
  try {
    const client = await deps.auth.api.adminCreateOAuthClient({
      headers: deps.headers,
      body: {
        ...toStandardClientFields(input),
        jwks: input.jwks,
        token_endpoint_auth_method: "private_key_jwt",
        grant_types: ["authorization_code", "refresh_token", "client_credentials"],
        response_types: ["code"],
        scope: [...new Set(Object.values(pointsOAuthScopes).flat())].join(" "),
        client_credentials_scopes: [...pointsOAuthScopes.M2M],
        subject_type: "public",
      },
    });
    return toDetail(client);
  } catch (error) {
    throw toOAuthClientManagementError(error);
  }
}

/** Better Auth の所有者検査後、標準 API に未対応の鍵・紹介 URL も保存する。 */
export async function updateOAuthClient(
  deps: OAuthClientManagementDeps,
  clientId: string,
  input: OAuthClientInput,
): Promise<OAuthClientDetail> {
  assertValidJwks(input.jwks);
  let client;
  try {
    client = await deps.auth.api.adminUpdateOAuthClient({
      headers: deps.headers,
      body: { client_id: clientId, update: toStandardClientFields(input) },
    });
  } catch (error) {
    throw toOAuthClientManagementError(error);
  }

  try {
    const saved = await updateOAuthClientManagedFields(deps.database, clientId, deps.userId, {
      jwks: input.jwks,
      uri: input.uri,
    });
    if (!saved) throw new OAuthClientManagementError("CLIENT_NOT_FOUND");
  } catch (error) {
    if (error instanceof OAuthClientManagementError) throw error;
    throw new OAuthClientManagementError("CLIENT_KEY_SAVE_FAILED");
  }
  return { ...toDetail(client), uri: input.uri, jwks: input.jwks };
}

export async function deleteOAuthClient(
  deps: Pick<OAuthClientManagementDeps, "auth" | "headers">,
  clientId: string,
): Promise<void> {
  try {
    await deps.auth.api.deleteOAuthClient({ headers: deps.headers, body: { client_id: clientId } });
  } catch (error) {
    throw toOAuthClientManagementError(error);
  }
}
