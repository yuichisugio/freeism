import { env } from "cloudflare:workers";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { fetchPointsApi, scheduledPoints } from "../worker/index";
import { isSpaNavigationRequest } from "../worker/spa-fallback";

const FIXED_PAGE_PATHS = new Set([
  "/",
  "/terms",
  "/terms/",
  "/privacy",
  "/privacy/",
  "/help",
  "/help/",
  "/docs",
  "/docs/",
]);

const serverEntry = createServerEntry({
  fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const isGetOrHead = request.method === "GET" || request.method === "HEAD";
    if ((isGetOrHead && FIXED_PAGE_PATHS.has(pathname)) || isSpaNavigationRequest(request)) {
      return handler.fetch(request);
    }
    return fetchPointsApi(request, env);
  },
});

export default {
  fetch(request) {
    return serverEntry.fetch(request);
  },
  scheduled(controller, workerEnv, _context) {
    return scheduledPoints(controller, workerEnv);
  },
} satisfies ExportedHandler<Env>;
