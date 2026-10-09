import { createMarketsAuth } from "../auth/create-auth";
import {
  D1BuyNowRestorer,
  D1SettlementReservationRepository,
} from "../db/d1-settlement-repository";
import type { Bindings } from "../http/context";
import { PointsApiError } from "../points/points-api-client";
import { PointsConnectionRepository } from "../points/points-link-saga";
import { PointsOAuthTokenEndpointError } from "../points/points-oauth-client";
import {
  createRefreshLeaseRepository,
  withUserAccessToken,
} from "../points/refresh-lease-repository";
import { createBetterAuthPointsTokenStore } from "../points/points-token-store";
import type {
  ReservationGateway,
  ReserveSettlementRoundDependencies,
} from "./reserve-settlement-round";
import { openSettlementProvider } from "./settlement-provider";

interface ConnectionRow {
  betterAuthAccountId: string | null;
  providerId: string;
  pointsIssuer: string;
  pointsSubject: string;
  status: string;
  userClientId: string;
}

export async function createSettlementReservationDependencies(
  env: Bindings,
  settlementId: string,
  openProvider: typeof openSettlementProvider = openSettlementProvider,
): Promise<ReserveSettlementRoundDependencies> {
  const { provider, oauth, api } = await openProvider(env, settlementId);
  const tokenStore = createBetterAuthPointsTokenStore(createMarketsAuth(env));
  const refreshLease = createRefreshLeaseRepository(env.DB, tokenStore);

  async function withConnectionUserToken<T>(
    pointsConnectionId: string,
    call: (accessToken: string) => Promise<T>,
  ) {
    const connection = await env.DB.prepare(
      `SELECT status, provider_id AS providerId,
              better_auth_account_id AS betterAuthAccountId,
              points_issuer AS pointsIssuer, points_subject AS pointsSubject,
              user_client_id AS userClientId
       FROM points_connection WHERE id = ?`,
    )
      .bind(pointsConnectionId)
      .first<ConnectionRow>();
    if (
      !connection ||
      connection.providerId !== provider.id ||
      connection.status !== "ACTIVE" ||
      !connection.betterAuthAccountId
    ) {
      throw new Error("REAUTH_REQUIRED");
    }
    let value: T | undefined;
    const response = await withUserAccessToken(
      refreshLease,
      pointsConnectionId,
      async (accessToken) => {
        try {
          const identity = await oauth.introspectUserAccessToken(accessToken, [
            "points.reservations.create",
          ]);
          if (
            identity.issuer !== connection.pointsIssuer ||
            identity.subject !== connection.pointsSubject ||
            identity.clientId !== connection.userClientId
          ) {
            return new Response(null, { status: 401 });
          }
          value = await call(accessToken);
          return new Response(null, { status: 204 });
        } catch (error) {
          if (
            (error instanceof Error && error.message === "POINTS_USER_INTROSPECTION_INVALID") ||
            (error instanceof PointsApiError &&
              (error.status === 401 || error.code === "INVALID_ACCESS_TOKEN"))
          ) {
            return new Response(null, { status: 401 });
          }
          throw error;
        }
      },
      async (refreshToken) => {
        try {
          return await oauth.refreshUserToken(refreshToken, ["points.reservations.create"]);
        } catch (error) {
          if (
            (error instanceof PointsOAuthTokenEndpointError &&
              error.oauthError === "invalid_grant") ||
            (error instanceof Error &&
              [
                "POINTS_REFRESH_TOKEN_MISSING",
                "POINTS_USER_INTROSPECTION_INVALID",
                "POINTS_SCOPE_MISMATCH",
              ].includes(error.message))
          ) {
            await new PointsConnectionRepository(env.DB).markReauthRequired(pointsConnectionId);
            throw new Error("REAUTH_REQUIRED");
          }
          throw error;
        }
      },
    );
    if (response.status !== 204 || value === undefined) {
      await new PointsConnectionRepository(env.DB).markReauthRequired(pointsConnectionId);
      throw new Error("REAUTH_REQUIRED");
    }
    return value;
  }

  const gateway: ReservationGateway = {
    async reserve(input) {
      if (!input.pointsConnectionId) throw new Error("REAUTH_REQUIRED_LOCAL");
      const response = await withConnectionUserToken(input.pointsConnectionId, (accessToken) =>
        api.createPointReservation(
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
          accessToken,
        ),
      );
      if (
        response.data.status !== "ACTIVE" ||
        response.data.reservationKey !== input.reservationKey ||
        response.data.planHash !== input.planHash
      ) {
        throw new Error("POINTS_RESERVATION_RESPONSE_MISMATCH");
      }
      return {
        components: response.data.components,
        expiresAt: response.data.expiresAt,
        pointReservationId: response.data.pointReservationId,
        requestId: response.meta.requestId,
        vectorHash: response.data.vectorHash,
      };
    },
    async statusByKeys(keys) {
      let response;
      try {
        response = await api.getPointReservationStatus({
          lookupBy: "RESERVATION_KEY",
          reservationKeys: [...keys],
        });
      } catch (error) {
        if (
          keys.length === 1 &&
          error instanceof PointsApiError &&
          error.status === 404 &&
          error.code === "RESOURCE_NOT_FOUND"
        ) {
          return [{ reservationKey: keys[0]!, status: "NOT_FOUND" as const }];
        }
        throw error;
      }
      const byKey = new Map(response.data.items.map((item) => [item.reservationKey, item]));
      return keys.map((reservationKey) => {
        const item = byKey.get(reservationKey);
        if (!item) return { reservationKey, status: "NOT_FOUND" as const };
        return {
          expiresAt: item.expiresAt,
          pointReservationId: item.pointReservationId,
          reservationKey,
          status: item.status,
          terminalReceiptId: item.terminalReceiptId ?? undefined,
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
      if (
        response.data.status !== "RELEASED" ||
        response.data.pointReservationId !== input.pointReservationId ||
        response.data.planHash !== input.planHash
      ) {
        throw new Error("POINTS_RELEASE_RESPONSE_MISMATCH");
      }
      return {
        contentHash: response.data.contentHash,
        receiptId: response.data.releaseReceiptId,
        releasedAt: response.data.releasedAt,
      };
    },
  };
  return {
    buyNowRestorer: new D1BuyNowRestorer(env.DB, env.AUCTION_SETTLEMENT),
    gateway,
    now: () => new Date(),
    repository: new D1SettlementReservationRepository(env.DB),
  };
}
