import type { Hono } from "hono";

import { readPublicPointPackageRevision } from "../../usecases/read-public-point-package-revision";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

export function registerEvaluationRoutes(app: Hono<BackendContext>) {
  app.get("/api/v1/point-package-revisions/:pointPackageRevisionId", async (context) => {
    try {
      const { canonicalBytes: _, ...revision } = await readPublicPointPackageRevision(
        requireBindings(context.env).DB,
        context.req.param("pointPackageRevisionId"),
      );
      return context.json({
        data: revision,
        meta: { requestId: `req_${crypto.randomUUID()}` },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "POINT_PACKAGE_REVISION_NOT_FOUND") {
        return problem(context, 404, error.message, "Point Package revision not found");
      }
      throw error;
    }
  });
}
