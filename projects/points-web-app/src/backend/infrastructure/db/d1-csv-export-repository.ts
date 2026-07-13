export interface CsvExportSnapshotRecord {
  actorPointsUserId: string;
  expiresAt: number;
  exportId: string;
  exportType: "PROFILE";
  filterHash: string;
  header: string[];
  pageSize: number;
  snapshotAt: number;
  targetPointsUserId: string;
  totalRows: number;
}

interface SnapshotRow {
  actorPointsUserId: string;
  expiresAt: number;
  exportId: string;
  exportType: "PROFILE";
  filterHash: string;
  headerJson: string;
  pageSize: number;
  snapshotAt: number;
  targetPointsUserId: string;
  totalRows: number;
}

function mapSnapshot(row: SnapshotRow): CsvExportSnapshotRecord {
  const header = JSON.parse(row.headerJson) as unknown;
  if (!Array.isArray(header) || !header.every((value) => typeof value === "string")) {
    throw new Error("CSV_EXPORT_SNAPSHOT_CORRUPT");
  }
  return { ...row, header };
}

const SNAPSHOT_SELECT = `SELECT id AS exportId, actor_points_user_id AS actorPointsUserId,
                                target_points_user_id AS targetPointsUserId,
                                export_type AS exportType, filter_hash AS filterHash,
                                header_json AS headerJson, page_size AS pageSize,
                                snapshot_at AS snapshotAt, expires_at AS expiresAt,
                                total_rows AS totalRows
                         FROM csv_export_snapshot`;

export async function findCsvExportSnapshot(
  db: D1Database,
  input: { actorPointsUserId: string; exportId: string },
): Promise<CsvExportSnapshotRecord | null> {
  const row = await db
    .prepare(`${SNAPSHOT_SELECT} WHERE id = ? AND actor_points_user_id = ?`)
    .bind(input.exportId, input.actorPointsUserId)
    .first<SnapshotRow>();
  return row ? mapSnapshot(row) : null;
}

export async function findCsvExportReplay(
  db: D1Database,
  input: { actorPointsUserId: string; idempotencyKey: string },
): Promise<CsvExportSnapshotRecord | null> {
  const row = await db
    .prepare(`${SNAPSHOT_SELECT} WHERE actor_points_user_id = ? AND idempotency_key = ?`)
    .bind(input.actorPointsUserId, input.idempotencyKey)
    .first<SnapshotRow>();
  return row ? mapSnapshot(row) : null;
}

export async function insertCsvExportSnapshot(
  db: D1Database,
  input: CsvExportSnapshotRecord & {
    encodedRow: string;
    idempotencyKey: string;
    totalEncodedBytes: number;
  },
): Promise<void> {
  const encodedBytes = new TextEncoder().encode(input.encodedRow).byteLength;
  await db.batch([
    db
      .prepare(
        `INSERT INTO csv_export_snapshot
           (id, actor_points_user_id, target_points_user_id, export_type, filter_hash,
            header_json, page_size, snapshot_at, expires_at, total_rows, total_encoded_bytes,
            idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.exportId,
        input.actorPointsUserId,
        input.targetPointsUserId,
        input.exportType,
        input.filterHash,
        JSON.stringify(input.header),
        input.pageSize,
        input.snapshotAt,
        input.expiresAt,
        input.totalRows,
        input.totalEncodedBytes,
        input.idempotencyKey,
        input.snapshotAt,
      ),
    db
      .prepare(
        `INSERT INTO csv_export_snapshot_row (export_id, ordinal, encoded_row, encoded_bytes)
         VALUES (?, 0, ?, ?)`,
      )
      .bind(input.exportId, input.encodedRow, encodedBytes),
  ]);
}

export async function readCsvExportRows(
  db: D1Database,
  input: { exportId: string; limit: number; nextOrdinal: number },
) {
  const result = await db
    .prepare(
      `SELECT ordinal, encoded_row AS encodedRow, encoded_bytes AS encodedBytes
       FROM csv_export_snapshot_row
       WHERE export_id = ? AND ordinal >= ?
       ORDER BY ordinal
       LIMIT ?`,
    )
    .bind(input.exportId, input.nextOrdinal, input.limit)
    .all<{ encodedBytes: number; encodedRow: string; ordinal: number }>();
  return result.results;
}
