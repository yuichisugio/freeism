import type { Hono } from "hono";

import { getProfile, parseProfileUpdateBody, updateProfile } from "../../usecases/update-profile";
import { updateProfilePointPackagesIdempotently } from "../../usecases/update-profile-point-packages";
import {
  getProfileEvaluationVisibility,
  isEvaluationVisibilityExpansion,
  updateProfileEvaluationVisibilityIdempotently,
  type EvaluationVisibilityDto,
} from "../../usecases/update-profile-evaluation-visibility";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { idempotencyKeyMiddleware, profileBodyLimit } from "../middleware/idempotency-middleware";
import { findFreshGoogleAccountId } from "../middleware/google-fresh-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

export function registerProfileRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const sessionMiddleware = createSessionMiddleware(getSession);

  app.get("/api/profile", sessionMiddleware, async (context) => {
    const profile = await getProfile(requireBindings(context.env).DB, context.get("pointsUser").id);
    return context.json({
      data: profile,
      meta: { requestId: `req_${crypto.randomUUID()}` },
    });
  });

  app.put(
    "/api/profile",
    profileBodyLimit,
    sessionMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      let rawBody: unknown;
      try {
        rawBody = await context.req.json();
      } catch {
        return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
      }

      let body;
      try {
        body = parseProfileUpdateBody(rawBody);
      } catch {
        return problem(context, 422, "INVALID_PROFILE", "Invalid profile");
      }

      try {
        const result = await updateProfile(requireBindings(context.env).DB, {
          actorPointsUserId: context.get("pointsUser").id,
          body,
          idempotencyKey: context.req.header("Idempotency-Key")!,
          requestId: `req_${crypto.randomUUID()}`,
        });
        return context.json(result.body, result.status as 200);
      } catch (error) {
        if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") {
          return problem(context, 409, error.message, "Idempotency key reused");
        }
        throw error;
      }
    },
  );

  app.put(
    "/api/profile/point-packages",
    profileBodyLimit,
    sessionMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
      }
      const pointPackageIds =
        body && typeof body === "object"
          ? (body as { pointPackageIds?: unknown }).pointPackageIds
          : null;
      if (
        !Array.isArray(pointPackageIds) ||
        !pointPackageIds.every((pointPackageId) => typeof pointPackageId === "string")
      ) {
        return problem(context, 422, "INVALID_POINT_PACKAGES", "Invalid Point Package list");
      }
      try {
        const result = await updateProfilePointPackagesIdempotently(
          requireBindings(context.env).DB,
          {
            pointsUserId: context.get("pointsUser").id,
            pointPackageIds,
            idempotencyKey: context.req.header("Idempotency-Key")!,
            requestId: `req_${crypto.randomUUID()}`,
          },
        );
        return context.json(result.body, result.status as 200);
      } catch (error) {
        if (error instanceof Error && error.message === "DUPLICATE_POINT_PACKAGE") {
          return problem(context, 422, error.message, "Duplicate Point Package");
        }
        if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") {
          return problem(context, 409, error.message, "Idempotency key reused");
        }
        throw error;
      }
    },
  );

  app.put(
    "/api/profile/evaluation-visibilities/:evaluationCriterionId",
    profileBodyLimit,
    sessionMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      let rawBody: unknown;
      try {
        rawBody = await context.req.json();
      } catch {
        return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
      }
      if (!rawBody || typeof rawBody !== "object") {
        return problem(context, 422, "INVALID_EVALUATION_VISIBILITY", "Invalid visibility");
      }
      const body = rawBody as Record<string, unknown>;
      const wireKeys = [
        "balanceVisibility",
        "evaluationTotalVisibility",
        "fixHistoryVisibility",
        "transferHistoryVisibility",
        "exchangeHistoryVisibility",
      ] as const;
      if (
        !wireKeys.every((key) => body[key] === "PUBLIC" || body[key] === "PRIVATE") ||
        Object.keys(body).some((key) => !wireKeys.includes(key as (typeof wireKeys)[number]))
      ) {
        return problem(context, 422, "INVALID_EVALUATION_VISIBILITY", "Invalid visibility");
      }

      const database = requireBindings(context.env).DB;
      const evaluationCriterionId = context.req.param("evaluationCriterionId");
      const criterion = await database
        .prepare(
          `SELECT revision.balance_visible_by_default AS balanceVisibleByDefault
           FROM evaluation_criterion criterion
           JOIN evaluation_criterion_revision revision ON revision.id = criterion.current_revision_id
           WHERE criterion.id = ?`,
        )
        .bind(evaluationCriterionId)
        .first<{ balanceVisibleByDefault: number }>();
      if (!criterion) {
        return problem(
          context,
          404,
          "EVALUATION_CRITERION_NOT_FOUND",
          "Evaluation criterion not found",
        );
      }

      const pointsUserId = context.get("pointsUser").id;
      const balanceVisibleByDefault = criterion.balanceVisibleByDefault === 1;
      const previous = await getProfileEvaluationVisibility(database, {
        pointsUserId,
        evaluationCriterionId,
        balanceVisibleByDefault,
      });
      const next: EvaluationVisibilityDto = {
        balance: body.balanceVisibility as EvaluationVisibilityDto["balance"],
        evaluationTotal:
          body.evaluationTotalVisibility as EvaluationVisibilityDto["evaluationTotal"],
        fix: body.fixHistoryVisibility as EvaluationVisibilityDto["fix"],
        transfer: body.transferHistoryVisibility as EvaluationVisibilityDto["transfer"],
        exchange: body.exchangeHistoryVisibility as EvaluationVisibilityDto["exchange"],
      };
      let allowPublicExpansion = false;
      if (isEvaluationVisibilityExpansion(previous, next)) {
        const googleAccountId = await findFreshGoogleAccountId(
          context.env,
          context.get("authSession").session,
        );
        if (googleAccountId) {
          context.set("googleAccountId", googleAccountId);
          allowPublicExpansion = true;
        }
      }
      let result;
      try {
        result = await updateProfileEvaluationVisibilityIdempotently(database, {
          pointsUserId,
          evaluationCriterionId,
          visibility: next,
          balanceVisibleByDefault,
          allowPublicExpansion,
          idempotencyKey: context.req.header("Idempotency-Key")!,
          requestId: `req_${crypto.randomUUID()}`,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "FRESH_GOOGLE_AUTH_REQUIRED") {
          return problem(context, 401, error.message, "Fresh Google auth required");
        }
        if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") {
          return problem(context, 409, error.message, "Idempotency key reused");
        }
        throw error;
      }
      return context.json(result.body, result.status as 200);
    },
  );
}
