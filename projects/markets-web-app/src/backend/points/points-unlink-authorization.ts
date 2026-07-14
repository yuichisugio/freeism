import type { MarketsActor } from "../http/context";
import { createPointsOAuthState, sha256 } from "./oauth-state";
import type { PointsApiClient } from "./points-api-client";
import { PointsConnectionRepository } from "./points-link-saga";
import type { PointsOAuthClient } from "./points-oauth-client";
import type { PointsTokenStore } from "./points-token-store";

const UNLINK_SCOPE = ["points.connection.unlink"] as const;

interface UnlinkRow {
  accountId: string | null;
  authUserId: string;
  callbackUri: string;
  expiresAt: number;
  id: string;
  marketsUserId: string;
  pkceVerifier: string;
  pointsConnectionId: string;
  pointsIssuer: string;
  pointsSubject: string;
  reason: string;
  sessionId: string;
  status: "STARTED" | "PENDING" | "USED";
  userClientId: string;
}

export interface PointsUnlinkAuthorizationService {
  completeCallback(
    actor: MarketsActor,
    authUserId: string,
    sessionId: string,
    callback: { code: string; issuer?: string; state: string },
  ): Promise<{ pendingId: string }>;
  confirm(
    actor: MarketsActor,
    sessionId: string,
    pendingId: string,
  ): Promise<{ pointsConnectionId: string; status: "UNLINKED" }>;
  start(
    actor: MarketsActor,
    authUserId: string,
    sessionId: string,
    reason: string,
  ): Promise<{ authorizationUrl: string }>;
}

