import type { Hono } from "hono";

import { observeOpsAlert, resolveOpsAlert } from "../../observability/ops-alert-repository";
import { hashOpsResourceId } from "../../observability/ops-metrics";
import type { BackendContext } from "../context";

async function tokenMatches(actual: string | undefined, expected: string | undefined) {
  if (!actual || !expected) return false;
  const actualHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(actual));
  const expectedHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected));
  const left = new Uint8Array(actualHash);
  const right = new Uint8Array(expectedHash);
  return left.every((value, index) => value === right[index]);
}

export function registerOpsRoutes(app: Hono<BackendContext>) {
  app.post("/api/internal/ops-alert-drill", async (context) => {
    if (context.env.APP_ENV !== "staging") return context.notFound();
    const bearer = context.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!(await tokenMatches(bearer, context.env.POINTS_OPS_DRILL_TOKEN))) {
      return context.json({ code: "UNAUTHORIZED" }, 401);
    }
    const correlationId = context.req.header("X-Correlation-Id");
    if (!correlationId || correlationId.length > 128) {
      return context.json({ code: "INVALID_CORRELATION_ID" }, 400);
    }
    const body = await context.req.json<{ phase?: string }>().catch((): { phase?: string } => ({}));
    if (!body.phase || !["OPEN", "DEDUPE", "RESOLVED"].includes(body.phase)) {
      return context.json({ code: "INVALID_DRILL_PHASE" }, 400);
    }
    const alertKey = `ops-drill:${correlationId}`;
    const now = Date.now();
    const record =
      body.phase === "RESOLVED"
        ? await resolveOpsAlert(context.env.DB, alertKey, now)
        : await observeOpsAlert(
            context.env.DB,
            {
              alertKey,
              resourceIdHash: await hashOpsResourceId(
                correlationId,
                context.env.OPS_RESOURCE_HASH_SALT,
              ),
              safeDetailCode: "STAGING_DRILL",
              type: "REJECTION_AUDIT_FAILURE",
            },
            now,
          );
    if (!record) return context.json({ code: "DRILL_ALERT_NOT_OPEN" }, 409);
    return context.json({
      alertKey,
      correlationId,
      evidence: { repeatCount: record.repeatCount, storedStatus: record.status },
      status: body.phase,
    });
  });
}
