import type { Hono } from "hono";

import { PublicResourceNotFoundError, readPublicProfile } from "../../usecases/read-public-profile";
import {
  readPublicEvaluationCriterion,
  readPublicPointPackage,
  searchPoints,
} from "../../usecases/search-points";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

const PUBLIC_REVALIDATE = "public, max-age=0, must-revalidate";
const PRIVATE_NO_STORE = "private, no-store";

function requestId() {
  return `req_${crypto.randomUUID()}`;
}

function notFound(context: Parameters<typeof problem>[0]) {
  const response = problem(context, 404, "RESOURCE_NOT_FOUND", "Resource not found");
  response.headers.set("Cache-Control", PRIVATE_NO_STORE);
  return response;
}

export function registerPublicRoutes(app: Hono<BackendContext>) {
  app.get("/api/v1/profiles/:pointsUserId", async (context) => {
    try {
      const data = await readPublicProfile(
        requireBindings(context.env).DB,
        context.req.param("pointsUserId"),
      );
      return context.json({ data, meta: { requestId: requestId() } }, 200, {
        "Cache-Control": PUBLIC_REVALIDATE,
      });
    } catch (error) {
      if (error instanceof PublicResourceNotFoundError) return notFound(context);
      throw error;
    }
  });

  app.get("/api/v1/search", async (context) => {
    const query = context.req.query("q")?.trim();
    if (!query || query.length > 100) {
      const response = problem(context, 422, "INVALID_SEARCH_QUERY", "Invalid search query");
      response.headers.set("Cache-Control", PRIVATE_NO_STORE);
      return response;
    }
    const data = await searchPoints(requireBindings(context.env).DB, query);
    return context.json({ data, meta: { requestId: requestId() } }, 200, {
      "Cache-Control": PUBLIC_REVALIDATE,
    });
  });

  app.get("/api/v1/evaluation-criteria/:evaluationCriterionId", async (context) => {
    try {
      const data = await readPublicEvaluationCriterion(
        requireBindings(context.env).DB,
        context.req.param("evaluationCriterionId"),
      );
      return context.json({ data, meta: { requestId: requestId() } }, 200, {
        "Cache-Control": PUBLIC_REVALIDATE,
      });
    } catch (error) {
      if (error instanceof PublicResourceNotFoundError) return notFound(context);
      throw error;
    }
  });

  app.get("/api/v1/point-packages/:pointPackageId", async (context) => {
    try {
      const data = await readPublicPointPackage(
        requireBindings(context.env).DB,
        context.req.param("pointPackageId"),
      );
      return context.json({ data, meta: { requestId: requestId() } }, 200, {
        "Cache-Control": PUBLIC_REVALIDATE,
      });
    } catch (error) {
      if (error instanceof PublicResourceNotFoundError) return notFound(context);
      throw error;
    }
  });
}
