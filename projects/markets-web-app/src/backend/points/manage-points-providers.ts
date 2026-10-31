import type { PointsProvider } from "../db/schema/points-provider";
import type { Bindings } from "../http/context";
import { PointsOAuthClient } from "./points-oauth-client";
import { discoverPointsProvider } from "./points-provider-discovery";
import {
  generatePointsProviderKey,
  importPointsKeyEncryptionKey,
  openPointsProviderKey,
  sealPointsProviderKey,
} from "./points-provider-keys";
import { parsePointsProviderOrigin } from "./points-provider-origin";
import { findPointsProvider, listPointsProviders } from "./points-provider-repository";

export function toPointsProviderView(provider: PointsProvider, appOrigin: string) {
  return {
    providerId: provider.id,
    displayName: provider.displayName,
    origin: provider.origin,
    issuer: provider.issuer,
    resource: provider.resource,
    clientId: provider.clientId,
    status: provider.status,
    publicJwks: { keys: [JSON.parse(provider.clientPublicJwk)] },
    callbackUrls: {
      link: `${appOrigin}/api/points-connection/callback`,
      unlink: `${appOrigin}/api/points-connection/unlink/callback`,
    },
    createdAt: provider.createdAt.toISOString(),
    activatedAt: provider.activatedAt?.toISOString() ?? null,
    stoppedAt: provider.stoppedAt?.toISOString() ?? null,
  };
}

export async function listPointsProviderViews(env: Bindings, activeOnly = false) {
  const providers = await listPointsProviders(env.DB, activeOnly);
  return providers.map((provider) => toPointsProviderView(provider, env.APP_ORIGIN));
}

function requireReason(reason: unknown) {
  if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > 1000) {
    throw new Error("POINTS_PROVIDER_REASON_INVALID");
  }
  return reason.trim();
}

function audit(
  env: Bindings,
  actorMarketsUserId: string,
  eventCode: string,
  providerId: string,
  reason: string,
  requestId: string,
) {
  return env.DB.prepare(
    `INSERT INTO audit_events
      (id, actor_markets_user_id, event_code, target_type, target_id, reason,
       request_id, environment, result)
     VALUES (?, ?, ?, 'POINTS_PROVIDER', ?, ?, ?, ?, 'SUCCESS')`,
  ).bind(
    `audit_${crypto.randomUUID()}`,
    actorMarketsUserId,
    eventCode,
    providerId,
    reason,
    requestId,
    env.APP_ENV,
  );
}

/** 登録時に互換性を検証し、二組のEd25519鍵を暗号化保存する。 */
export async function createPointsProvider(
  env: Bindings,
  input: {
    origin: unknown;
    displayName: unknown;
    reason: unknown;
    actorMarketsUserId: string;
    requestId: string;
  },
) {
  const reason = requireReason(input.reason);
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  if (!displayName || [...displayName].length > 100) {
    throw new Error("POINTS_PROVIDER_DISPLAY_NAME_INVALID");
  }
  const origin = parsePointsProviderOrigin(input.origin, env.APP_ENV === "local");
  if (!origin) throw new Error("POINTS_PROVIDER_ORIGIN_INVALID");
  try {
    await discoverPointsProvider(origin);
  } catch {
    throw new Error("POINTS_PROVIDER_DISCOVERY_INVALID");
  }
  const duplicate = await env.DB.prepare("SELECT id FROM points_provider WHERE origin = ?")
    .bind(origin)
    .first();
  if (duplicate) throw new Error("POINTS_PROVIDER_ORIGIN_DUPLICATED");
  const providerId = `ppr_${crypto.randomUUID()}`;
  const kek = await importPointsKeyEncryptionKey(env.POINTS_KEY_ENCRYPTION_KEY);
  const [clientKey, dpopKey] = await Promise.all([
    generatePointsProviderKey(),
    generatePointsProviderKey(),
  ]);
  const [signingKeyCiphertext, dpopKeyCiphertext] = await Promise.all([
    sealPointsProviderKey(kek, providerId, "client-assertion", clientKey.privateJwk),
    sealPointsProviderKey(kek, providerId, "dpop", dpopKey.privateJwk),
  ]);
  const now = Date.now();
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO points_provider
       (id, display_name, origin, issuer, resource, client_public_jwk,
        signing_key_ciphertext, dpop_key_ciphertext, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_CLIENT_REGISTRATION', ?)`,
    ).bind(
      providerId,
      displayName,
      origin,
      origin,
      `${origin}/api/v1`,
      JSON.stringify(clientKey.publicJwk),
      signingKeyCiphertext,
      dpopKeyCiphertext,
      now,
    ),
    audit(
      env,
      input.actorMarketsUserId,
      "POINTS_PROVIDER_CREATED",
      providerId,
      reason,
      input.requestId,
    ),
  ]);
  if (results[0]?.meta.changes !== 1) throw new Error("POINTS_PROVIDER_ORIGIN_DUPLICATED");
  const provider = await findPointsProvider(env.DB, providerId);
  if (!provider) throw new Error("POINTS_PROVIDER_NOT_FOUND");
  return toPointsProviderView(provider, env.APP_ORIGIN);
}

