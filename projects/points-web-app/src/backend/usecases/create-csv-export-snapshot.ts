import { encodeCsvHeader, encodeCsvRow, textCell } from "../csv/csv-export";
import { createCsvExportCursor } from "../csv/csv-export-cursor";
import { canonicalJson, sha256Hex } from "../csv/csv-validation-result";
import {
  findCsvExportReplay,
  insertCsvExportSnapshot,
  type CsvExportSnapshotRecord,
} from "../infrastructure/db/d1-csv-export-repository";

const PROFILE_HEADER = ["pointsUserId", "displayName", "description", "visibility"] as const;
const SNAPSHOT_MILLISECONDS = 30 * 60 * 1000;

export interface CreateCsvExportSnapshotInput {
  actorPointsUserId: string;
  cursorSecret: string;
  exportType: "PROFILE";
  idempotencyKey: string;
  now?: Date;
  pageSize: number;
  targetPointsUserId: string;
}

async function response(snapshot: CsvExportSnapshotRecord, secret: string) {
  const snapshotAt = new Date(snapshot.snapshotAt).toISOString();
  const expiresAt = new Date(snapshot.expiresAt).toISOString();
  return {
    cursor: await createCsvExportCursor({
      exportId: snapshot.exportId,
      expiresAt,
      filterHash: snapshot.filterHash,
      nextOrdinal: 0,
      now: snapshotAt,
      secret,
      snapshotAt,
    }),
    expiresAt: new Date(snapshot.expiresAt),
    exportId: snapshot.exportId,
    snapshotAt: new Date(snapshot.snapshotAt),
    totalRows: snapshot.totalRows,
  };
}

export async function createCsvExportSnapshot(db: D1Database, input: CreateCsvExportSnapshotInput) {
  const filterHash = `sha256:${await sha256Hex(
    canonicalJson({
      pageSize: input.pageSize,
      targetPointsUserId: input.targetPointsUserId,
      type: input.exportType,
    }),
  )}`;
  const replay = await findCsvExportReplay(db, input);
  if (replay) {
    if (replay.filterHash !== filterHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return response(replay, input.cursorSecret);
  }

  const profile = await db
    .prepare(
      `SELECT points_user.id AS pointsUserId,
              coalesce(profiles.display_name, user.name, points_user.id) AS displayName,
              coalesce(profiles.description, '') AS description,
              coalesce(profiles.visibility, 'PUBLIC') AS visibility
       FROM points_user
       JOIN user ON user.id = points_user.auth_user_id
       LEFT JOIN profiles ON profiles.points_user_id = points_user.id
       WHERE points_user.id = ? AND points_user.account_status = 'ACTIVE'`,
    )
    .bind(input.targetPointsUserId)
    .first<{
      description: string;
      displayName: string;
      pointsUserId: string;
      visibility: string;
    }>();
  if (!profile) throw new Error("RESOURCE_NOT_FOUND");

  const encodedRow = encodeCsvRow(PROFILE_HEADER, [
    textCell(profile.pointsUserId),
    textCell(profile.displayName),
    textCell(profile.description),
    textCell(profile.visibility),
  ]);
  const rowBytes = new TextEncoder().encode(encodedRow).byteLength;
  if (rowBytes > 8192) throw new Error("CSV_EXPORT_ROW_TOO_LARGE");
  const headerBytes = new TextEncoder().encode(encodeCsvHeader(PROFILE_HEADER)).byteLength;
  const totalEncodedBytes = headerBytes + rowBytes;
  if (totalEncodedBytes > 50 * 1024 * 1024) throw new Error("CSV_EXPORT_SNAPSHOT_TOO_LARGE");

  const snapshotAt = (input.now ?? new Date()).getTime();
  const snapshot: CsvExportSnapshotRecord = {
    actorPointsUserId: input.actorPointsUserId,
    expiresAt: snapshotAt + SNAPSHOT_MILLISECONDS,
    exportId: `csvx_${crypto.randomUUID()}`,
    exportType: input.exportType,
    filterHash,
    header: [...PROFILE_HEADER],
    pageSize: input.pageSize,
    snapshotAt,
    targetPointsUserId: input.targetPointsUserId,
    totalRows: 1,
  };
  try {
    await insertCsvExportSnapshot(db, {
      ...snapshot,
      encodedRow,
      idempotencyKey: input.idempotencyKey,
      totalEncodedBytes,
    });
  } catch (error) {
    const concurrentReplay = await findCsvExportReplay(db, input);
    if (!concurrentReplay) throw error;
    if (concurrentReplay.filterHash !== filterHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return response(concurrentReplay, input.cursorSecret);
  }
  return response(snapshot, input.cursorSecret);
}
