export type PointsConnectionStatus =
  | "PENDING_CONFIRMATION"
  | "ACTIVE"
  | "REAUTH_REQUIRED"
  | "UNLINKED"
  | "CANCELLED";

export class PointsConnectionConflictError extends Error {
  readonly code = "POINTS_CONNECTION_CONFLICT";

  constructor() {
    super("POINTS_CONNECTION_CONFLICT");
  }
}

export interface PendingPointsConnectionInput {
  providerId: string;
  attemptPayloadHash: string;
  authUserId: string;
  expiresAt: Date;
  id: string;
  linkAttemptId: string;
  marketsUserId: string;
  m2mClientId: string;
  pointsIssuer: string;
  pointsSubject: string;
  scopes: string[];
  sessionId: string;
  userClientId: string;
}

export interface PointsConnectionRow {
  providerId: string;
  attemptPayloadHash: string;
  authUserId: string;
  betterAuthAccountId: string | null;
  expiresAt: number;
  id: string;
  linkAttemptId: string;
  marketsUserId: string;
  m2mClientId: string;
  pointsIssuer: string;
  pointsSubject: string;
  sessionId: string;
  status: PointsConnectionStatus;
  tokenVersion: number;
  userClientId: string;
}

export interface PointsOAuthStateRow {
  providerId: string;
  reauthConnectionId: string | null;
  attemptPayloadHash: string;
  authUserId: string;
  callbackUri: string;
  expiresAt: number;
  linkAttemptId: string;
  marketsUserId: string;
  nonce: string;
  pkceVerifier: string;
  requestedScopes: string;
  sessionId: string;
  stateHash: string;
  status: "STARTED" | "CALLBACK_COMPLETE" | "CANCELLED";
}

export interface SavePointsOAuthStateInput {
  providerId: string;
  reauthConnectionId: string | null;
  attemptPayloadHash: string;
  authUserId: string;
  callbackUri: string;
  expiresAt: Date;
  linkAttemptId: string;
  marketsUserId: string;
  nonce: string;
  pkceVerifier: string;
  requestedScopes: readonly string[];
  returnUrlHash: string;
  sessionId: string;
  stateHash: string;
}

export class PointsConnectionRepository {
  constructor(private readonly db: D1Database) {}