/** 登録済みClient IDで実トークンを取得できた場合だけACTIVEにする。 */
export async function activatePointsProvider(
  env: Bindings,
  input: {
    providerId: string;
    clientId: unknown;
    reason: unknown;
    actorMarketsUserId: string;
    requestId: string;
  },
) {
  const reason = requireReason(input.reason);
  const clientId = typeof input.clientId === "string" ? input.clientId.trim() : "";
  if (!clientId || clientId.length > 255) throw new Error("POINTS_PROVIDER_CLIENT_ID_INVALID");
  const provider = await findPointsProvider(env.DB, input.providerId);
  if (!provider) throw new Error("POINTS_PROVIDER_NOT_FOUND");
  if (provider.status !== "PENDING_CLIENT_REGISTRATION")
    throw new Error("POINTS_PROVIDER_NOT_PENDING");
  if (!provider.signingKeyCiphertext || !provider.dpopKeyCiphertext) {
    throw new Error("POINTS_PROVIDER_CLIENT_INCOMPLETE");
  }
  const kek = await importPointsKeyEncryptionKey(env.POINTS_KEY_ENCRYPTION_KEY);
  const [metadata, signingKeyJwk, dpopKeyJwk] = await Promise.all([
    discoverPointsProvider(provider.origin).catch(() => {
      throw new Error("POINTS_PROVIDER_DISCOVERY_INVALID");
    }),
    openPointsProviderKey(kek, provider.id, "client-assertion", provider.signingKeyCiphertext),
    openPointsProviderKey(kek, provider.id, "dpop", provider.dpopKeyCiphertext),
  ]);
  const oauth = new PointsOAuthClient({
    origin: provider.origin,
    issuer: provider.issuer,
    resource: provider.resource,
    clientId,
    signingKeyJwk: JSON.stringify(signingKeyJwk),
    dpopKeyJwk: JSON.stringify(dpopKeyJwk),
    metadata,
    fetch: globalThis.fetch,
  });
  try {
    await oauth.getM2MAccessToken(["points.reservations.status"]);
  } catch {
    throw new Error("POINTS_PROVIDER_CLIENT_VERIFICATION_FAILED");
  }
  const now = Date.now();
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE points_provider SET client_id = ?, status = 'ACTIVE', activated_at = ?
       WHERE id = ? AND status = 'PENDING_CLIENT_REGISTRATION'`,
    ).bind(clientId, now, provider.id),
    audit(
      env,
      input.actorMarketsUserId,
      "POINTS_PROVIDER_ACTIVATED",
      provider.id,
      reason,
      input.requestId,
    ),
  ]);
  if (results[0]?.meta.changes !== 1) throw new Error("POINTS_PROVIDER_NOT_PENDING");
  const activated = await findPointsProvider(env.DB, provider.id);
  if (!activated) throw new Error("POINTS_PROVIDER_NOT_FOUND");
  return toPointsProviderView(activated, env.APP_ORIGIN);
}

/** 新規取引を止め、既存取引の精算と連携解除用の鍵を保持する。 */
export async function stopPointsProvider(
  env: Bindings,
  input: { providerId: string; reason: unknown; actorMarketsUserId: string; requestId: string },
) {
  const reason = requireReason(input.reason);
  const provider = await findPointsProvider(env.DB, input.providerId);
  if (!provider) throw new Error("POINTS_PROVIDER_NOT_FOUND");
  if (provider.status !== "ACTIVE") throw new Error("POINTS_PROVIDER_NOT_ACTIVE");
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE points_provider SET status = 'STOPPED', stopped_at = ?
       WHERE id = ? AND status = 'ACTIVE'`,
    ).bind(Date.now(), provider.id),
    audit(
      env,
      input.actorMarketsUserId,
      "POINTS_PROVIDER_STOPPED",
      provider.id,
      reason,
      input.requestId,
    ),
  ]);
  if (results[0]?.meta.changes !== 1) throw new Error("POINTS_PROVIDER_NOT_ACTIVE");
  const stopped = await findPointsProvider(env.DB, provider.id);
  if (!stopped) throw new Error("POINTS_PROVIDER_NOT_FOUND");
  return toPointsProviderView(stopped, env.APP_ORIGIN);
}
