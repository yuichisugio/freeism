import { D1SettlementCaptureRepository } from "../db/d1-settlement-capture-repository";
import type { Bindings } from "../http/context";
import { PointsApiClient } from "../points/points-api-client";
import { PointsOAuthClient } from "../points/points-oauth-client";
import type { CaptureAllWinnersDependencies } from "./capture-all-winners";

export function createSettlementCaptureDependencies(env: Bindings): CaptureAllWinnersDependencies {
  const oauth = new PointsOAuthClient(env.POINTS_SERVICE, {
    audience: env.POINTS_AUDIENCE,
    issuer: env.POINTS_ISSUER,
    m2mClientId: env.POINTS_M2M_CLIENT_ID,
    m2mClientSecret: env.POINTS_M2M_CLIENT_SECRET,
    settlementClientId: env.POINTS_SETTLEMENT_CLIENT_ID,
    settlementClientSecret: env.POINTS_SETTLEMENT_CLIENT_SECRET,
    userClientId: env.POINTS_USER_CLIENT_ID,
    userClientSecret: env.POINTS_USER_CLIENT_SECRET,
  });
  const api = new PointsApiClient(env.POINTS_SERVICE, (scopes) => oauth.getM2MAccessToken(scopes));
  return {
    gateway: {
      async capture(input) {
        const response = await api.capturePointSettlement(
          input.settlementId,
          {
            auctionId: input.auctionId,
            planHash: input.planHash,
            reservations: [...input.reservations],
          },
          input.idempotencyKey,
          { signal: input.signal },
        );
        return response.data;
      },
      async release(input, signal) {
        const response = await api.releasePointReservation(
          {
            planHash: input.planHash,
            pointReservationId: input.pointReservationId,
            reason: "SETTLEMENT_ROUND_RECALCULATION",
          },
          `release:${input.reservationKey}`,
          { signal },
        );
        return {
          contentHash: response.data.contentHash,
          receiptId: response.data.releaseReceiptId,
          releasedAt: response.data.releasedAt,
        };
      },
      async statusByIds(ids, signal) {
        const response = await api.getPointReservationStatus(
          { lookupBy: "POINT_RESERVATION_ID", pointReservationIds: [...ids] },
          { signal },
        );
        return response.data.items.map((item) => ({
          auctionId: item.auctionId,
          expiresAt: item.expiresAt,
          planHash: item.planHash,
          pointReservationId: item.pointReservationId,
          reservationKey: item.reservationKey,
          settlementId: item.settlementId,
          status: item.status,
          terminalReceiptId: item.terminalReceiptId ?? undefined,
          vectorHash: item.vectorHash,
        }));
      },
    },
    now: () => new Date(),
    repository: new D1SettlementCaptureRepository(env.DB),
  };
}
