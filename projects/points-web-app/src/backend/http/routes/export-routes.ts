import type { Context, Hono } from "hono";

import { createCsvExportSnapshot } from "../../usecases/create-csv-export-snapshot";
import { readCsvExportPage } from "../../usecases/read-csv-export-page";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { findFreshGoogleAccountId } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware, profileBodyLimit } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

interface CreateExportBody {
  pageSize?: unknown;
  targetPointsUserId?: unknown;
  type?: unknown;
}

function mapExportError(context: Context<BackendContext>, error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  if (code === "RESOURCE_NOT_FOUND") return problem(context, 404, code, "Resource not found");
  if (code === "CSV_EXPORT_CURSOR_EXPIRED") {
    return problem(context, 410, code, "CSV export cursor expired");
  }
  if (code === "IDEMPOTENCY_KEY_REUSED") {
    return problem(context, 409, code, "Idempotency key reused");
  }
  if (code === "CSV_EXPORT_ROW_TOO_LARGE" || code === "CSV_EXPORT_SNAPSHOT_TOO_LARGE") {
    return problem(context, 422, code, "CSV export is too large");
  }
  if (code === "CSV_EXPORT_CURSOR_INVALID") {
    return problem(context, 422, "VALIDATION_FAILED", "Invalid CSV export request");
  }
  throw error;
}

export function registerExportRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const sessionMiddleware = createSessionMiddleware(getSession);
  app.post(
    "/api/csv-exports",
    profileBodyLimit,
    sessionMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      let body: CreateExportBody;
      try {
        body = await context.req.json<CreateExportBody>();
      } catch {
        return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
      }
      const pageSize = body.pageSize ?? 1000;
      if (
        body.type !== "PROFILE" ||
        !Number.isInteger(pageSize) ||
        (pageSize as number) < 1 ||
        (pageSize as number) > 1000 ||
        (body.targetPointsUserId !== undefined && typeof body.targetPointsUserId !== "string")
      ) {
        return problem(context, 422, "VALIDATION_FAILED", "Invalid CSV export request");
      }

      const env = requireBindings(context.env);
      const actorPointsUserId = context.get("pointsUser").id;
      const targetPointsUserId = body.targetPointsUserId ?? actorPointsUserId;
      if (targetPointsUserId !== actorPointsUserId) {
        const membership = await env.DB.prepare(
          "SELECT 1 AS allowed FROM admin_membership WHERE points_user_id = ? AND role = 'ADMIN'",
        )
          .bind(actorPointsUserId)
          .first();
        if (!membership) {
          return problem(context, 403, "ADMIN_REQUIRED", "Administrator permission required");
        }
        const googleAccountId = await findFreshGoogleAccountId(
          context.env,
          context.get("authSession").session,
        );
        if (!googleAccountId) {
          return problem(context, 401, "FRESH_GOOGLE_AUTH_REQUIRED", "Fresh Google auth required");
        }
      }

      try {
        const snapshot = await createCsvExportSnapshot(env.DB, {
          actorPointsUserId,
          cursorSecret: env.CSV_EXPORT_CURSOR_SECRET,
          exportType: "PROFILE",
          idempotencyKey: context.req.header("Idempotency-Key")!,
          pageSize: pageSize as number,
          targetPointsUserId,
        });
        return context.json(
          {
            data: {
              ...snapshot,
              expiresAt: snapshot.expiresAt.toISOString(),
              snapshotAt: snapshot.snapshotAt.toISOString(),
            },
            meta: { requestId: `req_${crypto.randomUUID()}` },
          },
          201,
          { "Cache-Control": "private, no-store" },
        );
      } catch (error) {
        return mapExportError(context, error);
      }
    },
  );

  app.get("/api/csv-exports/:exportId/pages", sessionMiddleware, async (context) => {
    const cursor = context.req.query("cursor");
    if (!cursor) return problem(context, 422, "VALIDATION_FAILED", "CSV cursor is required");
    const env = requireBindings(context.env);
    try {
      const page = await readCsvExportPage(env.DB, {
        actorPointsUserId: context.get("pointsUser").id,
        cursor,
        cursorSecret: env.CSV_EXPORT_CURSOR_SECRET,
        exportId: context.req.param("exportId"),
      });
      const headers = new Headers({
        "Cache-Control": "private, no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "X-Freeism-Export-Id": page.snapshot.exportId,
        "X-Freeism-Final-Page": String(page.finalPage),
        "X-Freeism-Returned-Rows": String(page.returnedRows),
        "X-Freeism-Snapshot-At": new Date(page.snapshot.snapshotAt).toISOString(),
        "X-Freeism-Total-Rows": String(page.snapshot.totalRows),
      });
      if (page.nextCursor) headers.set("X-Freeism-Next-Cursor", page.nextCursor);
      return new Response(page.stream, { headers });
    } catch (error) {
      return mapExportError(context, error);
    }
  });
}
