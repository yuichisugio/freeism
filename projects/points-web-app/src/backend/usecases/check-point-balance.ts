import { calculatePointReservationVector } from "../domain/reservation/point-reservation";
import { readPersistedPointPackageRevision } from "../infrastructure/db/d1-evaluation-repository";

export async function checkPointBalance(
  db: D1Database,
  input: {
    now?: Date;
    pointPackageRevisionId: string;
    pointsUserId: string;
    priceTicks: number;
    quantity: number;
  },
) {
  const revision = await readPersistedPointPackageRevision(db, input.pointPackageRevisionId);
  if (!revision) throw new Error("POINT_PACKAGE_REVISION_NOT_FOUND");
  const vector = await calculatePointReservationVector(revision, input.priceTicks, input.quantity);
  const checkedAt = input.now ?? new Date();
  const components = [];
  for (const component of vector.components) {
    const row = await db
      .prepare(
        `SELECT COALESCE(account.balance, 0) - COALESCE(reserved.amount, 0) AS availableBalance
         FROM (SELECT 1) singleton
         LEFT JOIN point_account account
           ON account.points_user_id = ? AND account.evaluation_criterion_id = ?
         LEFT JOIN (
           SELECT SUM(component.amount_scaled) AS amount
           FROM point_reservation reservation
           JOIN point_reservation_state state ON state.point_reservation_id = reservation.id
           JOIN point_reservation_component component
             ON component.point_reservation_id = reservation.id
           WHERE reservation.points_user_id = ?
             AND component.evaluation_criterion_id = ?
             AND state.status = 'ACTIVE' AND reservation.expires_at > ?
         ) reserved ON 1 = 1`,
      )
      .bind(
        input.pointsUserId,
        component.evaluationCriterionId,
        input.pointsUserId,
        component.evaluationCriterionId,
        checkedAt.getTime(),
      )
      .first<{ availableBalance: number }>();
    const availableBalance = row?.availableBalance ?? 0;
    if (!Number.isSafeInteger(availableBalance)) throw new Error("SAFE_INTEGER_OVERFLOW");
    components.push({
      availableBalanceScaled: String(availableBalance),
      evaluationCriterionId: component.evaluationCriterionId,
      evaluationCriterionRevisionId: component.evaluationCriterionRevisionId,
      requiredAmountScaled: String(component.amountScaled),
      sufficient: availableBalance >= component.amountScaled,
    });
  }
  return {
    canReserve: components.every(({ sufficient }) => sufficient),
    checkedAt,
    components,
    pointPackageRevisionId: input.pointPackageRevisionId,
    priceTicks: input.priceTicks,
    quantity: input.quantity,
    vectorHash: vector.vectorHash,
  };
}
