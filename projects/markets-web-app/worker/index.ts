import { Hono } from "hono";

import { marketsBackendApp } from "../src/backend/app";
import { withSecurityHeaders } from "./security-headers";
import { isSpaNavigationRequest } from "./spa-fallback";

export { AuctionRoom } from "../src/backend/auction/auction-room";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (context, next) => {
  await next();
  context.res = withSecurityHeaders(
    context.res,
    context.env,
    context.res.headers.get("Cache-Control") ?? "no-store",
  );
});

app.route("/", marketsBackendApp);

app.get("/api/health", (context) =>
  withSecurityHeaders(
    context.json({ service: "auction-worker", status: "ok" }),
    context.env,
    "no-store",
  ),
);

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

export function fetchMarketsApi(request: Request, env: Env) {
  return app.fetch(request, env);
}

export default {
  fetch(request, env, _context) {
    return fetchMarketsApi(request, env);
  },
} satisfies ExportedHandler<Env>;
