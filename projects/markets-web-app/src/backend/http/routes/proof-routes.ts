import type { Hono } from "hono";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { createReviewRevision } from "../../proof/create-review-revision";
import { readPublicProof } from "../../proof/read-public-proof";
import { readProofReviewRevisions, readProofReviews } from "../../proof/read-proof-reviews";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problemDetails } from "../problem-details";

const IMMUTABLE_PROOF_CACHE = "public, max-age=31536000, immutable";
const REVIEW_CACHE = "public, max-age=60, stale-while-revalidate=300";

function reviewResponseHeaders(contentHash: string) {
  return { "Cache-Control": REVIEW_CACHE, ETag: `"${contentHash}"` };
}

export function registerProofRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  app.get("/api/v1/proofs/:proofId", async (context) => {
    try {
      const env = requireBindings(context.env);
      const proof = await readPublicProof(env.DB, env.APP_ORIGIN, context.req.param("proofId"));
      return context.json({ data: proof }, 200, {
        "Cache-Control": IMMUTABLE_PROOF_CACHE,
        ETag: `"${proof.contentHash}"`,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PROOF_NOT_FOUND") {
        return problemDetails(context, 404, "PROOF_NOT_FOUND", "Proof not found");
      }
      throw error;
    }
  });

  app.get("/api/v1/proofs/:proofId/reviews", async (context) => {
    try {
      const result = await readProofReviews(
        requireBindings(context.env).DB,
        context.req.param("proofId"),
      );
      return context.json({ data: result.data }, 200, reviewResponseHeaders(result.contentHash));
    } catch (error) {
      if (error instanceof Error && error.message === "PROOF_NOT_FOUND") {
        return problemDetails(context, 404, "PROOF_NOT_FOUND", "Proof not found");
      }
      throw error;
    }
  });

  app.get("/api/v1/proofs/:proofId/review-revisions", async (context) => {
    try {
      const limitValue = context.req.query("limit");
      const limit = limitValue === undefined ? 20 : Number(limitValue);
      const result = await readProofReviewRevisions(requireBindings(context.env).DB, {
        cursor: context.req.query("cursor"),
        limit,
        proofId: context.req.param("proofId"),
      });
      return context.json({ data: result.data }, 200, reviewResponseHeaders(result.contentHash));
    } catch (error) {
      const code = error instanceof Error ? error.message : "PROOF_REVIEW_READ_FAILED";
      if (code === "PROOF_NOT_FOUND") {
        return problemDetails(context, 404, code, "Proof not found");
      }
      if (code === "PROOF_REVIEW_CURSOR_INVALID" || code === "PROOF_REVIEW_LIMIT_INVALID") {
        return problemDetails(context, 400, code, "Review cursor invalid");
      }
      throw error;
    }
  });

  app.post("/api/v1/proofs/:proofId/review-revisions", async (context) => {
    const actor = await requireMarketsSession(context, getSession);
    if (!actor) {
      return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }
    const idempotencyKey = context.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return problemDetails(context, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key required");
    }
    if (idempotencyKey.length > 200) {
      return problemDetails(context, 400, "MALFORMED_REQUEST", "Idempotency-Key is too long");
    }
    try {
      const body = await context.req.json<{
        comment?: unknown;
        completionProofUrl?: unknown;
        rating?: unknown;
      }>();
      if (
        !(body.comment === undefined || typeof body.comment === "string") ||
        !(
          body.completionProofUrl === undefined ||
          body.completionProofUrl === null ||
          typeof body.completionProofUrl === "string"
        ) ||
        typeof body.rating !== "number"
      ) {
        return problemDetails(context, 400, "MALFORMED_REQUEST", "Invalid review input");
      }
      const env = requireBindings(context.env);
      const result = await createReviewRevision(
        { db: env.DB, now: () => new Date() },
        {
          actorMarketsUserId: actor.marketsUserId,
          comment: body.comment ?? "",
          completionProofUrl: body.completionProofUrl ?? null,
          environment: env.APP_ENV,
          idempotencyKey,
          proofId: context.req.param("proofId"),
          rating: body.rating,
          requestId: `req_${crypto.randomUUID()}`,
        },
      );
      return context.json({ data: result }, result.replayed ? 200 : 201, {
        "Cache-Control": "private, no-store",
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "PROOF_REVIEW_FAILED";
      if (code === "PROOF_NOT_FOUND") {
        return problemDetails(context, 404, code, "Proof not found");
      }
      if (code === "PROOF_REVIEW_FORBIDDEN") {
        return problemDetails(context, 403, code, "Review forbidden");
      }
      if (code === "IDEMPOTENCY_KEY_REUSED") {
        return problemDetails(context, 409, code, "Idempotency-Key reused");
      }
      return problemDetails(context, 422, code, "Review validation failed");
    }
  });
}
