import { sha256 } from "../points/oauth-state";

export const SETTLEMENT_RETRY_SCOPE = "points.admin.settlement.retry" as const;

export interface SettlementRetryAssertionClaims {
  admin: boolean;
  auctionId: string;
  aud: string;
  authTime: number;
  clientId: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  reasonHash: `sha256:${string}`;
  scope: typeof SETTLEMENT_RETRY_SCOPE;
  settlementId: string;
  sub: string;
  tokenClass: "SETTLEMENT_ADMIN_STEP_UP";
}

interface ExpectedAssertion {
  auctionId: string;
  audience: string;
  clientId: string;
  issuer: string;
  nowSeconds: number;
  reasonHash: string;
  settlementId: string;
}

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function validateSettlementRetryAssertionClaims(
  claims: SettlementRetryAssertionClaims,
  expected: ExpectedAssertion,
  signatureValid: boolean,
): SettlementRetryAssertionClaims {
  if (!signatureValid) throw new Error("ADMIN_ASSERTION_SIGNATURE_INVALID");
  if (!claims.admin) throw new Error("ADMIN_ASSERTION_ADMIN_REQUIRED");
  if (
    ![claims.authTime, claims.exp, claims.iat].every(Number.isSafeInteger) ||
    claims.iat > claims.exp
  ) {
    throw new Error("ADMIN_ASSERTION_LIFETIME_INVALID");
  }
  if (expected.nowSeconds - claims.authTime > 900 || claims.authTime > expected.nowSeconds) {
    throw new Error("ADMIN_ASSERTION_NOT_FRESH");
  }
  if (
    claims.exp - claims.iat > 60 ||
    claims.iat > expected.nowSeconds ||
    claims.exp < expected.nowSeconds
  ) {
    throw new Error("ADMIN_ASSERTION_LIFETIME_INVALID");
  }
  if (
    claims.iss !== expected.issuer ||
    claims.aud !== expected.audience ||
    claims.clientId !== expected.clientId ||
    claims.tokenClass !== "SETTLEMENT_ADMIN_STEP_UP" ||
    claims.scope !== SETTLEMENT_RETRY_SCOPE ||
    claims.auctionId !== expected.auctionId ||
    claims.settlementId !== expected.settlementId ||
    claims.reasonHash !== expected.reasonHash ||
    !HASH_PATTERN.test(claims.reasonHash) ||
    !claims.sub ||
    !claims.jti
  ) {
    throw new Error("ADMIN_ASSERTION_INVALID");
  }
  return claims;
}

export function settlementRetryReturnPath(settlementId: string) {
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(settlementId)) {
    throw new Error("SETTLEMENT_RETRY_TARGET_INVALID");
  }
  return `/settlements/${settlementId}`;
}

export function assertNoSettlementRetryReturnTargetInput(search: URLSearchParams) {
  for (const key of search.keys()) {
    const normalized = key.toLowerCase();
    if (normalized === "returnto" || normalized === "return_url" || normalized === "redirect_uri") {
      throw new Error("SETTLEMENT_RETRY_RETURN_TARGET_FORBIDDEN");
    }
  }
}

export async function normalizeSettlementRetryReason(reason: string) {
  const normalizedReason = reason.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!normalizedReason || normalizedReason.length > 500) {
    throw new Error("SETTLEMENT_RETRY_REASON_INVALID");
  }
  return {
    normalizedReason,
    reasonHash: (await sha256(normalizedReason)) as `sha256:${string}`,
  };
}

interface RetryAuthorizationRow {
  auctionId: string;
  assertionJti: string | null;
  authUserId: string;
  expiresAt: number;
  id: string;
  marketsUserId: string;
  reasonHash: string;
  sessionId: string;
  settlementId: string;
  status: "STARTED" | "PENDING" | "USED" | "EXPIRED";
}

interface CallbackAuthorizationRow extends RetryAuthorizationRow {
  callbackUri: string;
  pkceVerifier: string;
}

