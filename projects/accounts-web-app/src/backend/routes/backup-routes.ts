import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { jsonFileMaxBytes } from "../../shared/constants";
import { backupSchema } from "../../shared/schemas/backup-schema";
import { createDatabase } from "../db/database";
import type { AppEnv } from "../hono-env";
import { purgeProfileCache } from "../infrastructure/cache/profile-cache-purger";
import { auditRequest } from "../logging/audit-request";
import { requireSession } from "../middleware/session-middleware";
import {
  dataResponse,
  handleBffError,
  parseJsonBody,
  ProblemError,
  problemResponse,
} from "../problem-details";
import { exportBackup, readBackupSummary } from "../usecases/backup/export-backup";
import { restoreBackup } from "../usecases/backup/restore-backup";

/**
 * JSONによるバックアップの出力・出力前の確認・復元（`/api/backup`）。
 * @see ../../shared/schemas/backup-schema.ts
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./backup-routes.worker.test.ts
 */
export const backupRoutes = new Hono<AppEnv>()
  .onError(handleBffError)
  .get("/summary", requireSession({ fresh: false }), async (c) => {
    const summary = await readBackupSummary(
      { db: createDatabase(c.env.DB), accountsOrigin: c.env.ACCOUNTS_ORIGIN, now: new Date() },
      { userId: c.get("sessionUser").id },
    );
    return dataResponse(c, summary);
  })
  .get("/", auditRequest("backup_exported"), requireSession({ fresh: false }), async (c) => {
    const { fileName, json } = await exportBackup(
      { db: createDatabase(c.env.DB), accountsOrigin: c.env.ACCOUNTS_ORIGIN, now: new Date() },
      { userId: c.get("sessionUser").id },
    );
    return c.body(json, 200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    });
  })
  .post(
    "/restore",
    auditRequest("backup_restored"),
    requireSession({ fresh: true }),
    // ファイル内容の上限をDBの変更前に検査する。
    bodyLimit({
      maxSize: jsonFileMaxBytes,
      onError: (c) => problemResponse(c, new ProblemError(413, "REQUEST_TOO_LARGE")),
    }),
    async (c) => {
      const backup = await parseJsonBody(c, backupSchema);
      const { affectedUserIds, ...result } = await restoreBackup(
        { db: createDatabase(c.env.DB), now: new Date() },
        { userId: c.get("sessionUser").id, backup },
      );
      // 表示名を戻すため、一般公開の有無によらず本人の公開プロフィールをpurgeする。
      purgeProfileCache(affectedUserIds);
      return dataResponse(c, result);
    },
  );
