import type { SettlementCaptureGateway } from "./capture-all-winners";

interface UnusedWinnerRow {
  planHash: string;
  pointReservationId: string;
  reservationKey: string;
}

export async function releaseUnusedReservations(
  dependencies: { db: D1Database; gateway: SettlementCaptureGateway; now(): Date },
  input: { captureReceiptId: string; planHash: string; settlementId: string },
): Promise<{ releasedReservationIds: readonly string[] }> {
  const captureJson = await dependencies.db
    .prepare(
      `SELECT reservations_json FROM settlement_capture_receipts
       WHERE capture_receipt_id = ? AND settlement_id = ? AND plan_hash = ?`,
    )
    .bind(input.captureReceiptId, input.settlementId, input.planHash)
    .first<string>("reservations_json");
  if (!captureJson) throw new Error("SETTLEMENT_CAPTURE_RECEIPT_NOT_FOUND");
  const capturedIds = new Set(
    (JSON.parse(captureJson) as { pointReservationId: string }[]).map(
      (item) => item.pointReservationId,
    ),
  );
  const candidates = await dependencies.db
    .prepare(
      `SELECT w.point_reservation_id AS pointReservationId,
              w.reservation_key AS reservationKey, r.plan_hash AS planHash
       FROM settlement_round_winners w
       JOIN settlement_rounds r ON r.id = w.settlement_round_id
       WHERE r.settlement_id = ? AND w.status = 'ACTIVE'
         AND w.point_reservation_id IS NOT NULL
       ORDER BY w.point_reservation_id`,
    )
    .bind(input.settlementId)
    .all<UnusedWinnerRow>();
  const unused = candidates.results.filter((winner) => !capturedIds.has(winner.pointReservationId));
  if (unused.length === 0) return { releasedReservationIds: [] };
  const statuses = await dependencies.gateway.statusByIds(
    unused.map((winner) => winner.pointReservationId),
  );
  const statusById = new Map(statuses.map((status) => [status.pointReservationId, status]));
  const releasedReservationIds: string[] = [];
  for (const winner of unused) {
    if (statusById.get(winner.pointReservationId)?.status !== "ACTIVE") continue;
    const receipt = await dependencies.gateway.release({
      planHash: winner.planHash,
      pointReservationId: winner.pointReservationId,
      reservationKey: winner.reservationKey,
    });
    await dependencies.db
      .prepare(
        `UPDATE settlement_round_winners
         SET status = 'RELEASED', release_receipt_id = ?, release_content_hash = ?,
             released_at = ?, updated_at = ?
         WHERE point_reservation_id = ? AND status = 'ACTIVE'`,
      )
      .bind(
        receipt.receiptId,
        receipt.contentHash,
        receipt.releasedAt,
        dependencies.now().toISOString(),
        winner.pointReservationId,
      )
      .run();
    releasedReservationIds.push(winner.pointReservationId);
  }
  return { releasedReservationIds };
}
