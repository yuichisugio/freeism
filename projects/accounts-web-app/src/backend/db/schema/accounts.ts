import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { IdentifierKind } from "../../domain/identity/identifier-key";
import type { VerificationMethod } from "../../domain/identity/verification-method";
import type {
  VerificationFailureCode,
  VerificationResult,
} from "../../domain/verification/verification-result";
import { account, user } from "./auth";

/**
 * Accounts独自の6表。
 * 日時はUTC epoch millisecondsのINTEGER、真偽は0/1のINTEGERで保存し、外部キーはすべて`ON DELETE CASCADE`にする。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */

// --------------------------------------------------
// 外部アカウントと識別子
// --------------------------------------------------

/**
 * 本人の外部アカウントの表示行。
 */
export const externalAccounts = sqliteTable(
  "external_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    service: text("service"),
    displayName: text("display_name"),
    email: text("email"),
    linkedAt: integer("linked_at", { mode: "timestamp_ms" }),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    importedVerificationsJson: text("imported_verifications_json"),
  },
  (table) => [
    unique("external_accounts_id_user_id_unique").on(table.id, table.userId),
    index("external_accounts_user_id_idx").on(table.userId),
  ],
);

/**
 * 外部アカウントの識別子。
 * `is_active=1`の行だけに全体の部分UNIQUEを掛け、現在有効な所有者を最大1人にする。
 */
export const externalIdentifiers = sqliteTable(
  "external_identifiers",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    userId: text("user_id").notNull(),
    kind: text("kind").$type<IdentifierKind>().notNull(),
    provider: text("provider").notNull().default(""),
    issuer: text("issuer").notNull().default(""),
    value: text("value").notNull(),
    host: text("host"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    foreignKey({
      name: "external_identifiers_account_fk",
      columns: [table.accountId, table.userId],
      foreignColumns: [externalAccounts.id, externalAccounts.userId],
    }).onDelete("cascade"),
    unique("external_identifiers_user_key_unique").on(
      table.userId,
      table.kind,
      table.provider,
      table.issuer,
      table.value,
    ),
    uniqueIndex("external_identifiers_active_key_unique")
      .on(table.kind, table.provider, table.issuer, table.value)
      .where(sql`${table.isActive} = 1`),
    index("external_identifiers_user_host_kind_idx").on(table.userId, table.host, table.kind),
  ],
);

// --------------------------------------------------
// 証明
// --------------------------------------------------

/**
 * 外部アカウントの証明方法ごとの証明行。
 * `verified_at`は現在有効な成功の日時、`checked_at`・`result`・`failure_code`は直近の試行を表す。
 */
export const externalAccountVerifications = sqliteTable(
  "external_account_verifications",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => externalAccounts.id, { onDelete: "cascade" }),
    method: text("method").$type<VerificationMethod>().notNull(),
    evidenceKey: text("evidence_key").notNull(),
    authAccountId: text("auth_account_id").references(() => account.id, { onDelete: "cascade" }),
    evidenceUrl: text("evidence_url"),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }).notNull(),
    result: text("result").$type<VerificationResult>().notNull(),
    failureCode: text("failure_code").$type<VerificationFailureCode>(),
  },
  (table) => [
    unique("external_account_verifications_evidence_unique").on(
      table.accountId,
      table.method,
      table.evidenceKey,
    ),
    index("external_account_verifications_account_id_idx").on(table.accountId),
  ],
);

/**
 * 成功した証明が実際に確認した識別子との関連。
 */
export const verificationIdentifiers = sqliteTable(
  "verification_identifiers",
  {
    verificationId: text("verification_id")
      .notNull()
      .references(() => externalAccountVerifications.id, { onDelete: "cascade" }),
    identifierId: text("identifier_id")
      .notNull()
      .references(() => externalIdentifiers.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      name: "verification_identifiers_pk",
      columns: [table.verificationId, table.identifierId],
    }),
    index("verification_identifiers_identifier_id_idx").on(table.identifierId),
  ],
);

// --------------------------------------------------
// 情報提供の同意と公開設定
// --------------------------------------------------

/**
 * OAuthクライアントへの情報提供同意。
 * `client_id`は公開`oauthClient.clientId`を保存し、存在しないClient IDの復元設定も保持するためFKを設けない。
 */
export const clientConsents = sqliteTable(
  "client_consents",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    displayName: text("display_name").notNull(),
    consented: integer("consented", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    primaryKey({ name: "client_consents_pk", columns: [table.userId, table.clientId] }),
    index("client_consents_client_user_consented_idx").on(
      table.clientId,
      table.userId,
      table.consented,
    ),
  ],
);

/**
 * 外部アカウントごとのOAuthクライアント向け公開選択。
 */
export const externalAccountVisibility = sqliteTable(
  "external_account_visibility",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => externalAccounts.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    primaryKey({
      name: "external_account_visibility_pk",
      columns: [table.accountId, table.clientId],
    }),
    index("external_account_visibility_client_account_public_idx").on(
      table.clientId,
      table.accountId,
      table.isPublic,
    ),
  ],
);
