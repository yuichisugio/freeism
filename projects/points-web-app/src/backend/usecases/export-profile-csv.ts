import { encodeCsvHeader, encodeCsvRow, textCell } from "../csv/csv-export";
import { parseCsvExportCursor } from "../csv/csv-export-cursor";

const PROFILE_HEADER = ["pointsUserId", "displayName", "description", "visibility"] as const;

/** リクエスト時点のプロフィールを読み、CSVとして返す。 */
export async function exportProfileCsv(
  db: D1Database,
  input: { cursor: string; targetPointsUserId: string },
) {
  const ordinal = parseCsvExportCursor(input.cursor);
  if (ordinal > 1) throw new Error("CSV_EXPORT_CURSOR_INVALID");
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

  const row =
    ordinal === 0
      ? encodeCsvRow(PROFILE_HEADER, [
          textCell(profile.pointsUserId),
          textCell(profile.displayName),
          textCell(profile.description),
          textCell(profile.visibility),
        ])
      : "";
  const encoder = new TextEncoder();
  if (encoder.encode(row).byteLength > 8192) throw new Error("CSV_EXPORT_ROW_TOO_LARGE");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`\uFEFF${encodeCsvHeader(PROFILE_HEADER)}`));
      if (row) controller.enqueue(encoder.encode(row));
      controller.close();
    },
  });
  return { finalPage: true, returnedRows: row ? 1 : 0, stream, totalRows: 1 };
}