export function createPointsUnlinkAuthorizationService(input: {
  api: PointsApiClient;
  callbackUri: string;
  db: D1Database;
  oauth: PointsOAuthClient;
  pointsIssuer: string;
  tokenStore: PointsTokenStore;
  userClientId: string;
}): PointsUnlinkAuthorizationService {
  const connections = new PointsConnectionRepository(input.db);

  async function findByState(stateHash: string) {
    return input.db
      .prepare(
        `SELECT u.id, u.points_connection_id AS pointsConnectionId,
                u.markets_user_id AS marketsUserId, u.auth_user_id AS authUserId,
                u.session_id AS sessionId, u.pkce_verifier AS pkceVerifier,
                u.callback_uri AS callbackUri, u.reason, u.status, u.expires_at AS expiresAt,
                c.points_issuer AS pointsIssuer, c.points_subject AS pointsSubject,
                c.user_client_id AS userClientId, c.better_auth_account_id AS accountId
         FROM points_unlink_authorization u
         JOIN points_connection c ON c.id = u.points_connection_id
         WHERE u.state_hash = ?`,
      )
      .bind(stateHash)
      .first<UnlinkRow>();
  }

  async function findById(id: string) {
    return input.db
      .prepare(
        `SELECT u.id, u.points_connection_id AS pointsConnectionId,
                u.markets_user_id AS marketsUserId, u.auth_user_id AS authUserId,
                u.session_id AS sessionId, u.pkce_verifier AS pkceVerifier,
                u.callback_uri AS callbackUri, u.reason, u.status, u.expires_at AS expiresAt,
                c.points_issuer AS pointsIssuer, c.points_subject AS pointsSubject,
                c.user_client_id AS userClientId, c.better_auth_account_id AS accountId
         FROM points_unlink_authorization u
         JOIN points_connection c ON c.id = u.points_connection_id
         WHERE u.id = ?`,
      )
      .bind(id)
      .first<UnlinkRow>();
  }

  return {
    async start(actor, authUserId, sessionId, reason) {
      const normalizedReason = reason.trim();
      if (!normalizedReason || normalizedReason.length > 500) {
        throw new Error("POINTS_UNLINK_REASON_INVALID");
      }
      const connection = await connections.findLiveForMarketsUser(actor.marketsUserId);
      if (!connection || connection.status !== "ACTIVE") {
        throw new Error("POINTS_CONNECTION_NOT_ACTIVE");
      }
      const state = await createPointsOAuthState({ callbackUri: input.callbackUri, sessionId });
      const id = `pua_${crypto.randomUUID()}`;
      await input.db
        .prepare(
          `INSERT INTO points_unlink_authorization
             (id, points_connection_id, markets_user_id, auth_user_id, session_id,
              state_hash, pkce_verifier, nonce, callback_uri, reason, status, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'STARTED', ?)`,
        )
        .bind(
          id,
          connection.id,
          actor.marketsUserId,
          authUserId,
          sessionId,
          state.stateHash,
          state.pkceVerifier,
          state.nonce,
          input.callbackUri,
          normalizedReason,
          state.expiresAt.getTime(),
        )
        .run();
      return {
        authorizationUrl: input.oauth.authorizationUrl({
          callbackUri: input.callbackUri,
          nonce: state.nonce,
          pkceChallenge: state.pkceChallenge,
          scopes: UNLINK_SCOPE,
          state: state.state,
        }),
      };
    },

    async completeCallback(actor, authUserId, sessionId, callback) {
      if (callback.issuer && callback.issuer !== input.pointsIssuer) {
        throw new Error("POINTS_ISSUER_MISMATCH");
      }
      const authorization = await findByState(await sha256(callback.state));
      if (
        !authorization ||
        authorization.status !== "STARTED" ||
        authorization.marketsUserId !== actor.marketsUserId ||
        authorization.authUserId !== authUserId ||
        authorization.sessionId !== sessionId ||
        authorization.expiresAt <= Date.now() ||
        !authorization.accountId
      ) {
        throw new Error("POINTS_UNLINK_STATE_INVALID");
      }
      const token = await input.oauth.exchangeOneTimeAuthorizationCode({
        callbackUri: authorization.callbackUri,
        code: callback.code,
        pkceVerifier: authorization.pkceVerifier,
        requiredScopes: UNLINK_SCOPE,
      });
      if (
        token.issuer !== authorization.pointsIssuer ||
        token.subject !== authorization.pointsSubject ||
        token.clientId !== authorization.userClientId
      ) {
        throw new Error("POINTS_UNLINK_IDENTITY_MISMATCH");
      }
      await input.tokenStore.saveAccessToken({
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        accountId: authorization.accountId,
        authUserId,
        scopes: token.scopes,
      });
      await input.db
        .prepare(
          "UPDATE points_unlink_authorization SET status = 'PENDING' WHERE id = ? AND status = 'STARTED'",
        )
        .bind(authorization.id)
        .run();
      return { pendingId: authorization.id };
    },

    async confirm(actor, sessionId, pendingId) {
      const authorization = await findById(pendingId);
      if (
        !authorization ||
        authorization.status !== "PENDING" ||
        authorization.marketsUserId !== actor.marketsUserId ||
        authorization.sessionId !== sessionId ||
        authorization.expiresAt <= Date.now() ||
        !authorization.accountId
      ) {
        throw new Error("POINTS_UNLINK_CONFIRMATION_INVALID");
      }
      const token = await input.tokenStore.read(authorization.accountId);
      const response = await input.api.deactivatePointsConnection(
        {
          deactivationKey: `unlink:${authorization.id}`,
          pointsConnectionId: authorization.pointsConnectionId,
          reason: authorization.reason,
        },
        `unlink:${authorization.id}`,
        token.accessToken,
      );
      await connections.unlink(
        authorization.pointsConnectionId,
        response.data.connectionDeactivationReceiptId,
      );
      await input.tokenStore.remove(authorization.accountId);
      await input.db
        .prepare("UPDATE points_unlink_authorization SET status = 'USED' WHERE id = ?")
        .bind(authorization.id)
        .run();
      return { pointsConnectionId: authorization.pointsConnectionId, status: "UNLINKED" };
    },
  };
}
