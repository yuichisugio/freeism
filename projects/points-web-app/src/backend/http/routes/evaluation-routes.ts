import type { Hono } from "hono";

import { sha256Hex } from "../../csv/csv-validation-result";
import { readPublicPointPackageRevision } from "../../usecases/read-public-point-package-revision";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

const PUBLIC_REVISION_CACHE = "public, max-age=31536000, immutable";
const PRIVATE_NO_STORE = "private, no-store";

export function registerEvaluationRoutes(app: Hono<BackendContext>) {
  app.get("/api/v1/point-package-revisions/:pointPackageRevisionId", async (context) => {
    try {
      const { canonicalBytes, ...revision } = await readPublicPointPackageRevision(
        requireBindings(context.env).DB,
        context.req.param("pointPackageRevisionId"),
      );
      const verifiedHash = `sha256:${await sha256Hex(canonicalBytes)}`;
      if (verifiedHash !== revision.contentHash) {
        return context.json(
          {
            code: "INTERNAL_ERROR",
            requestId: `req_${crypto.randomUUID()}`,
            status: 500,
            title: "Point Package revision integrity check failed",
            type: "https://points.freeism.app/problems/internal-error",
          },
          500,
          { "Cache-Control": PRIVATE_NO_STORE, "Content-Type": "application/problem+json" },
        );
      }

      const etag = `"${revision.contentHash}"`;
      const headers = { "Cache-Control": PUBLIC_REVISION_CACHE, ETag: etag };
      if (context.req.header("If-None-Match")?.trim() === etag) {
        return new Response(null, { headers, status: 304 });
      }
      return context.json(
        {
          data: revision,
          meta: { requestId: `req_${crypto.randomUUID()}` },
        },
        200,
        headers,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "POINT_PACKAGE_REVISION_NOT_FOUND") {
        const response = problem(context, 404, "RESOURCE_NOT_FOUND", "Resource not found");
        response.headers.set("Cache-Control", PRIVATE_NO_STORE);
        return response;
      }
      throw error;
    }
  });
}
