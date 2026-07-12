import { env } from "cloudflare:workers";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { fetchMarketsApi } from "../worker/index";
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

export default createServerEntry({
  fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const isGetOrHead = request.method === "GET" || request.method === "HEAD";
    if (
      url.hostname === "localhost" &&
      ((isGetOrHead && FIXED_PAGE_PATHS.has(pathname)) || isSpaNavigationRequest(request))
    ) {
      return handler.fetch(request);
    }
    return fetchMarketsApi(request, env);
  },
});
