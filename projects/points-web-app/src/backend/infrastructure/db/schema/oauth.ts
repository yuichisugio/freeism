import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { pointsUsers } from "./points-user";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" }).notNull();

export const pointsOAuthLinkAttempts = sqliteTable(
  "points_oauth_link_attempt",
  {
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    stateHash: text("state_hash").notNull(),
    userClientId: text("user_client_id").notNull(),
    m2mClientId: text("m2m_client_id").notNull(),
    marketsUserId: text("markets_user_id").notNull(),
    pointsUserId: text("points_user_id").references(() => pointsUsers.id, { onDelete: "restrict" }),
    requestedScopes: text("requested_scopes").notNull(),
    status: text("status", {
      enum: ["PENDING_MARKETS_CONFIRMATION", "CONFIRMED", "CANCELLED"],
    }).notNull(),
    issuer: text("issuer"),
    pointsSubject: text("points_subject"),
    marketsPointsConnectionId: text("markets_points_connection_id"),
    finalizeIdempotencyKey: text("finalize_idempotency_key"),
    createdAt: timestamp("created_at"),
    expiresAt: timestamp("expires_at"),
    finalizedAt: integer("finalized_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("points_oauth_link_attempt_idempotency_uidx").on(
      table.m2mClientId,
      table.idempotencyKey,
    ),
    uniqueIndex("points_oauth_link_attempt_state_uidx").on(table.userClientId, table.stateHash),
    uniqueIndex("points_oauth_link_attempt_pending_markets_user_uidx")
      .on(table.userClientId, table.marketsUserId)
      .where(sql`${table.status} = 'PENDING_MARKETS_CONFIRMATION'`),
    uniqueIndex("points_oauth_link_attempt_pending_points_user_uidx")
      .on(table.userClientId, table.pointsUserId)
      .where(
        sql`${table.status} = 'PENDING_MARKETS_CONFIRMATION' and ${table.pointsUserId} is not null`,
      ),
    index("points_oauth_link_attempt_expiry_idx").on(table.status, table.expiresAt),
    check(
      "points_oauth_link_attempt_status_check",
      sql`${table.status} in ('PENDING_MARKETS_CONFIRMATION', 'CONFIRMED', 'CANCELLED')`,
    ),
    check(
      "points_oauth_link_attempt_expiry_check",
      sql`${table.expiresAt} > ${table.createdAt} and ${table.expiresAt} <= ${table.createdAt} + 600000`,
    ),
  ],
);

export const pointsOAuthConnections = sqliteTable(
  "points_oauth_connection",
  {
    id: text("id").primaryKey(),
    linkAttemptId: text("link_attempt_id")
      .notNull()
      .references(() => pointsOAuthLinkAttempts.id, { onDelete: "restrict" }),
    marketsPointsConnectionId: text("markets_points_connection_id").notNull(),
    userClientId: text("user_client_id").notNull(),
    m2mClientId: text("m2m_client_id").notNull(),
    marketsUserId: text("markets_user_id").notNull(),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    issuer: text("issuer").notNull(),
    pointsSubject: text("points_subject").notNull(),
    grantedScopes: text("granted_scopes").notNull(),
    status: text("status", { enum: ["ACTIVE", "REAUTH_REQUIRED", "UNLINKED"] }).notNull(),
    grantVersion: integer("grant_version").notNull().default(1),
    linkedAt: timestamp("linked_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("points_oauth_connection_attempt_uidx").on(table.linkAttemptId),
    uniqueIndex("points_oauth_connection_markets_id_uidx").on(table.marketsPointsConnectionId),
    uniqueIndex("points_oauth_connection_active_markets_user_uidx")
      .on(table.userClientId, table.marketsUserId)
      .where(sql`${table.status} in ('ACTIVE', 'REAUTH_REQUIRED')`),
    uniqueIndex("points_oauth_connection_active_points_user_uidx")
      .on(table.userClientId, table.pointsUserId)
      .where(sql`${table.status} in ('ACTIVE', 'REAUTH_REQUIRED')`),
    uniqueIndex("points_oauth_connection_subject_uidx").on(
      table.issuer,
      table.userClientId,
      table.pointsSubject,
    ),
    check(
      "points_oauth_connection_status_check",
      sql`${table.status} in ('ACTIVE', 'REAUTH_REQUIRED', 'UNLINKED')`,
    ),
    check("points_oauth_connection_version_check", sql`${table.grantVersion} >= 1`),
  ],
);

export const pointsOAuthConnectionDeactivations = sqliteTable(
  "points_oauth_connection_deactivation",
  {
    id: text("id").primaryKey(),
    pointsConnectionId: text("points_connection_id")
      .notNull()
      .references(() => pointsOAuthConnections.id, { onDelete: "restrict" }),
    userClientId: text("user_client_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    reason: text("reason").notNull(),
    grantVersion: integer("grant_version").notNull(),
    deactivatedAt: timestamp("deactivated_at"),
  },
  (table) => [
    uniqueIndex("points_oauth_connection_deactivation_connection_uidx").on(
      table.pointsConnectionId,
    ),
    uniqueIndex("points_oauth_connection_deactivation_idempotency_uidx").on(
      table.userClientId,
      table.idempotencyKey,
    ),
    check("points_oauth_connection_deactivation_version_check", sql`${table.grantVersion} >= 2`),
  ],
);

export const pointsOAuthRevocationOutbox = sqliteTable(
  "points_oauth_revocation_outbox",
  {
    id: text("id").primaryKey(),
    pointsConnectionId: text("points_connection_id")
      .notNull()
      .references(() => pointsOAuthConnections.id, { onDelete: "restrict" }),
    action: text("action", { enum: ["DELETE_CONSENT"] }).notNull(),
    status: text("status", { enum: ["PENDING", "DELIVERED"] }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at"),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("points_oauth_revocation_outbox_action_uidx").on(
      table.pointsConnectionId,
      table.action,
    ),
    index("points_oauth_revocation_outbox_pending_idx").on(table.status, table.createdAt),
    check(
      "points_oauth_revocation_outbox_status_check",
      sql`${table.status} in ('PENDING', 'DELIVERED')`,
    ),
  ],
);
