import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { marketsUsers } from "./markets-user";

export const pointsOAuthStates = sqliteTable(
  "points_oauth_state",
  {
    linkAttemptId: text("link_attempt_id").primaryKey(),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    stateHash: text("state_hash").notNull(),
    pkceVerifier: text("pkce_verifier").notNull(),
    nonce: text("nonce").notNull(),
    callbackUri: text("callback_uri").notNull(),
    returnUrlHash: text("return_url_hash").notNull(),
    requestedScopes: text("requested_scopes").notNull(),
    attemptPayloadHash: text("attempt_payload_hash").notNull(),
    status: text("status", { enum: ["STARTED", "CALLBACK_COMPLETE", "CANCELLED"] })
      .default("STARTED")
      .notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("points_oauth_state_hash_uidx").on(table.stateHash),
    index("points_oauth_state_markets_user_idx").on(table.marketsUserId),
  ],
);

export const pointsConnections = sqliteTable(
  "points_connection",
  {
    id: text("id").primaryKey(),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["PENDING_CONFIRMATION", "ACTIVE", "REAUTH_REQUIRED", "UNLINKED", "CANCELLED"],
    }).notNull(),
    linkAttemptId: text("link_attempt_id").notNull(),
    attemptPayloadHash: text("attempt_payload_hash").notNull(),
    pointsIssuer: text("points_issuer").notNull(),
    pointsSubject: text("points_subject").notNull(),
    userClientId: text("user_client_id").notNull(),
    m2mClientId: text("m2m_client_id").notNull(),
    grantedScopes: text("granted_scopes").notNull(),
    sessionId: text("session_id").notNull(),
    pointsGrantId: text("points_grant_id"),
    pointsGrantVersion: integer("points_grant_version"),
    confirmationReceiptId: text("confirmation_receipt_id"),
    deactivationReceiptId: text("deactivation_receipt_id"),
    betterAuthAccountId: text("better_auth_account_id"),
    tokenVersion: integer("token_version").default(1).notNull(),
    refreshLeaseOwner: text("refresh_lease_owner"),
    refreshLeaseExpiresAt: integer("refresh_lease_expires_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("points_connection_link_attempt_uidx").on(table.linkAttemptId),
    uniqueIndex("points_connection_live_markets_user_uidx")
      .on(table.marketsUserId)
      .where(sql`${table.status} IN ('PENDING_CONFIRMATION', 'ACTIVE')`),
    uniqueIndex("points_connection_live_subject_uidx")
      .on(table.pointsIssuer, table.pointsSubject)
      .where(sql`${table.status} IN ('PENDING_CONFIRMATION', 'ACTIVE')`),
    index("points_connection_auth_user_idx").on(table.authUserId),
  ],
);

export const pointsUnlinkAuthorizations = sqliteTable(
  "points_unlink_authorization",
  {
    id: text("id").primaryKey(),
    pointsConnectionId: text("points_connection_id")
      .notNull()
      .references(() => pointsConnections.id),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    stateHash: text("state_hash").notNull(),
    pkceVerifier: text("pkce_verifier").notNull(),
    nonce: text("nonce").notNull(),
    callbackUri: text("callback_uri").notNull(),
    reason: text("reason").notNull(),
    status: text("status", { enum: ["STARTED", "PENDING", "USED"] })
      .default("STARTED")
      .notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [uniqueIndex("points_unlink_authorization_state_uidx").on(table.stateHash)],
);
