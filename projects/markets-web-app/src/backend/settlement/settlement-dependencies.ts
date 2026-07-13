import { createMarketsAuth } from "../auth/create-auth";
import {
  D1BuyNowRestorer,
  D1SettlementReservationRepository,
} from "../db/d1-settlement-repository";
import type { Bindings } from "../http/context";
import { PointsApiClient } from "../points/points-api-client";
import { PointsOAuthClient } from "../points/points-oauth-client";
import { createBetterAuthPointsTokenStore } from "../points/points-token-store";
import type {
  ReservationGateway,
  ReserveSettlementRoundDependencies,
} from "./reserve-settlement-round";

interface ConnectionRow {
  betterAuthAccountId: string | null;
  pointsIssuer: string;
  pointsSubject: string;
  status: string;
  userClientId: string;
}

export function createSettlementReservationDependencies(
  env: Bindings,
): ReserveSettlementRoundDependencies {
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
  const tokenStore = createBetterAuthPointsTokenStore(createMarketsAuth(env));

  async function userToken(pointsConnectionId: string) {
    const connection = await env.DB.prepare(
      `SELECT status, better_auth_account_id AS betterAuthAccountId,
              points_issuer AS pointsIssuer, points_subject AS pointsSubject,
              user_client_id AS userClientId
       FROM points_connection WHERE id = ?`,
    )
      .bind(pointsConnectionId)
      .first<ConnectionRow>();
    if (!connection || connection.status !== "ACTIVE" || !connection.betterAuthAccountId) {
      throw new Error("REAUTH_REQUIRED");
    }
    const tokens = await tokenStore.read(connection.betterAuthAccountId);
    const identity = await oauth.introspectUserAccessToken(tokens.accessToken, [
      "points.reservations.create",
    ]);
    if (
      identity.issuer !== connection.pointsIssuer ||
      identity.subject !== connection.pointsSubject ||
      identity.clientId !== connection.userClientId
    ) {
      throw new Error("REAUTH_REQUIRED");
    }
    return tokens.accessToken;
  }

  const gateway: ReservationGateway = {
    async reserve(input) {
      const response = await api.createPointReservation(
        {
          auctionId: input.auctionId,
          leaseSeconds: input.leaseSeconds,
          marketsUserId: input.marketsUserId,
          planHash: input.planHash,
          pointPackageRevisionId: input.pointPackageRevisionId,
          priceTicks: input.priceTicks,
          quantity: input.allocationQuantity,
          reservationKey: input.reservationKey,
          settlementId: input.settlementId,
        },
        input.reservationKey,
        await userToken(input.pointsConnectionId),
      );
      if (
        response.data.status !== "ACTIVE" ||
        response.data.reservationKey !== input.reservationKey ||
        response.data.planHash !== input.planHash
      ) {
        throw new Error("POINTS_RESERVATION_RESPONSE_MISMATCH");
      }
      return {
        expiresAt: response.data.expiresAt,
        pointReservationId: response.data.pointReservationId,
        requestId: response.meta.requestId,
        vectorHash: response.data.vectorHash,
      };
    },
    async statusByKeys(keys) {
      const response = await api.getPointReservationStatus({
        lookupBy: "RESERVATION_KEY",
        reservationKeys: [...keys],
      });
      const byKey = new Map(response.data.items.map((item) => [item.reservationKey, item]));
      return keys.map((reservationKey) => {
        const item = byKey.get(reservationKey);
        if (!item) return { reservationKey, status: "NOT_FOUND" as const };
        return {
          expiresAt: item.expiresAt,
          pointReservationId: item.pointReservationId,
          reservationKey,
          status: item.status,
          vectorHash: item.vectorHash,
        };
      });
    },
    async release(input) {
      const response = await api.releasePointReservation(
        {
          planHash: input.planHash,
          pointReservationId: input.pointReservationId,
          reason: "SETTLEMENT_ROUND_RECALCULATION",
        },
        `release:${input.reservationKey}`,
      );
      return {
        contentHash: response.data.contentHash,
        receiptId: response.data.releaseReceiptId,
        releasedAt: response.data.releasedAt,
      };
    },
  };
  return {
    buyNowRestorer: new D1BuyNowRestorer(env.DB),
    gateway,
    now: () => new Date(),
    repository: new D1SettlementReservationRepository(env.DB),
  };
}
