export interface ChangeAdminMembershipInput {
  action: "ADD" | "DELETE";
  actorPointsUserId: string;
  auditEventId: string;
  membershipId?: string;
  reason: string;
  requestId: string;
  targetPointsUserId: string;
}

export async function changeAdminMembership(
  db: D1Database,
  input: ChangeAdminMembershipInput,
): Promise<void> {
  if (input.reason.trim().length === 0) {
    throw new Error("ADMIN_REASON_REQUIRED");
  }

  if (input.action === "ADD") {
    const membershipId = input.membershipId ?? `adm_${crypto.randomUUID()}`;
    const [auditResult, membershipResult] = await db.batch([
      db
        .prepare(
          `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, reason, request_id, result)
           SELECT ?, ?, 'ADMIN_MEMBERSHIP_ADD', ?, ?, ?, 'SUCCESS'
           WHERE EXISTS (
             SELECT 1 FROM admin_membership WHERE points_user_id = ?
           )
           AND (SELECT COUNT(*) FROM admin_membership) < 50
           AND NOT EXISTS (
             SELECT 1 FROM admin_membership WHERE points_user_id = ?
           )`,
        )
        .bind(
          input.auditEventId,
          input.actorPointsUserId,
          input.targetPointsUserId,
          input.reason.trim(),
          input.requestId,
          input.actorPointsUserId,
          input.targetPointsUserId,
        ),
      db
        .prepare(
          `INSERT INTO admin_membership (id, points_user_id, role)
           SELECT ?, ?, 'ADMIN'
           WHERE EXISTS (
             SELECT 1 FROM admin_membership WHERE points_user_id = ?
           )
           AND (SELECT COUNT(*) FROM admin_membership) < 50
           AND NOT EXISTS (
             SELECT 1 FROM admin_membership WHERE points_user_id = ?
           )`,
        )
        .bind(
          membershipId,
          input.targetPointsUserId,
          input.actorPointsUserId,
          input.targetPointsUserId,
        ),
    ]);
    if (
      !auditResult ||
      !membershipResult ||
      auditResult.meta.changes !== 1 ||
      membershipResult.meta.changes !== 1
    ) {
      throw new Error("ADMIN_LIMIT_OR_DUPLICATE");
    }
  } else {
    const [auditResult, membershipResult] = await db.batch([
      db
        .prepare(
          `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, reason, request_id, result)
           SELECT ?, ?, 'ADMIN_MEMBERSHIP_DELETE', ?, ?, ?, 'SUCCESS'
           WHERE EXISTS (
             SELECT 1 FROM admin_membership WHERE points_user_id = ?
           )
           AND EXISTS (
             SELECT 1 FROM admin_membership WHERE points_user_id = ?
           )
           AND (SELECT COUNT(*) FROM admin_membership) > 1`,
        )
        .bind(
          input.auditEventId,
          input.actorPointsUserId,
          input.targetPointsUserId,
          input.reason.trim(),
          input.requestId,
          input.actorPointsUserId,
          input.targetPointsUserId,
        ),
      db
        .prepare(
          `DELETE FROM admin_membership
           WHERE points_user_id = ?
           AND EXISTS (
             SELECT 1 FROM admin_membership WHERE points_user_id = ?
           )
           AND (SELECT COUNT(*) FROM admin_membership) > 1`,
        )
        .bind(input.targetPointsUserId, input.actorPointsUserId),
    ]);
    if (
      !auditResult ||
      !membershipResult ||
      auditResult.meta.changes !== 1 ||
      membershipResult.meta.changes !== 1
    ) {
      throw new Error("LAST_ADMIN_REQUIRED");
    }
  }
}
