import type { Bindings } from "../http/context";
import { openPointsProvider } from "../points/points-provider-context";

export async function openSettlementProvider(
  env: Bindings,
  settlementId: string,
  openProvider: typeof openPointsProvider = openPointsProvider,
) {
  const row = await env.DB.prepare(
    `SELECT a.provider_id AS providerId
     FROM settlements s JOIN auctions a ON a.id = s.auction_id
     WHERE s.id = ?`,
  )
    .bind(settlementId)
    .first<{ providerId: string }>();
  if (!row) throw new Error("SETTLEMENT_PROVIDER_NOT_FOUND");
  return openProvider(env, row.providerId, { allowStopped: true });
}
