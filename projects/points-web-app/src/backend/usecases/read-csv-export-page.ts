import { encodeCsvHeader } from "../csv/csv-export";
import { createCsvExportCursor, verifyCsvExportCursor } from "../csv/csv-export-cursor";
import {
  findCsvExportSnapshot,
  readCsvExportRows,
} from "../infrastructure/db/d1-csv-export-repository";

const MAX_PAGE_BYTES = 8 * 1024 * 1024;

export async function readCsvExportPage(
  db: D1Database,
  input: {
    actorPointsUserId: string;
    cursor: string;
    cursorSecret: string;
    exportId: string;
    now?: Date;
  },
) {
  const snapshot = await findCsvExportSnapshot(db, input);
  if (!snapshot) throw new Error("RESOURCE_NOT_FOUND");
  const snapshotAt = new Date(snapshot.snapshotAt).toISOString();
  const now = (input.now ?? new Date()).toISOString();
  const cursor = await verifyCsvExportCursor({
    cursor: input.cursor,
    exportId: snapshot.exportId,
    filterHash: snapshot.filterHash,
    now,
    secret: input.cursorSecret,
    snapshotAt,
  });
  const candidates = await readCsvExportRows(db, {
    exportId: snapshot.exportId,
    limit: snapshot.pageSize + 1,
    nextOrdinal: cursor.nextOrdinal,
  });
  const header = encodeCsvHeader(snapshot.header);
  let bytes = new TextEncoder().encode(header).byteLength;
  const rows: typeof candidates = [];
  for (const candidate of candidates.slice(0, snapshot.pageSize)) {
    if (bytes + candidate.encodedBytes > MAX_PAGE_BYTES) break;
    rows.push(candidate);
    bytes += candidate.encodedBytes;
  }
  const nextOrdinal = cursor.nextOrdinal + rows.length;
  const finalPage = nextOrdinal >= snapshot.totalRows;
  const nextCursor = finalPage
    ? null
    : await createCsvExportCursor({
        exportId: snapshot.exportId,
        expiresAt: new Date(snapshot.expiresAt).toISOString(),
        filterHash: snapshot.filterHash,
        nextOrdinal,
        now,
        secret: input.cursorSecret,
        snapshotAt,
      });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(header));
      for (const row of rows) controller.enqueue(encoder.encode(row.encodedRow));
      controller.close();
    },
  });
  return { finalPage, nextCursor, returnedRows: rows.length, snapshot, stream };
}
