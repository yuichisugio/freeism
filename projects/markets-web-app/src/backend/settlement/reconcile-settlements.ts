export type ReconciliationResult = {
  action:
    | "ALREADY_TERMINAL"
    | "FORWARD_FINALIZE"
    | "MANUAL_ACTION_REQUIRED"
    | "PRE_CAPTURE_RELEASE";
  settlementId: string;
};

export interface ReconciliationReservationStatus {
  reservationKey: string;
  status: "ACTIVE" | "CAPTURED" | "EXPIRED" | "RELEASED";
}

export interface SettlementReconciliationDependencies {
  db: D1Database;
  finalizeCaptured(settlementId: string): Promise<unknown>;
  getStatuses(
    reservationKeys: readonly string[],
  ): Promise<readonly ReconciliationReservationStatus[]>;
  hasCaptureReceipt(settlementId: string): Promise<boolean>;
  now(): Date;
  releaseBeforeCapture(
    settlementId: string,
    statuses: readonly ReconciliationReservationStatus[],
  ): Promise<unknown>;
}

interface ReconciliationRow {
  buyNowHoldStatus: string | null;
  kind: "BUY_NOW" | "END_OF_AUCTION";
  sagaState: string;
  settlementId: string;
}

async function markManualAction(
  dependencies: SettlementReconciliationDependencies,
  settlementId: string,
) {
  await dependencies.db
    .prepare(
      `UPDATE settlements SET saga_state = 'MANUAL_ACTION_REQUIRED', updated_at = ?
       WHERE id = ? AND saga_state != 'SETTLED'
         AND NOT EXISTS (
           SELECT 1 FROM settlement_capture_receipts c WHERE c.settlement_id = settlements.id
         )`,
    )
    .bind(dependencies.now().toISOString(), settlementId)
    .run();
}

async function forwardCapturedOrRequireManual(
  dependencies: SettlementReconciliationDependencies,
  settlementId: string,
): Promise<ReconciliationResult> {
  if (!(await dependencies.hasCaptureReceipt(settlementId))) {
    await markManualAction(dependencies, settlementId);
    return { action: "MANUAL_ACTION_REQUIRED", settlementId };
  }
  await dependencies.db
    .prepare(
      `UPDATE settlements SET saga_state = 'CAPTURED', updated_at = ?
       WHERE id = ? AND saga_state NOT IN ('CAPTURED', 'FINALIZING', 'SETTLED')`,
    )
    .bind(dependencies.now().toISOString(), settlementId)
    .run();
  await dependencies.finalizeCaptured(settlementId);
  return { action: "FORWARD_FINALIZE", settlementId };
}

export async function reconcileSettlement(
  dependencies: SettlementReconciliationDependencies,
  settlementId: string,
): Promise<ReconciliationResult> {
  const row = await dependencies.db
    .prepare(
      `SELECT s.id AS settlementId, s.kind, s.saga_state AS sagaState,
              (SELECT h.status FROM buy_now_holds h
               JOIN settlement_plans p ON p.id = s.current_plan_id
               WHERE h.id = json_extract(p.plan_json, '$.buyNowHoldId')
                 AND h.auction_id = s.auction_id) AS buyNowHoldStatus
       FROM settlements s WHERE s.id = ?`,
    )
    .bind(settlementId)
    .first<ReconciliationRow>();
  if (!row) throw new Error("SETTLEMENT_NOT_FOUND");
  if (row.sagaState === "SETTLED") return { action: "ALREADY_TERMINAL", settlementId };
  if (
    row.kind === "BUY_NOW" &&
    (row.buyNowHoldStatus === "FAILED_RESTORED" || row.buyNowHoldStatus === "SETTLED")
  ) {
    await dependencies.db
      .prepare(
        `UPDATE settlements SET saga_state = 'SETTLED', updated_at = ?
         WHERE id = ? AND kind = 'BUY_NOW' AND saga_state != 'SETTLED'
           AND EXISTS (
             SELECT 1 FROM settlement_plans p
             JOIN buy_now_holds h ON h.id = json_extract(p.plan_json, '$.buyNowHoldId')
             WHERE p.id = settlements.current_plan_id
               AND h.auction_id = settlements.auction_id
               AND h.status IN ('FAILED_RESTORED', 'SETTLED')
           )`,
      )
      .bind(dependencies.now().toISOString(), settlementId)
      .run();
    return { action: "ALREADY_TERMINAL", settlementId };
  }

  if (row.sagaState === "CAPTURED" || row.sagaState === "FINALIZING") {
    return forwardCapturedOrRequireManual(dependencies, settlementId);
  }

  const reservationKeys = (
    await dependencies.db
      .prepare(
        `SELECT w.reservation_key AS reservationKey
       FROM settlement_round_winners w
       JOIN settlement_rounds r ON r.id = w.settlement_round_id
       WHERE r.settlement_id = ? ORDER BY w.reservation_key`,
      )
      .bind(settlementId)
      .all<{ reservationKey: string }>()
  ).results.map((item) => item.reservationKey);

  if (reservationKeys.length === 0 || row.sagaState === "MANUAL_ACTION_REQUIRED") {
    if (reservationKeys.length > 0) {
      const statuses = await dependencies.getStatuses(reservationKeys);
      if (
        statuses.length === reservationKeys.length &&
        statuses.every((item) => item.status === "CAPTURED")
      ) {
        return forwardCapturedOrRequireManual(dependencies, settlementId);
      }
    }
    return { action: "MANUAL_ACTION_REQUIRED", settlementId };
  }

  const statuses = await dependencies.getStatuses(reservationKeys);
  if (statuses.some((item) => item.status === "CAPTURED")) {
    return forwardCapturedOrRequireManual(dependencies, settlementId);
  }
  await dependencies.releaseBeforeCapture(settlementId, statuses);
  const verifiedStatuses = await dependencies.getStatuses(reservationKeys);
  if (verifiedStatuses.some((item) => item.status === "CAPTURED")) {
    return forwardCapturedOrRequireManual(dependencies, settlementId);
  }
  await markManualAction(dependencies, settlementId);
  return { action: "MANUAL_ACTION_REQUIRED", settlementId };
}

export async function reconcilePendingSettlements(
  dependencies: SettlementReconciliationDependencies,
  limit = 25,
) {
  const rows = await dependencies.db
    .prepare(
      `SELECT id FROM settlements WHERE saga_state <> 'SETTLED'
     ORDER BY updated_at LIMIT ?`,
    )
    .bind(limit)
    .all<{ id: string }>();
  const results: ReconciliationResult[] = [];
  for (const row of rows.results) results.push(await reconcileSettlement(dependencies, row.id));
  return results;
}
