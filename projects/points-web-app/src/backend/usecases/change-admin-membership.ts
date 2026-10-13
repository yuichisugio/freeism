import { writeAuditLog } from "../observability/audit-logger";

export interface ChangeAdminMembershipInput {
  action: "ADD" | "DELETE";
  actorPointsUserId: string;
  environment?: string;
  membershipId?: string;
  reason: string;
  requestId: string;
  targetPointsUserId: string;
}

async function executeAdminMembershipChange(
  db: D1Database,
  input: ChangeAdminMembershipInput,
): Promise<void> {
  if (input.reason.trim().length === 0) {
    throw new Error("ADMIN_REASON_REQUIRED");
  }

  if (input.action === "ADD") {
    const membershipId = input.membershipId ?? `adm_${crypto.randomUUID()}`;
    const [membershipResult] = await db.batch([
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
    if (!membershipResult || membershipResult.meta.changes !== 1) {
      throw new Error("ADMIN_LIMIT_OR_DUPLICATE");
    }
  } else {
    const [membershipResult] = await db.batch([
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
    if (!membershipResult || membershipResult.meta.changes !== 1) {
      throw new Error("LAST_ADMIN_REQUIRED");
    }
  }
}

/** 管理者変更の確定結果だけを、個人情報を含めず監査ログへ記録する。 */
export async function changeAdminMembership(
  db: D1Database,
  input: ChangeAdminMembershipInput,
): Promise<void> {
  const action = input.action === "ADD" ? "ADMIN_MEMBERSHIP_ADD" : "ADMIN_MEMBERSHIP_DELETE";
  try {
    await executeAdminMembershipChange(db, input);
    writeAuditLog({
      action,
      environment: input.environment,
      requestId: input.requestId,
      resourceType: "admin_membership",
      affectedCount: 1,
    });
  } catch (error) {
    const knownCodes = ["ADMIN_REASON_REQUIRED", "ADMIN_LIMIT_OR_DUPLICATE", "LAST_ADMIN_REQUIRED"];
    const code =
      error instanceof Error && knownCodes.includes(error.message)
        ? error.message
        : "ADMIN_MEMBERSHIP_CHANGE_FAILED";
    writeAuditLog({
      action,
      environment: input.environment,
      requestId: input.requestId,
      resourceType: "admin_membership",
      outcome: "REJECTED",
      code,
    });
    throw error;
  }
}