export async function createSettlementRetryAuthorization(
  db: D1Database,
  input: {
    auctionId: string;
    authUserId: string;
    callbackUri: string;
    expiresAt: number;
    marketsUserId: string;
    nonce: string;
    pkceVerifier: string;
    rawState: string;
    reasonHash: string;
    sessionId: string;
    settlementId: string;
  },
) {
  settlementRetryReturnPath(input.settlementId);
  if (!HASH_PATTERN.test(input.reasonHash)) throw new Error("SETTLEMENT_RETRY_REASON_INVALID");
  const id = `sra_${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO settlement_retry_authorizations
       (id, settlement_id, auction_id, markets_user_id, auth_user_id, session_id,
        state_hash, pkce_verifier, nonce, callback_uri, return_path, reason_hash,
        status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'STARTED', ?)`,
    )
    .bind(
      id,
      input.settlementId,
      input.auctionId,
      input.marketsUserId,
      input.authUserId,
      input.sessionId,
      await sha256(input.rawState),
      input.pkceVerifier,
      input.nonce,
      input.callbackUri,
      settlementRetryReturnPath(input.settlementId),
      input.reasonHash,
      input.expiresAt,
    )
    .run();
  return { id, status: "STARTED" as const };
}

async function authorizationByState(db: D1Database, rawState: string) {
  return db
    .prepare(
      `SELECT id, settlement_id AS settlementId, auction_id AS auctionId,
            markets_user_id AS marketsUserId, auth_user_id AS authUserId,
            session_id AS sessionId, reason_hash AS reasonHash, status,
            assertion_jti AS assertionJti, expires_at AS expiresAt
     FROM settlement_retry_authorizations WHERE state_hash = ?`,
    )
    .bind(await sha256(rawState))
    .first<RetryAuthorizationRow>();
}

export async function getSettlementRetryAuthorizationForCallback(
  db: D1Database,
  input: { marketsUserId: string; rawState: string; sessionId: string },
) {
  const row = await db
    .prepare(
      `SELECT id, settlement_id AS settlementId, auction_id AS auctionId,
            markets_user_id AS marketsUserId, auth_user_id AS authUserId,
            session_id AS sessionId, reason_hash AS reasonHash, status,
            assertion_jti AS assertionJti, expires_at AS expiresAt,
            callback_uri AS callbackUri, pkce_verifier AS pkceVerifier
     FROM settlement_retry_authorizations WHERE state_hash = ?`,
    )
    .bind(await sha256(input.rawState))
    .first<CallbackAuthorizationRow>();
  if (
    !row ||
    row.status !== "STARTED" ||
    row.marketsUserId !== input.marketsUserId ||
    row.sessionId !== input.sessionId ||
    row.expiresAt < Date.now()
  ) {
    throw new Error("ADMIN_ASSERTION_STATE_INVALID");
  }
  return row;
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function verifySettlementRetryAssertion(
  service: Fetcher,
  issuer: string,
  assertion: string,
): Promise<SettlementRetryAssertionClaims> {
  const segments = assertion.split(".");
  if (segments.length !== 3) throw new Error("ADMIN_ASSERTION_INVALID");
  const [encodedHeader, encodedPayload, encodedSignature] = segments as [string, string, string];
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedHeader))) as {
    alg?: unknown;
    kid?: unknown;
  };
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("ADMIN_ASSERTION_SIGNATURE_INVALID");
  }
  const discovery = await service.fetch(`${issuer}/.well-known/openid-configuration`);
  if (!discovery.ok) throw new Error("ADMIN_ASSERTION_JWKS_UNAVAILABLE");
  const metadata = await discovery.json<{ issuer?: string; jwks_uri?: string }>();
  if (metadata.issuer !== issuer || !metadata.jwks_uri) {
    throw new Error("ADMIN_ASSERTION_JWKS_INVALID");
  }
  const jwksUrl = new URL(metadata.jwks_uri);
  if (jwksUrl.origin !== new URL(issuer).origin) throw new Error("ADMIN_ASSERTION_JWKS_INVALID");
  const response = await service.fetch(jwksUrl.toString());
  if (!response.ok) throw new Error("ADMIN_ASSERTION_JWKS_UNAVAILABLE");
  const jwks = await response.json<{ keys?: Array<JsonWebKey & { kid?: string }> }>();
  const jwk = jwks.keys?.find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new Error("ADMIN_ASSERTION_SIGNATURE_INVALID");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["verify"],
  );
  const signatureValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!signatureValid) throw new Error("ADMIN_ASSERTION_SIGNATURE_INVALID");
  const raw = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as Record<
    string,
    unknown
  >;
  return {
    admin: raw.admin === true,
    auctionId: String(raw.auctionId ?? ""),
    aud: String(raw.aud ?? ""),
    authTime: Number(raw.authTime ?? raw.auth_time),
    clientId: String(raw.clientId ?? raw.client_id ?? ""),
    exp: Number(raw.exp),
    iat: Number(raw.iat),
    iss: String(raw.iss ?? ""),
    jti: String(raw.jti ?? ""),
    reasonHash: String(raw.reasonHash ?? "") as `sha256:${string}`,
    scope: String(raw.scope ?? "") as typeof SETTLEMENT_RETRY_SCOPE,
    settlementId: String(raw.settlementId ?? ""),
    sub: String(raw.sub ?? ""),
    tokenClass: String(raw.tokenClass ?? "") as "SETTLEMENT_ADMIN_STEP_UP",
  };
}

