import { sql } from "drizzle-orm";
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const csvExportSnapshots = sqliteTable(
  "csv_export_snapshot",
  {
    id: text("id").primaryKey(),
    actorPointsUserId: text("actor_points_user_id").notNull(),
    targetPointsUserId: text("target_points_user_id").notNull(),
    exportType: text("export_type", { enum: ["PROFILE"] }).notNull(),
    filterHash: text("filter_hash").notNull(),
    headerJson: text("header_json", { mode: "json" }).$type<string[]>().notNull(),
    pageSize: integer("page_size").notNull(),
    snapshotAt: integer("snapshot_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    totalRows: integer("total_rows").notNull(),
    totalEncodedBytes: integer("total_encoded_bytes").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("csv_export_snapshot_actor_idempotency_uidx").on(
      table.actorPointsUserId,
      table.idempotencyKey,
    ),
    check("csv_export_snapshot_page_size_check", sql`${table.pageSize} between 1 and 1000`),
    check("csv_export_snapshot_total_rows_check", sql`${table.totalRows} between 0 and 50000`),
    check(
      "csv_export_snapshot_total_bytes_check",
      sql`${table.totalEncodedBytes} between 0 and 52428800`,
    ),
    check("csv_export_snapshot_type_check", sql`${table.exportType} = 'PROFILE'`),
  ],
);

export const csvExportSnapshotRows = sqliteTable(
  "csv_export_snapshot_row",
  {
    exportId: text("export_id")
      .notNull()
      .references(() => csvExportSnapshots.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    encodedRow: text("encoded_row").notNull(),
    encodedBytes: integer("encoded_bytes").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.exportId, table.ordinal] }),
    check("csv_export_snapshot_row_ordinal_check", sql`${table.ordinal} >= 0`),
    check("csv_export_snapshot_row_bytes_check", sql`${table.encodedBytes} between 1 and 8192`),
  ],
);
