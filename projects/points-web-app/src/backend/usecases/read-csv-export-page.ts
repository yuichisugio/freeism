import { encodeCsvHeader } from "../csv/csv-export";
import { createCsvExportCursor, parseCsvExportCursor } from "../csv/csv-export-cursor";
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
    exportId: string;
    now?: Date;
  },
) {
  const snapshot = await findCsvExportSnapshot(db, input);
  if (!snapshot) throw new Error("RESOURCE_NOT_FOUND");
  if ((input.now ?? new Date()).getTime() >= snapshot.expiresAt) {
    throw new Error("CSV_EXPORT_CURSOR_EXPIRED");
  }
  const nextOrdinal = parseCsvExportCursor(input.cursor);
  const candidates = await readCsvExportRows(db, {
    exportId: snapshot.exportId,
    limit: snapshot.pageSize + 1,
    nextOrdinal,
  });
  const header = encodeCsvHeader(snapshot.header);
  let bytes = new TextEncoder().encode(header).byteLength;
  const rows: typeof candidates = [];
  for (const candidate of candidates.slice(0, snapshot.pageSize)) {
    if (bytes + candidate.encodedBytes > MAX_PAGE_BYTES) break;
    rows.push(candidate);
    bytes += candidate.encodedBytes;
  }
  const followingOrdinal = nextOrdinal + rows.length;
  const finalPage = followingOrdinal >= snapshot.totalRows;
  const nextCursor = finalPage ? null : createCsvExportCursor(followingOrdinal);
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
