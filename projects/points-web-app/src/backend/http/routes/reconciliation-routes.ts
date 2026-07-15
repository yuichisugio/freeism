import type { Hono } from "hono";

import {
  reconcilePoints,
  ReconciliationRunError,
  runPointsReconciliation,
} from "../../usecases/reconcile-points";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { adminMiddleware } from "../middleware/admin-middleware";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

export function registerReconciliationRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const sessionMiddleware = createSessionMiddleware(getSession);

  app.get("/api/reconciliation", sessionMiddleware, adminMiddleware, async (context) => {
    const requestId = `req_${crypto.randomUUID()}`;
    const report = await reconcilePoints(requireBindings(context.env).DB);
    return context.json({ data: report, meta: { requestId } });
  });

  app.post(
    "/api/reconciliation/run",
    sessionMiddleware,
    adminMiddleware,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        body = null;
      }
      if (
        typeof body !== "object" ||
        body === null ||
        Array.isArray(body) ||
        typeof (body as { reason?: unknown }).reason !== "string" ||
        (body as { reason: string }).reason.trim().length === 0
      ) {
        return problem(
          context,
          422,
          "RECONCILIATION_REASON_REQUIRED",
          "Reconciliation reason required",
        );
      }
      try {
        const result = await runPointsReconciliation(requireBindings(context.env).DB, {
          actorPointsUserId: context.get("pointsUser").id,
          idempotencyKey: context.req.header("Idempotency-Key")!,
          reason: (body as { reason: string }).reason,
          requestId: `req_${crypto.randomUUID()}`,
        });
        return context.json(result.body, result.status);
      } catch (error) {
        if (error instanceof ReconciliationRunError) {
          return problem(context, 409, error.code, "Reconciliation request conflict");
        }
        throw error;
      }
    },
  );
}
