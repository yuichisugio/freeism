import { D1SettlementCaptureRepository } from "../db/d1-settlement-capture-repository";
import type { Bindings } from "../http/context";
import { openSettlementProvider } from "./settlement-provider";
import type { CaptureAllWinnersDependencies } from "./capture-all-winners";

export async function createSettlementCaptureDependencies(
  env: Bindings,
  settlementId: string,
): Promise<CaptureAllWinnersDependencies> {
  const { api } = await openSettlementProvider(env, settlementId);
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