  async createPending(input: PendingPointsConnectionInput) {
    try {
      await this.db
        .prepare(
          `INSERT INTO points_connection
             (id, provider_id, markets_user_id, auth_user_id, status, link_attempt_id,
              attempt_payload_hash, points_issuer, points_subject, user_client_id,
              m2m_client_id, granted_scopes, session_id, expires_at)
           VALUES (?, ?, ?, ?, 'PENDING_CONFIRMATION', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.id,
          input.providerId,
          input.marketsUserId,
          input.authUserId,
          input.linkAttemptId,
          input.attemptPayloadHash,
          input.pointsIssuer,
          input.pointsSubject,
          input.userClientId,
          input.m2mClientId,
          JSON.stringify([...new Set(input.scopes)].sort()),
          input.sessionId,
          input.expiresAt.getTime(),
        )
        .run();
    } catch {
      const replay = await this.findById(input.id);
      if (replay?.linkAttemptId === input.linkAttemptId) return replay;
      throw new PointsConnectionConflictError();
    }
    const created = await this.findById(input.id);
    if (!created) throw new Error("POINTS_CONNECTION_CREATE_FAILED");
    return created;
  }

  async saveOAuthState(input: SavePointsOAuthStateInput) {
    await this.db
      .prepare(
        `INSERT INTO points_oauth_state
           (link_attempt_id, provider_id, reauth_connection_id, markets_user_id, auth_user_id, session_id, state_hash,
            pkce_verifier, nonce, callback_uri, return_url_hash, requested_scopes,
            attempt_payload_hash, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'STARTED', ?)`,
      )
      .bind(
        input.linkAttemptId,
        input.providerId,
        input.reauthConnectionId,
        input.marketsUserId,
        input.authUserId,
        input.sessionId,
        input.stateHash,
        input.pkceVerifier,
        input.nonce,
        input.callbackUri,
        input.returnUrlHash,
        JSON.stringify([...new Set(input.requestedScopes)].sort()),
        input.attemptPayloadHash,
        input.expiresAt.getTime(),
      )
      .run();
  }

  async findOAuthState(stateHash: string) {
    return this.db
      .prepare(
        `SELECT link_attempt_id AS linkAttemptId, provider_id AS providerId,
                reauth_connection_id AS reauthConnectionId, markets_user_id AS marketsUserId,
                auth_user_id AS authUserId, session_id AS sessionId,
                state_hash AS stateHash, pkce_verifier AS pkceVerifier, nonce,
                callback_uri AS callbackUri, requested_scopes AS requestedScopes,
                attempt_payload_hash AS attemptPayloadHash, status, expires_at AS expiresAt
         FROM points_oauth_state WHERE state_hash = ?`,
      )
      .bind(stateHash)
      .first<PointsOAuthStateRow>();
  }

  async completeOAuthState(linkAttemptId: string) {
    const result = await this.db
      .prepare(
        `UPDATE points_oauth_state SET status = 'CALLBACK_COMPLETE'
         WHERE link_attempt_id = ? AND status IN ('STARTED', 'CALLBACK_COMPLETE')`,
      )
      .bind(linkAttemptId)
      .run();
    if (result.meta.changes !== 1) throw new Error("POINTS_OAUTH_STATE_NOT_ACTIVE");
  }

  async cancelOAuthState(linkAttemptId: string) {
    await this.db
      .prepare(
        `UPDATE points_oauth_state SET status = 'CANCELLED'
         WHERE link_attempt_id = ? AND status != 'CALLBACK_COMPLETE'`,
      )
      .bind(linkAttemptId)
      .run();
  }

  async activate(id: string, receiptId: string, grantVersion: number) {
    const result = await this.db
      .prepare(
        `UPDATE points_connection
         SET status = 'ACTIVE', confirmation_receipt_id = ?, points_grant_version = ?,
             updated_at = cast(unixepoch('subsecond') * 1000 as integer)
         WHERE id = ? AND status IN ('PENDING_CONFIRMATION', 'ACTIVE')`,
      )
      .bind(receiptId, grantVersion, id)
      .run();
    if (result.meta.changes !== 1) throw new Error("POINTS_CONNECTION_NOT_PENDING");
  }

  async cancel(id: string) {
    await this.db
      .prepare(
        `UPDATE points_connection SET status = 'CANCELLED',
           updated_at = cast(unixepoch('subsecond') * 1000 as integer)
         WHERE id = ? AND status = 'PENDING_CONFIRMATION'`,
      )
      .bind(id)
      .run();
  }

  async findById(id: string) {
    return this.db
      .prepare(
        `SELECT id, provider_id AS providerId, markets_user_id AS marketsUserId, auth_user_id AS authUserId,
                status, link_attempt_id AS linkAttemptId,
                attempt_payload_hash AS attemptPayloadHash, points_issuer AS pointsIssuer,
                points_subject AS pointsSubject, user_client_id AS userClientId,
                m2m_client_id AS m2mClientId, session_id AS sessionId,
                better_auth_account_id AS betterAuthAccountId, token_version AS tokenVersion,
                expires_at AS expiresAt
         FROM points_connection WHERE id = ?`,
      )
      .bind(id)
      .first<PointsConnectionRow>();
  }

  async findLiveForMarketsUser(marketsUserId: string, providerId: string) {
    return this.db
      .prepare(
        `SELECT id, provider_id AS providerId, markets_user_id AS marketsUserId, auth_user_id AS authUserId,
                status, link_attempt_id AS linkAttemptId,
                attempt_payload_hash AS attemptPayloadHash, points_issuer AS pointsIssuer,
                points_subject AS pointsSubject, user_client_id AS userClientId,
                m2m_client_id AS m2mClientId, session_id AS sessionId,
                better_auth_account_id AS betterAuthAccountId, token_version AS tokenVersion,
                expires_at AS expiresAt
         FROM points_connection
         WHERE markets_user_id = ? AND provider_id = ? AND status IN ('PENDING_CONFIRMATION', 'ACTIVE', 'REAUTH_REQUIRED')
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(marketsUserId, providerId)
      .first<PointsConnectionRow>();
  }

  async bindAccount(id: string, accountId: string) {
    await this.db
      .prepare("UPDATE points_connection SET better_auth_account_id = ? WHERE id = ?")
      .bind(accountId, id)
      .run();
  }

  async markReauthRequired(id: string) {
    await this.db
      .prepare("UPDATE points_connection SET status = 'REAUTH_REQUIRED' WHERE id = ?")
      .bind(id)
      .run();
  }

  async reauthorizePending(input: PendingPointsConnectionInput) {
    const result = await this.db
      .prepare(
        `UPDATE points_connection SET status = 'PENDING_CONFIRMATION', link_attempt_id = ?,
         attempt_payload_hash = ?, granted_scopes = ?, session_id = ?, expires_at = ?,
         updated_at = cast(unixepoch('subsecond') * 1000 as integer)
       WHERE id = ? AND provider_id = ? AND markets_user_id = ? AND auth_user_id = ?
         AND points_issuer = ? AND points_subject = ? AND user_client_id = ? AND status = 'REAUTH_REQUIRED'`,
      )
      .bind(
        input.linkAttemptId,
        input.attemptPayloadHash,
        JSON.stringify([...new Set(input.scopes)].sort()),
        input.sessionId,
        input.expiresAt.getTime(),
        input.id,
        input.providerId,
        input.marketsUserId,
        input.authUserId,
        input.pointsIssuer,
        input.pointsSubject,
        input.userClientId,
      )
      .run();
    if (result.meta.changes !== 1) throw new Error("POINTS_REAUTH_IDENTITY_MISMATCH");
  }

  async restoreReauth(id: string) {
    await this.db
      .prepare(
        "UPDATE points_connection SET status = 'REAUTH_REQUIRED' WHERE id = ? AND status = 'PENDING_CONFIRMATION'",
      )
      .bind(id)
      .run();
  }

  async restoreExpiredReauth(marketsUserId: string, providerId: string) {
    await this.db
      .prepare(
        `UPDATE points_connection SET status = 'REAUTH_REQUIRED'
       WHERE markets_user_id = ? AND provider_id = ? AND status = 'PENDING_CONFIRMATION'
         AND expires_at <= ? AND EXISTS (
           SELECT 1 FROM points_oauth_state s
           WHERE s.link_attempt_id = points_connection.link_attempt_id
             AND s.reauth_connection_id = points_connection.id)`,
      )
      .bind(marketsUserId, providerId, Date.now())
      .run();
  }

  async unlink(id: string, receiptId: string) {
    const result = await this.db
      .prepare(
        `UPDATE points_connection SET status = 'UNLINKED', deactivation_receipt_id = ?,
           updated_at = cast(unixepoch('subsecond') * 1000 as integer)
         WHERE id = ? AND status IN ('ACTIVE', 'UNLINKED')`,
      )
      .bind(receiptId, id)
      .run();
    if (result.meta.changes !== 1) throw new Error("POINTS_CONNECTION_NOT_ACTIVE");
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

async function attemptPayloadHash(body: unknown, m2mClientId: string) {
  return sha256(JSON.stringify(canonicalize({ body, clientId: m2mClientId })));
}

export interface PointsConnectionService {
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
  ): Promise<{ pointsConnectionId: string; status: "ACTIVE" }>;
  start(
    actor: MarketsActor,
    authUserId: string,
    sessionId: string,
  ): Promise<{ authorizationUrl: string }>;
}

export function createPointsConnectionService(input: {
  providerId: string;
  api: PointsApiClient;
  callbackUri: string;
  db: D1Database;
  m2mClientId: string;
  oauth: PointsOAuthClient;
  pointsIssuer: string;
  tokenStore: PointsTokenStore;
  userClientId: string;
}): PointsConnectionService {
  const repository = new PointsConnectionRepository(input.db);

  return {
    async start(actor, authUserId, sessionId) {
      await repository.restoreExpiredReauth(actor.marketsUserId, input.providerId);
      const current = await repository.findLiveForMarketsUser(
        actor.marketsUserId,
        input.providerId,
      );
      if (current?.status === "ACTIVE" || current?.status === "PENDING_CONFIRMATION") {
        throw new PointsConnectionConflictError();
      }
      const oauthState = await createPointsOAuthState({
        callbackUri: input.callbackUri,
        sessionId,
      });
      const body = {
        expiresAt: oauthState.expiresAt.toISOString(),
        marketsUserId: actor.marketsUserId,
        pkceChallenge: oauthState.pkceChallenge,
        redirectUri: input.callbackUri,
        requestedScopes: [...POINTS_USER_SCOPES],
        returnUrlHash: oauthState.returnUrlHash,
        stateHash: oauthState.stateHash,
      };
      const hash = await attemptPayloadHash(body, input.m2mClientId);
      const response = await input.api.createPointsLinkAttempt(
        body,
        `link-start:${oauthState.stateHash}`,
      );
      await repository.saveOAuthState({
        providerId: input.providerId,
        reauthConnectionId: current?.status === "REAUTH_REQUIRED" ? current.id : null,
        attemptPayloadHash: hash,
        authUserId,
        callbackUri: input.callbackUri,
        expiresAt: oauthState.expiresAt,
        linkAttemptId: response.data.linkAttemptId,
        marketsUserId: actor.marketsUserId,
        nonce: oauthState.nonce,
        pkceVerifier: oauthState.pkceVerifier,
        requestedScopes: POINTS_USER_SCOPES,
        returnUrlHash: oauthState.returnUrlHash,
        sessionId,
        stateHash: oauthState.stateHash,
      });
      return {
        authorizationUrl: input.oauth.authorizationUrl({
          callbackUri: input.callbackUri,
          nonce: oauthState.nonce,
          pkceChallenge: oauthState.pkceChallenge,
          scopes: POINTS_USER_SCOPES,
          state: oauthState.state,
        }),
      };
    },

    async completeCallback(actor, authUserId, sessionId, callback) {
      const state = await repository.findOAuthState(await sha256(callback.state));
      if (
        !state ||
        state.providerId !== input.providerId ||
        state.status !== "STARTED" ||
        state.marketsUserId !== actor.marketsUserId ||
        state.authUserId !== authUserId ||
        state.sessionId !== sessionId ||
        state.expiresAt <= Date.now()
      ) {
        throw new Error("POINTS_OAUTH_STATE_INVALID");
      }
      if (callback.issuer !== input.pointsIssuer) {
        throw new Error("POINTS_ISSUER_MISMATCH");
      }
      const scopes = JSON.parse(state.requestedScopes) as string[];
      const tokens = await input.oauth.exchangeAuthorizationCode({
        callbackUri: state.callbackUri,
        code: callback.code,
        issuer: callback.issuer,
        nonce: state.nonce,
        pkceVerifier: state.pkceVerifier,
        requiredScopes: scopes,
        state: callback.state,
      });
      if (
        tokens.issuer !== input.pointsIssuer ||
        tokens.clientId !== input.userClientId ||
        !tokens.subject
      ) {
        throw new Error("POINTS_OAUTH_IDENTITY_MISMATCH");
      }
      const pendingId = state.reauthConnectionId ?? `mpc_${state.linkAttemptId}`;
      const accountId = `${input.providerId}|${tokens.subject}`;
      try {
        const pending = {
          providerId: input.providerId,
          attemptPayloadHash: state.attemptPayloadHash,
          authUserId,
          expiresAt: new Date(state.expiresAt),
          id: pendingId,
          linkAttemptId: state.linkAttemptId,
          marketsUserId: actor.marketsUserId,
          m2mClientId: input.m2mClientId,
          pointsIssuer: tokens.issuer,
          pointsSubject: tokens.subject,
          scopes: tokens.scopes,
          sessionId,
          userClientId: tokens.clientId,
        };
        if (state.reauthConnectionId) await repository.reauthorizePending(pending);
        else await repository.createPending(pending);
        await input.tokenStore.save({ ...tokens, accountId, authUserId });
        await repository.bindAccount(pendingId, accountId);
        await repository.completeOAuthState(state.linkAttemptId);
        return { pendingId };
      } catch (error) {
        if (state.reauthConnectionId) await repository.restoreReauth(pendingId);
        else await repository.cancel(pendingId);
        await repository.cancelOAuthState(state.linkAttemptId);
        await input.api
          .finalizePointsLinkAttempt(
            state.linkAttemptId,
            {
              attemptPayloadHash: state.attemptPayloadHash,
              marketsPointsConnectionId: pendingId,
              outcome: "CANCEL",
            },
            `link-cancel:${state.linkAttemptId}`,
          )
          .catch(() => undefined);
        await input.oauth.revoke(tokens.accessToken, "access_token").catch(() => undefined);
        await input.oauth.revoke(tokens.refreshToken, "refresh_token").catch(() => undefined);
        throw error;
      }
    },

    async confirm(actor, sessionId, pendingId) {
      const connection = await repository.findById(pendingId);
      if (
        !connection ||
        connection.providerId !== input.providerId ||
        connection.status !== "PENDING_CONFIRMATION" ||
        connection.marketsUserId !== actor.marketsUserId ||
        connection.sessionId !== sessionId ||
        connection.expiresAt <= Date.now()
      ) {
        throw new Error("POINTS_CONNECTION_CONFIRMATION_INVALID");
      }
      const response = await input.api.finalizePointsLinkAttempt(
        connection.linkAttemptId,
        {
          attemptPayloadHash: connection.attemptPayloadHash,
          marketsPointsConnectionId: connection.id,
          outcome: "CONFIRM",
          pointsIssuer: connection.pointsIssuer,
          pointsSubject: connection.pointsSubject,
          userClientId: connection.userClientId,
        },
        `link-confirm:${connection.linkAttemptId}`,
      );
      if (response.data.outcome !== "CONFIRM" || response.data.grantStatus !== "ACTIVE") {
        throw new Error("POINTS_CONNECTION_CONFIRMATION_FAILED");
      }
      await repository.activate(
        connection.id,
        response.data.linkAttemptFinalizationReceiptId,
        response.data.grantVersion,
      );
      return { pointsConnectionId: connection.id, status: "ACTIVE" };
    },
  };
}
import type { MarketsActor } from "../http/context";
import { createPointsOAuthState, POINTS_USER_SCOPES, sha256 } from "./oauth-state";
import type { PointsApiClient } from "./points-api-client";
import type { PointsOAuthClient } from "./points-oauth-client";
import type { PointsTokenStore } from "./points-token-store";
