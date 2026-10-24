import type { Context, Hono } from "hono";

import { exportProfileCsv } from "../../usecases/export-profile-csv";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { findFreshGoogleAccountId } from "../middleware/google-fresh-middleware";
import { profileBodyLimit } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

interface ExportBody {
  cursor?: unknown;
  pageSize?: unknown;
  targetPointsUserId?: unknown;
  type?: unknown;
}

function mapExportError(context: Context<BackendContext>, error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  if (code === "RESOURCE_NOT_FOUND") return problem(context, 404, code, "Resource not found");
  if (code === "CSV_EXPORT_ROW_TOO_LARGE") {
    return problem(context, 422, code, "CSV export is too large");
  }
  if (code === "CSV_EXPORT_CURSOR_INVALID") {
    return problem(context, 422, "VALIDATION_FAILED", "Invalid CSV export request");
  }
  throw error;
}

export function registerExportRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const sessionMiddleware = createSessionMiddleware(getSession);
  app.post("/api/csv-exports", profileBodyLimit, sessionMiddleware, async (context) => {
    let body: ExportBody;
    try {
      body = await context.req.json<ExportBody>();
    } catch {
      return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
    }
    const pageSize = body.pageSize ?? 1000;
    const cursor = body.cursor ?? "0";
    if (
      body.type !== "PROFILE" ||
      typeof cursor !== "string" ||
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
      const page = await exportProfileCsv(env.DB, {
        cursor: cursor as string,
        targetPointsUserId,
      });
      return new Response(page.stream, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "text/csv; charset=utf-8",
          "X-Freeism-Final-Page": String(page.finalPage),
          "X-Freeism-Returned-Rows": String(page.returnedRows),
          "X-Freeism-Total-Rows": String(page.totalRows),
        },
      });
    } catch (error) {
      return mapExportError(context, error);
    }
  });
}
