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
  now(): Date;
  releaseBeforeCapture(
    settlementId: string,
    statuses: readonly ReconciliationReservationStatus[],
  ): Promise<unknown>;
}

interface ReconciliationRow {
  kind: "BUY_NOW" | "END_OF_AUCTION";
  sagaState: string;
  settlementId: string;
}

export async function reconcileSettlement(
  dependencies: SettlementReconciliationDependencies,
  settlementId: string,
): Promise<ReconciliationResult> {
  const row = await dependencies.db
    .prepare(
      `SELECT id AS settlementId, kind, saga_state AS sagaState
     FROM settlements WHERE id = ?`,
    )
    .bind(settlementId)
    .first<ReconciliationRow>();
  if (!row) throw new Error("SETTLEMENT_NOT_FOUND");
  if (row.sagaState === "SETTLED") return { action: "ALREADY_TERMINAL", settlementId };

  if (row.sagaState === "CAPTURED" || row.sagaState === "FINALIZING") {
    await dependencies.finalizeCaptured(settlementId);
    return { action: "FORWARD_FINALIZE", settlementId };
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
        await dependencies.db
          .prepare(
            `UPDATE settlements SET saga_state = 'CAPTURED', updated_at = ?
           WHERE id = ? AND saga_state = 'MANUAL_ACTION_REQUIRED'`,
          )
          .bind(dependencies.now().toISOString(), settlementId)
          .run();
        await dependencies.finalizeCaptured(settlementId);
        return { action: "FORWARD_FINALIZE", settlementId };
      }
    }
    return { action: "MANUAL_ACTION_REQUIRED", settlementId };
  }

  const statuses = await dependencies.getStatuses(reservationKeys);
  if (statuses.some((item) => item.status === "CAPTURED")) {
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
  await dependencies.releaseBeforeCapture(settlementId, statuses);
  return { action: "PRE_CAPTURE_RELEASE", settlementId };
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
