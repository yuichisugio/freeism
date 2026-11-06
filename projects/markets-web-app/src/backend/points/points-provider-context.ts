import type { PointsProvider } from "../db/schema/points-provider";
import type { Bindings } from "../http/context";
import { PointsApiClient } from "./points-api-client";
import { PointsOAuthClient } from "./points-oauth-client";
import { discoverPointsProvider } from "./points-provider-discovery";
import { importPointsKeyEncryptionKey, openPointsProviderKey } from "./points-provider-keys";
import { findPointsProvider } from "./points-provider-repository";

/** 保存済み接続先から、同じ提供先に固定したOAuth・APIクライアントを開く。 */
export async function openPointsProvider(
  env: Bindings,
  providerId: string,
  options: { allowStopped?: boolean } = {},
): Promise<{ provider: PointsProvider; oauth: PointsOAuthClient; api: PointsApiClient }> {
  const provider = await findPointsProvider(env.DB, providerId);
  if (!provider) throw new Error("POINTS_PROVIDER_NOT_FOUND");
  if (provider.status !== "ACTIVE" && !(options.allowStopped && provider.status === "STOPPED")) {
    throw new Error("POINTS_PROVIDER_NOT_ACTIVE");
  }
  if (!provider.clientId || !provider.signingKeyCiphertext || !provider.dpopKeyCiphertext) {
    throw new Error("POINTS_PROVIDER_CLIENT_INCOMPLETE");
  }
  const kek = await importPointsKeyEncryptionKey(env.POINTS_KEY_ENCRYPTION_KEY);
  const [signingKeyJwk, dpopKeyJwk, metadata] = await Promise.all([
    openPointsProviderKey(kek, provider.id, "client-assertion", provider.signingKeyCiphertext),
    openPointsProviderKey(kek, provider.id, "dpop", provider.dpopKeyCiphertext),
    discoverPointsProvider(provider.origin),
  ]);
  const oauth = new PointsOAuthClient({
    origin: provider.origin,
    issuer: provider.issuer,
    resource: provider.resource,
    clientId: provider.clientId,
    signingKeyJwk: JSON.stringify(signingKeyJwk),
    dpopKeyJwk: JSON.stringify(dpopKeyJwk),
    metadata,
    fetch: globalThis.fetch,
  });
  const api = new PointsApiClient({ origin: provider.origin, fetch: globalThis.fetch, oauth });
  return { provider, oauth, api };
}