export async function completeSettlementRetryCallback(
  db: D1Database,
  input: {
    claims: SettlementRetryAssertionClaims;
    marketsUserId: string;
    rawState: string;
    sessionId: string;
    verifiedAt: number;
  },
) {
  const row = await authorizationByState(db, input.rawState);
  if (!row || row.status !== "STARTED" || row.expiresAt < input.verifiedAt) {
    throw new Error("ADMIN_ASSERTION_STATE_INVALID");
  }
  if (row.marketsUserId !== input.marketsUserId || row.sessionId !== input.sessionId) {
    throw new Error("ADMIN_ASSERTION_SESSION_MISMATCH");
  }
  if (
    row.auctionId !== input.claims.auctionId ||
    row.settlementId !== input.claims.settlementId ||
    row.reasonHash !== input.claims.reasonHash
  ) {
    throw new Error("ADMIN_ASSERTION_TARGET_CHANGED");
  }
  const subjectHash = await sha256(input.claims.sub);
  await db.batch([
    db
      .prepare(
        `UPDATE settlement_retry_authorizations
       SET status = 'PENDING', assertion_jti = ?, points_admin_subject_hash = ?, updated_at = ?
       WHERE id = ? AND status = 'STARTED'`,
      )
      .bind(input.claims.jti, subjectHash, new Date(input.verifiedAt).toISOString(), row.id),
    db
      .prepare(
        `INSERT INTO settlement_retry_assertion_jtis
       (jti, authorization_id, settlement_id, auction_id, markets_user_id, session_id,
        reason_hash, points_admin_subject_hash, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      )
      .bind(
        input.claims.jti,
        row.id,
        row.settlementId,
        row.auctionId,
        row.marketsUserId,
        row.sessionId,
        row.reasonHash,
        subjectHash,
        input.claims.exp * 1000,
      ),
  ]);
  return { pendingId: row.id, status: "PENDING" as const, workflowStarted: false };
}

interface PendingRetryRow extends RetryAuthorizationRow {
  buyNowHoldStatus: string | null;
  jtiExpiresAt: number;
  jtiReasonHash: string;
  jtiStatus: "PENDING" | "USED";
  kind: "BUY_NOW" | "END_OF_AUCTION";
  pointsAdminSubjectHash: string;
  workflowAttempt: number;
  settlementRevision: number;
  sagaState: string;
  planHash: string;
}

export async function consumeSettlementRetryAuthorization(
  db: D1Database,
  input: {
    authorizationId?: string;
    marketsUserId: string;
    now: number;
    sessionId: string;
    settlementId: string;
  },
) {
  const row = await db
    .prepare(
      `SELECT a.id, a.settlement_id AS settlementId, a.auction_id AS auctionId,
            a.markets_user_id AS marketsUserId, a.auth_user_id AS authUserId,
            a.session_id AS sessionId, a.reason_hash AS reasonHash, a.status,
            a.assertion_jti AS assertionJti, a.expires_at AS expiresAt,
            j.status AS jtiStatus, j.reason_hash AS jtiReasonHash,
            j.expires_at AS jtiExpiresAt,
            j.points_admin_subject_hash AS pointsAdminSubjectHash,
            s.kind, s.saga_state AS sagaState, s.settlement_revision AS settlementRevision,
            s.workflow_attempt AS workflowAttempt, p.plan_hash AS planHash,
            (SELECT h.status FROM buy_now_holds h
             WHERE h.id = json_extract(p.plan_json, '$.buyNowHoldId')) AS buyNowHoldStatus
     FROM settlement_retry_authorizations a
     JOIN settlement_retry_assertion_jtis j ON j.authorization_id = a.id
     JOIN settlements s ON s.id = a.settlement_id
     JOIN settlement_plans p ON p.id = s.current_plan_id
     WHERE a.settlement_id = ? AND a.markets_user_id = ?
     ORDER BY a.created_at DESC LIMIT 1`,
    )
    .bind(input.settlementId, input.marketsUserId)
    .first<PendingRetryRow>();
  if (!row) throw new Error("ADMIN_ASSERTION_NOT_FOUND");
  if (input.authorizationId && row.id !== input.authorizationId) {
    throw new Error("ADMIN_ASSERTION_NOT_FOUND");
  }
  if (row.status === "USED" || row.jtiStatus === "USED")
    throw new Error("ADMIN_ASSERTION_REPLAYED");
  if (row.sessionId !== input.sessionId) throw new Error("ADMIN_ASSERTION_SESSION_MISMATCH");
  if (row.status !== "PENDING" || row.reasonHash !== row.jtiReasonHash) {
    throw new Error("ADMIN_ASSERTION_TARGET_CHANGED");
  }
  if (row.expiresAt < input.now || row.jtiExpiresAt < input.now) {
    throw new Error("ADMIN_ASSERTION_EXPIRED");
  }
  if (row.sagaState !== "MANUAL_ACTION_REQUIRED") {
    throw new Error("SETTLEMENT_RETRY_NOT_ALLOWED");
  }
  if (row.kind === "BUY_NOW" && row.buyNowHoldStatus !== "PENDING") {
    throw new Error("SETTLEMENT_RETRY_NOT_ALLOWED");
  }
  const count = await db
    .prepare(
      `SELECT count(*) AS count FROM settlement_retry_rate_events
     WHERE points_admin_subject_hash = ? AND markets_user_id = ? AND auction_id = ?
       AND created_at >= ?`,
    )
    .bind(
      row.pointsAdminSubjectHash,
      row.marketsUserId,
      row.auctionId,
      new Date(input.now - 3_600_000).toISOString(),
    )
    .first<{ count: number }>();
  if ((count?.count ?? 0) >= 5) throw new Error("SETTLEMENT_RETRY_RATE_LIMITED");

  const nextAttempt = row.workflowAttempt + 1;
  const outboxId = `retry:${row.settlementId}:${nextAttempt}`;
  const timestamp = new Date(input.now).toISOString();
  await db.batch([
    db
      .prepare(
        "UPDATE settlement_retry_assertion_jtis SET status = 'USED', used_at = ? WHERE jti = ? AND status = 'PENDING'",
      )
      .bind(timestamp, row.assertionJti),
    db
      .prepare(
        "UPDATE settlement_retry_authorizations SET status = 'USED', updated_at = ? WHERE id = ? AND status = 'PENDING'",
      )
      .bind(timestamp, row.id),
    db
      .prepare(
        `INSERT INTO settlement_retry_rate_events
       (id, jti, points_admin_subject_hash, markets_user_id, auction_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `rate_${crypto.randomUUID()}`,
        row.assertionJti,
        row.pointsAdminSubjectHash,
        row.marketsUserId,
        row.auctionId,
        timestamp,
      ),
    db
      .prepare(
        `UPDATE settlements SET workflow_attempt = ?, updated_at = ?
       WHERE id = ? AND workflow_attempt = ? AND saga_state = 'MANUAL_ACTION_REQUIRED'`,
      )
      .bind(nextAttempt, timestamp, row.settlementId, row.workflowAttempt),
    db
      .prepare(
        `INSERT INTO settlement_outbox
       (id, settlement_id, settlement_revision, workflow_attempt, plan_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
      )
      .bind(
        outboxId,
        row.settlementId,
        row.settlementRevision,
        nextAttempt,
        row.planHash,
        timestamp,
      ),
  ]);
  return { outboxId, status: "ACCEPTED" as const, workflowAttempt: nextAttempt };
}

export async function readSafeSettlementStatus(
  db: D1Database,
  input: {
    marketsUserId: string;
    settlementId: string;
  },
) {
  const row = await db
    .prepare(
      `SELECT s.id AS settlementId, s.kind, s.saga_state AS sagaState, s.updated_at AS updatedAt,
              (SELECT h.status FROM buy_now_holds h
               JOIN settlement_plans p2 ON p2.id = s.current_plan_id
               WHERE h.id = json_extract(p2.plan_json, '$.buyNowHoldId')) AS buyNowHoldStatus
     FROM settlements s JOIN auctions a ON a.id = s.auction_id
     WHERE s.id = ? AND (
       a.seller_markets_user_id = ?
       OR EXISTS (
         SELECT 1 FROM settlement_rounds r
         JOIN settlement_round_winners w ON w.settlement_round_id = r.id
         WHERE r.settlement_id = s.id AND w.markets_user_id = ?
       )
       OR EXISTS (
         SELECT 1 FROM settlement_allocations sa
         WHERE sa.settlement_id = s.id AND sa.buyer_markets_user_id = ?
       )
       OR EXISTS (
         SELECT 1 FROM settlement_plans bp
         JOIN buy_now_holds bh ON bh.id = json_extract(bp.plan_json, '$.buyNowHoldId')
         WHERE bp.id = s.current_plan_id AND bh.auction_id = s.auction_id
           AND bh.buyer_markets_user_id = ?
       )
     )`,
    )
    .bind(
      input.settlementId,
      input.marketsUserId,
      input.marketsUserId,
      input.marketsUserId,
      input.marketsUserId,
    )
    .first<{
      buyNowHoldStatus: string | null;
      kind: "END_OF_AUCTION" | "BUY_NOW";
      sagaState: string;
      settlementId: string;
      updatedAt: string;
    }>();
  if (!row) throw new Error("SETTLEMENT_NOT_FOUND");
  const state =
    row.kind === "BUY_NOW" && row.buyNowHoldStatus === "FAILED_RESTORED"
      ? "FAILED_RESTORED"
      : row.sagaState === "SETTLED"
        ? "SETTLED"
        : row.sagaState === "MANUAL_ACTION_REQUIRED"
          ? "ACTION_REQUIRED"
          : row.sagaState === "CAPTURED" || row.sagaState === "FINALIZING"
            ? "FINALIZING"
            : row.sagaState === "PLANNED"
              ? "PENDING"
              : "PROCESSING";
  const progress =
    state === "FAILED_RESTORED"
      ? "Restored"
      : state === "SETTLED"
        ? "Settled"
        : state === "ACTION_REQUIRED"
          ? "Manual action required"
          : state === "FINALIZING"
            ? "Finalizing"
            : state === "PENDING"
              ? "Pending"
              : "Processing";
  return {
    kind: row.kind,
    manualActionAllowed: state === "ACTION_REQUIRED",
    progress,
    settlementId: row.settlementId,
    state,
    updatedAt: row.updatedAt,
  };
}
