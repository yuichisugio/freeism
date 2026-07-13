import { Hono } from "hono";

import { pointsBackendApp } from "../src/backend/app";
import { cleanupExpiredCsvExports } from "../src/backend/usecases/cleanup-expired-csv-exports";
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

export async function scheduledPoints(_controller: ScheduledController, env: Env) {
  if (env.DB === undefined) throw new Error("Points D1 binding DB is required");
  await Promise.all([runDueWebRevalidations(env.DB), cleanupExpiredCsvExports(env.DB)]);
}

export default {
  fetch(request, env, _context) {
    return fetchPointsApi(request, env);
  },
  scheduled(controller, env, _context) {
    return scheduledPoints(controller, env);
  },
} satisfies ExportedHandler<Env>;
