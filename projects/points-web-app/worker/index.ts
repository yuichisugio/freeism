import { Hono } from "hono";

import { pointsBackendApp } from "../src/backend/app";
import {
  inspectPointsOpsAlerts,
  monitorOpsAlerts,
} from "../src/backend/observability/monitor-ops-alerts";
import type { OpsAlertRecord } from "../src/backend/observability/ops-alert-repository";
import { emitOpsMetric, hashOpsResourceId } from "../src/backend/observability/ops-metrics";
import { writeStructuredLog } from "../src/backend/observability/structured-logger";
import { cleanupResolvedOpsAlerts } from "../src/backend/observability/cleanup-ops-alerts";
import { cleanupExpiredCsvExports } from "../src/backend/usecases/cleanup-expired-csv-exports";
import { reapExpiredPointsLinkAttempts } from "../src/backend/usecases/reap-expired-points-link-attempts";
import { runDueWebRevalidations } from "../src/backend/usecases/run-due-web-revalidations";
import { withSecurityHeaders } from "./security-headers";
import { isSpaNavigationRequest } from "./spa-fallback";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (context, next) => {
  await next();
  context.res = withSecurityHeaders(
    context.res,
    context.env,
    context.res.headers.get("Cache-Control") ?? "no-store",
  );
});

app.route("/", pointsBackendApp);

app.get("/api/health", (context) => context.json({ service: "points-worker", status: "ok" }));

app.notFound(async (context) => {
  const request = context.req.raw;
  if (isSpaNavigationRequest(request)) {
    const shellUrl = new URL("/", request.url);
    const shellResponse = await context.env.ASSETS.fetch(
      new Request(shellUrl, { headers: request.headers, method: "GET" }),
    );
    const response = withSecurityHeaders(shellResponse, context.env);
    if (request.method === "HEAD") {
      return new Response(null, response);
    }
    return response;
  }

  const problem = context.json(
    {
      code: "ROUTE_NOT_FOUND",
      status: 404,
      title: "Not Found",
      type: "about:blank",
    },
    404,
    { "Content-Type": "application/problem+json" },
  );
  return withSecurityHeaders(problem, context.env, "no-store");
});

export function fetchPointsApi(request: Request, env: Env) {
  return app.fetch(request, env);
}

async function notifyOpsAlert(env: Env, alert: OpsAlertRecord): Promise<void> {
  await env.OPS_ALERT_EMAIL.send({
    from: env.OPS_ALERT_FROM,
    subject: `[Points] ${alert.status}: ${alert.type}`,
    text: JSON.stringify({
      alertKey: alert.alertKey,
      resourceIdHash: alert.resourceIdHash,
      safeDetailCode: alert.safeDetailCode,
      status: alert.status,
      type: alert.type,
    }),
    to: env.OPS_ALERT_TO,
  });
}

async function runCronJobs(env: Env, cron: string, jobs: Array<() => Promise<unknown>>) {
  const startedAt = Date.now();
  const results = await Promise.allSettled(jobs.map((job) => job()));
  for (const [index, result] of results.entries()) {
    const outcome = result.status === "fulfilled" ? "SUCCEEDED" : "FAILED";
    const resourceIdHash = await hashOpsResourceId(`${cron}:${index}`, env.OPS_RESOURCE_HASH_SALT);
    writeStructuredLog({
      app: "points",
      code: result.status === "fulfilled" ? "CRON_JOB_OK" : "CRON_JOB_FAILED",
      durationMs: Date.now() - startedAt,
      environment: env.APP_ENV,
      event: "cron_job",
      level: result.status === "fulfilled" ? "info" : "error",
      operation: cron,
      outcome,
      resourceIdHash,
    });
    emitOpsMetric(env.OPS_METRICS, {
      app: "points",
      attempt: 1,
      code: result.status === "fulfilled" ? "CRON_JOB_OK" : "CRON_JOB_FAILED",
      count: 1,
      durationMs: Date.now() - startedAt,
      environment: env.APP_ENV,
      event: "cron_job",
      lagSeconds: 0,
      outcome,
      resourceIdHash,
      resourceState: cron,
    });
  }
}

export async function scheduledPoints(controller: ScheduledController, env: Env) {
  if (env.DB === undefined) throw new Error("Points D1 binding DB is required");
  const cron = controller.cron ?? "*/5 * * * *";
  if (cron === "*/5 * * * *") {
    await runCronJobs(env, cron, [
      () =>
        monitorOpsAlerts(env.DB!, {
          inspect: (db, now) => inspectPointsOpsAlerts(db, now, env.OPS_RESOURCE_HASH_SALT),
          notify: (alert) => notifyOpsAlert(env, alert),
        }),
      () => cleanupExpiredCsvExports(env.DB!),
      () => cleanupResolvedOpsAlerts(env.DB!),
    ]);
  }
  if (cron === "*/15 * * * *") {
    await runCronJobs(env, cron, [
      () => runDueWebRevalidations(env.DB!),
      () => reapExpiredPointsLinkAttempts(env.DB!),
    ]);
  }
}

export default {
  fetch(request, env, _context) {
    return fetchPointsApi(request, env);
  },
  scheduled(controller, env, _context) {
    return scheduledPoints(controller, env);
  },
} satisfies ExportedHandler<Env>;
