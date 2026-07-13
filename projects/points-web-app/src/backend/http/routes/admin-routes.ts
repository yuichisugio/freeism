import type { Hono } from "hono";

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

export function registerAdminRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const sessionMiddleware = createSessionMiddleware(getSession);
  const path = "/api/admin/admin-memberships";

  app.get(path, sessionMiddleware, adminMiddleware, async (context) => {
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

  app.post(path, sessionMiddleware, adminMiddleware, googleFreshMiddleware, async (context) => {
    const body = await readMembershipBody(context.req.raw);
    if (!body) {
      return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
    }
    if (typeof body.reason !== "string" || body.reason.trim().length === 0) {
      return problem(context, 422, "ADMIN_REASON_REQUIRED", "Admin reason required");
    }
    if (typeof body.pointsUserId !== "string" || body.pointsUserId.length === 0) {
      return problem(context, 422, "POINTS_USER_ID_REQUIRED", "Points user ID required");
    }

    const requestId = `req_${crypto.randomUUID()}`;
    await changeAdminMembership(requireBindings(context.env).DB, {
      action: "ADD",
      actorPointsUserId: context.get("pointsUser").id,
      auditEventId: `audit_${crypto.randomUUID()}`,
      membershipId: `adm_${crypto.randomUUID()}`,
      reason: body.reason,
      requestId,
      targetPointsUserId: body.pointsUserId,
    });
    return context.json(
      {
        data: { pointsUserId: body.pointsUserId, role: "ADMIN" },
        meta: { requestId },
      },
      201,
    );
  });

  app.delete(
    `${path}/:pointsUserId`,
    sessionMiddleware,
    adminMiddleware,
    googleFreshMiddleware,
    async (context) => {
      const body = await readMembershipBody(context.req.raw);
      if (!body) {
        return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
      }
      if (typeof body.reason !== "string" || body.reason.trim().length === 0) {
        return problem(context, 422, "ADMIN_REASON_REQUIRED", "Admin reason required");
      }

      await changeAdminMembership(requireBindings(context.env).DB, {
        action: "DELETE",
        actorPointsUserId: context.get("pointsUser").id,
        auditEventId: `audit_${crypto.randomUUID()}`,
        reason: body.reason,
        requestId: `req_${crypto.randomUUID()}`,
        targetPointsUserId: context.req.param("pointsUserId"),
      });
      return context.body(null, 204);
    },
  );
}
