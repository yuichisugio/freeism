import type { Context, Hono, MiddlewareHandler } from "hono";

import {
  freshOperationPolicies,
  type FreshOperationPolicy,
} from "../../auth/fresh-operation-policy";
import { changeAdminMembership } from "../../usecases/change-admin-membership";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { adminMiddleware } from "../middleware/admin-middleware";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

interface MembershipBody {
  pointsUserId?: unknown;
  reason?: unknown;
}

async function readMembershipBody(request: Request): Promise<MembershipBody | null> {
  try {
    return (await request.json()) as MembershipBody;
  } catch {
    return null;
  }
}

function requirePolicy(operation: string) {
  const policy = freshOperationPolicies.find((candidate) => candidate.operation === operation);
  if (!policy) {
    throw new Error(`FRESH_OPERATION_POLICY_MISSING:${operation}`);
  }
  return policy;
}

export const adminMembershipRoutePolicies = {
  add: requirePolicy("admin-membership-add"),
  delete: requirePolicy("admin-membership-delete"),
};

export function getAdminMembershipPolicyMiddlewares(
  policy: FreshOperationPolicy,
  sessionMiddleware: MiddlewareHandler<BackendContext>,
) {
  if (!policy.session || !policy.admin || !policy.fresh || !policy.reason) {
    throw new Error("ADMIN_MEMBERSHIP_POLICY_REQUIREMENTS_MISSING");
  }
  return [sessionMiddleware, adminMiddleware, googleFreshMiddleware] as const;
}

function mapAdminMembershipError(context: Context<BackendContext>, error: unknown): Response {
  if (!(error instanceof Error)) {
    throw error;
  }
  if (error.message === "ADMIN_LIMIT_OR_DUPLICATE") {
    return problem(context, 409, error.message, "Admin limit or duplicate membership");
  }
  if (error.message === "LAST_ADMIN_REQUIRED") {
    return problem(context, 409, error.message, "At least one administrator is required");
  }
  if (error.message === "ADMIN_REASON_REQUIRED") {
    return problem(context, 422, error.message, "Admin reason required");
  }
  throw error;
}

export function registerAdminRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const sessionMiddleware = createSessionMiddleware(getSession);
  const addPolicy = adminMembershipRoutePolicies.add;
  const deletePolicy = adminMembershipRoutePolicies.delete;
  const addMiddlewares = getAdminMembershipPolicyMiddlewares(addPolicy, sessionMiddleware);
  const deleteMiddlewares = getAdminMembershipPolicyMiddlewares(deletePolicy, sessionMiddleware);

  app.get(addPolicy.route, sessionMiddleware, adminMiddleware, async (context) => {
    const memberships = await requireBindings(context.env)
      .DB.prepare(
        `SELECT points_user_id AS pointsUserId, role
       FROM admin_membership
       ORDER BY created_at, id`,
      )
      .all<{ pointsUserId: string; role: "ADMIN" }>();
    return context.json({
      data: memberships.results,
      meta: { requestId: `req_${crypto.randomUUID()}` },
    });
  });

  app.post(addPolicy.route, ...addMiddlewares, async (context) => {
    const body = await readMembershipBody(context.req.raw);
    if (!body) {
      return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
    }
    if (addPolicy.reason && (typeof body.reason !== "string" || body.reason.trim().length === 0)) {
      return problem(context, 422, "ADMIN_REASON_REQUIRED", "Admin reason required");
    }
    if (typeof body.pointsUserId !== "string" || body.pointsUserId.length === 0) {
      return problem(context, 422, "POINTS_USER_ID_REQUIRED", "Points user ID required");
    }

    const requestId = `req_${crypto.randomUUID()}`;
    try {
      await changeAdminMembership(requireBindings(context.env).DB, {
        action: "ADD",
        actorPointsUserId: context.get("pointsUser").id,
        auditEventId: `audit_${crypto.randomUUID()}`,
        membershipId: `adm_${crypto.randomUUID()}`,
        reason: body.reason as string,
        requestId,
        targetPointsUserId: body.pointsUserId,
      });
    } catch (error) {
      return mapAdminMembershipError(context, error);
    }
    return context.json(
      {
        data: { pointsUserId: body.pointsUserId, role: "ADMIN" },
        meta: { requestId },
      },
      201,
    );
  });

  app.delete(deletePolicy.route, ...deleteMiddlewares, async (context) => {
    const body = await readMembershipBody(context.req.raw);
    if (!body) {
      return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
    }
    if (
      deletePolicy.reason &&
      (typeof body.reason !== "string" || body.reason.trim().length === 0)
    ) {
      return problem(context, 422, "ADMIN_REASON_REQUIRED", "Admin reason required");
    }

    try {
      await changeAdminMembership(requireBindings(context.env).DB, {
        action: "DELETE",
        actorPointsUserId: context.get("pointsUser").id,
        auditEventId: `audit_${crypto.randomUUID()}`,
        reason: body.reason as string,
        requestId: `req_${crypto.randomUUID()}`,
        targetPointsUserId: context.req.param("pointsUserId")!,
      });
    } catch (error) {
      return mapAdminMembershipError(context, error);
    }
    return context.body(null, 204);
  });
}
