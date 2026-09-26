import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { pointsUsers } from "./points-user";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" }).notNull();
const nullableTimestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

// --------------------------------------------------
// 接続先 Accounts（運営者が設定する OAuth クライアント）
// --------------------------------------------------

/**
 * Points が OAuth クライアントとして接続する Accounts。
 * 秘密 JWK は Worker secret の KEK で暗号化して保存し、取り下げ時に消す。
 * @see ../../../../../docs/v0.2/details-ja/profile-setting.md
 */
export const accountsConnections = sqliteTable(
  "accounts_connections",
  {
    id: text("id").primaryKey(),
    accountsOrigin: text("accounts_origin").notNull(),
    displayName: text("display_name").notNull(),
    clientId: text("client_id"),
    status: text("status", {
      enum: ["PENDING_CLIENT_REGISTRATION", "ACTIVE", "WITHDRAWN"],
    }).notNull(),
    clientKeyId: text("client_key_id").notNull(),
    clientPublicJwk: text("client_public_jwk").notNull(),
    clientPrivateJwkCiphertext: text("client_private_jwk_ciphertext"),
    dpopPrivateJwkCiphertext: text("dpop_private_jwk_ciphertext"),
    createdByPointsUserId: text("created_by_points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
    activatedAt: nullableTimestamp("activated_at"),
    withdrawnAt: nullableTimestamp("withdrawn_at"),
  },
  (table) => [
    uniqueIndex("accounts_connections_live_origin_uidx")
      .on(table.accountsOrigin)
      .where(sql`${table.status} <> 'WITHDRAWN'`),
    check(
      "accounts_connections_status_check",
      sql`${table.status} in ('PENDING_CLIENT_REGISTRATION', 'ACTIVE', 'WITHDRAWN')`,
    ),
    check(
      "accounts_connections_display_name_check",
      sql`length(${table.displayName}) between 1 and 100`,
    ),
    check(
      "accounts_connections_client_id_check",
      sql`${table.status} <> 'ACTIVE' or ${table.clientId} is not null`,
    ),
    check(
      "accounts_connections_private_key_check",
      sql`(${table.status} = 'WITHDRAWN'
             and ${table.clientPrivateJwkCiphertext} is null
             and ${table.dpopPrivateJwkCiphertext} is null)
          or (${table.status} <> 'WITHDRAWN'
             and ${table.clientPrivateJwkCiphertext} is not null
             and ${table.dpopPrivateJwkCiphertext} is not null)`,
    ),
  ],
);

// --------------------------------------------------
// Points ユーザーと Accounts ユーザーの連携
// --------------------------------------------------

/**
 * Points ユーザーと Accounts ユーザーの連携と、連携アカウント一覧の取得結果。
 * 一覧は公開表示のために snapshot として保存する。
 * @see ../../../../../docs/v0.2/details-ja/profile-setting.md
 */
export const accountsLinks = sqliteTable(
  "accounts_links",
  {
    id: text("id").primaryKey(),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    accountsConnectionId: text("accounts_connection_id")
      .notNull()
      .references(() => accountsConnections.id, { onDelete: "restrict" }),
    accountsOrigin: text("accounts_origin").notNull(),
    accountsUserId: text("accounts_user_id").notNull(),
    linkedAt: timestamp("linked_at"),
    relinkedAt: nullableTimestamp("relinked_at"),
    provisionStatus: text("provision_status", { enum: ["PROVIDED", "NOT_PROVIDED"] }),
    externalAccountsJson: text("external_accounts_json"),
    externalAccountsFetchedAt: nullableTimestamp("external_accounts_fetched_at"),
  },
  (table) => [
    uniqueIndex("accounts_links_accounts_user_uidx").on(table.accountsOrigin, table.accountsUserId),
    index("accounts_links_points_user_idx").on(table.pointsUserId),
    index("accounts_links_refresh_idx").on(table.externalAccountsFetchedAt),
    check(
      "accounts_links_provision_status_check",
      sql`${table.provisionStatus} is null or ${table.provisionStatus} in ('PROVIDED', 'NOT_PROVIDED')`,
    ),
  ],
);

/**
 * 連携開始から callback までの試行。
 * state は hash で保存し、callback で1回だけ消費する。
 */
export const accountsLinkAttempts = sqliteTable(
  "accounts_link_attempts",
  {
    stateHash: text("state_hash").primaryKey(),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    authSessionIdHash: text("auth_session_id_hash").notNull(),
    accountsConnectionId: text("accounts_connection_id")
      .notNull()
      .references(() => accountsConnections.id, { onDelete: "restrict" }),
    nonce: text("nonce").notNull(),
    codeVerifier: text("code_verifier").notNull(),
    createdAt: timestamp("created_at"),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    index("accounts_link_attempts_expiry_idx").on(table.expiresAt),
    check(
      "accounts_link_attempts_expiry_check",
      sql`${table.expiresAt} > ${table.createdAt} and ${table.expiresAt} <= ${table.createdAt} + 600000`,
    ),
  ],
);

// --------------------------------------------------
// Client Credentials トークンのキャッシュ
// --------------------------------------------------

/** 接続先ごとの Client Credentials アクセストークン（暗号化済み）。 */
export const accountsClientTokens = sqliteTable("accounts_client_tokens", {
  accountsConnectionId: text("accounts_connection_id")
    .primaryKey()
    .references(() => accountsConnections.id, { onDelete: "restrict" }),
  accessTokenCiphertext: text("access_token_ciphertext").notNull(),
  expiresAt: timestamp("expires_at"),
  updatedAt: timestamp("updated_at"),
});
