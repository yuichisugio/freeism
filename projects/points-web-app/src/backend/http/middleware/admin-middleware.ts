import { createMiddleware } from "hono/factory";

import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

export const adminMiddleware = createMiddleware<BackendContext>(async (context, next) => {
  const membership = await requireBindings(context.env)
    .DB.prepare(
      `SELECT role
     FROM admin_membership
     WHERE points_user_id = ? AND role = 'ADMIN'`,
    )
    .bind(context.get("pointsUser").id)
    .first<{ role: string }>();
  if (!membership) {
    return problem(context, 403, "ADMIN_REQUIRED", "Administrator permission required");
  }

  await next();
});
