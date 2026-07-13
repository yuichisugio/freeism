import {
  chunkCanonicalJsonRows,
  prepareJsonEachStatements,
  runCsvAtomicBatch,
} from "../../csv/d1-json-chunks";

export interface StoredReservation {
  auctionId: string;
  components: Array<{
    amountScaled: number;
    evaluationCriterionId: string;
    evaluationCriterionRevisionId: string;
  }>;
  createdAt: Date;
  expiresAt: Date;
  idempotencyKey: string;
  leaseSeconds: number;
  marketsClientId: string;
  marketsUserId: string;
  payloadHash: string;
  planHash: string;
  pointPackageRevisionId: string;
  pointReservationId: string;
  pointsUserId: string;
  priceTicks: number;
  quantity: number;
  reservationKey: string;
  settlementId: string;
  status: "ACTIVE" | "CAPTURED" | "RELEASED" | "EXPIRED";
  terminalAt: Date | null;
  terminalReceiptId: string | null;
  vectorHash: string;
  version: number;
}

interface ReservationRow extends Omit<
  StoredReservation,
  "components" | "createdAt" | "expiresAt" | "terminalAt"
> {
  createdAt: number;
  expiresAt: number;
  terminalAt: number | null;
}

type ReservationComponentRow = StoredReservation["components"][number] & {
  pointReservationId: string;
};

const reservationSelect = `SELECT reservation.id AS pointReservationId,
       reservation.reservation_key AS reservationKey,
       reservation.idempotency_key AS idempotencyKey,
       reservation.payload_hash AS payloadHash,
       reservation.markets_client_id AS marketsClientId,
       reservation.markets_user_id AS marketsUserId,
       reservation.points_user_id AS pointsUserId,
       reservation.auction_id AS auctionId, reservation.settlement_id AS settlementId,
       reservation.plan_hash AS planHash,
       reservation.point_package_revision_id AS pointPackageRevisionId,
       reservation.price_ticks AS priceTicks, reservation.quantity,
       reservation.vector_hash AS vectorHash, reservation.lease_seconds AS leaseSeconds,
       reservation.created_at AS createdAt, reservation.expires_at AS expiresAt,
       state.status, state.version, state.terminal_at AS terminalAt,
       state.terminal_receipt_id AS terminalReceiptId
FROM point_reservation reservation
JOIN point_reservation_state state ON state.point_reservation_id = reservation.id`;

function materialize(
  row: ReservationRow,
  components: StoredReservation["components"],
): StoredReservation {
  return {
    ...row,
    components,
    createdAt: new Date(row.createdAt),
    expiresAt: new Date(row.expiresAt),
    terminalAt: row.terminalAt === null ? null : new Date(row.terminalAt),
  };
}

async function hydrate(db: D1Database, row: ReservationRow): Promise<StoredReservation> {
  const { results } = await db
    .prepare(
      `SELECT evaluation_criterion_id AS evaluationCriterionId,
              evaluation_criterion_revision_id AS evaluationCriterionRevisionId,
              amount_scaled AS amountScaled
       FROM point_reservation_component WHERE point_reservation_id = ?
       ORDER BY evaluation_criterion_id`,
    )
    .bind(row.pointReservationId)
    .all<StoredReservation["components"][number]>();
  return materialize(row, results);
}

export async function findReservationReplay(
  db: D1Database,
  marketsClientId: string,
  reservationKey: string,
  idempotencyKey: string,
): Promise<StoredReservation | null> {
  const row = await db
    .prepare(
      `${reservationSelect}
       WHERE reservation.markets_client_id = ?
         AND (reservation.reservation_key = ? OR reservation.idempotency_key = ?)
       LIMIT 1`,
    )
    .bind(marketsClientId, reservationKey, idempotencyKey)
    .first<ReservationRow>();
  return row ? hydrate(db, row) : null;
}

export async function findReservationById(
  db: D1Database,
  pointReservationId: string,
): Promise<StoredReservation | null> {
  const row = await db
    .prepare(`${reservationSelect} WHERE reservation.id = ?`)
    .bind(pointReservationId)
    .first<ReservationRow>();
  return row ? hydrate(db, row) : null;
}

export async function insertReservation(
  db: D1Database,
  input: {
    auctionId: string;
    components: Array<{
      amountScaled: number;
      displayOrder: number;
      evaluationCriterionId: string;
      evaluationCriterionRevisionId: string;
    }>;
    createdAt: Date;
    expiresAt: Date;
    idempotencyKey: string;
    marketsClientId: string;
    marketsUserId: string;
    payloadHash: string;
    planHash: string;
    pointPackageRevisionId: string;
    pointReservationId: string;
    pointsUserId: string;
    priceTicks: number;
    quantity: number;
    reservationKey: string;
    settlementId: string;
    vectorHash: string;
  },
): Promise<void> {
  const components = input.components.map((component) => ({
    ...component,
    id: `prc_${crypto.randomUUID()}`,
    pointReservationId: input.pointReservationId,
  }));
  const componentStatements = prepareJsonEachStatements(
    db,
    `INSERT INTO point_reservation_component
       (id, point_reservation_id, evaluation_criterion_id,
        evaluation_criterion_revision_id, display_order, amount_scaled)
     SELECT json_extract(value, '$.id'), json_extract(value, '$.pointReservationId'),
            json_extract(value, '$.evaluationCriterionId'),
            json_extract(value, '$.evaluationCriterionRevisionId'),
            json_extract(value, '$.displayOrder'), json_extract(value, '$.amountScaled')
     FROM json_each(?)`,
    chunkCanonicalJsonRows(components),
  );
  await runCsvAtomicBatch(db, [
    db
      .prepare(
        `INSERT INTO point_reservation
           (id, reservation_key, idempotency_key, payload_hash, markets_client_id,
            markets_user_id, points_user_id, auction_id, settlement_id, plan_hash,
            point_package_revision_id, price_ticks, quantity, vector_hash,
            expected_component_count, lease_seconds, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 900, ?, ?)`,
      )
      .bind(
        input.pointReservationId,
        input.reservationKey,
        input.idempotencyKey,
        input.payloadHash,
        input.marketsClientId,
        input.marketsUserId,
        input.pointsUserId,
        input.auctionId,
        input.settlementId,
        input.planHash,
        input.pointPackageRevisionId,
        input.priceTicks,
        input.quantity,
        input.vectorHash,
        components.length,
        input.createdAt.getTime(),
        input.expiresAt.getTime(),
      ),
    ...componentStatements,
    db
      .prepare(
        `INSERT INTO point_reservation_event
           (id, point_reservation_id, event_type, expected_version, markets_client_id,
            plan_hash, vector_hash, occurred_at)
         VALUES (?, ?, 'CREATED', 0, ?, ?, ?, ?)`,
      )
      .bind(
        `pre_${crypto.randomUUID()}`,
        input.pointReservationId,
        input.marketsClientId,
        input.planHash,
        input.vectorHash,
        input.createdAt.getTime(),
      ),
  ]);
}

export async function expireRequestedReservations(
  db: D1Database,
  marketsClientId: string,
  pointReservationIds: readonly string[],
  now: Date,
): Promise<void> {
  if (pointReservationIds.length === 0) return;
  await db
    .prepare(
      `INSERT OR IGNORE INTO point_reservation_event
         (id, point_reservation_id, event_type, expected_version, markets_client_id,
          plan_hash, vector_hash, occurred_at)
       SELECT 'pre_expired_' || reservation.id || '_' || state.version,
              reservation.id, 'EXPIRED', state.version, reservation.markets_client_id,
              reservation.plan_hash, reservation.vector_hash, ?
       FROM point_reservation reservation
       JOIN point_reservation_state state ON state.point_reservation_id = reservation.id
       JOIN json_each(?) requested ON requested.value = reservation.id
       WHERE reservation.markets_client_id = ? AND state.status = 'ACTIVE'
         AND reservation.expires_at <= ?`,
    )
    .bind(now.getTime(), JSON.stringify(pointReservationIds), marketsClientId, now.getTime())
    .run();
}

export async function readOwnedReservations(
  db: D1Database,
  marketsClientId: string,
  pointReservationIds: readonly string[],
): Promise<StoredReservation[]> {
  if (pointReservationIds.length === 0) return [];
  const rows = await db
    .prepare(
      `${reservationSelect}
       JOIN json_each(?) requested ON requested.value = reservation.id
       WHERE reservation.markets_client_id = ? ORDER BY reservation.id`,
    )
    .bind(JSON.stringify(pointReservationIds), marketsClientId)
    .all<ReservationRow>();
  if (rows.results.length === 0) return [];

  const componentChunks = chunkCanonicalJsonRows([
    ...new Set(rows.results.map(({ pointReservationId }) => pointReservationId)),
  ]);
  if (componentChunks.length !== 1) throw new Error("POINT_RESERVATION_COMPONENT_READ_TOO_LARGE");
  const components = await db
    .prepare(
      `SELECT component.point_reservation_id AS pointReservationId,
              component.evaluation_criterion_id AS evaluationCriterionId,
              component.evaluation_criterion_revision_id AS evaluationCriterionRevisionId,
              component.amount_scaled AS amountScaled
       FROM point_reservation_component component
       JOIN json_each(?) requested ON requested.value = component.point_reservation_id
       ORDER BY component.point_reservation_id, component.evaluation_criterion_id`,
    )
    .bind(componentChunks[0]!)
    .all<ReservationComponentRow>();
  const componentsByReservation = new Map<string, StoredReservation["components"]>();
  for (const { pointReservationId, ...component } of components.results) {
    const grouped = componentsByReservation.get(pointReservationId) ?? [];
    grouped.push(component);
    componentsByReservation.set(pointReservationId, grouped);
  }
  return rows.results.map((row) =>
    materialize(row, componentsByReservation.get(row.pointReservationId) ?? []),
  );
}

export async function insertReleaseEvent(
  db: D1Database,
  input: {
    eventId: string;
    idempotencyKey: string;
    marketsClientId: string;
    now: Date;
    payloadHash: string;
    planHash: string;
    pointReservationId: string;
    reason: string;
    vectorHash: string;
    version: number;
  },
) {
  await db
    .prepare(
      `INSERT INTO point_reservation_event
         (id, point_reservation_id, event_type, expected_version, markets_client_id,
          plan_hash, vector_hash, receipt_id, idempotency_key, payload_hash, reason, occurred_at)
       VALUES (?, ?, 'RELEASED', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.eventId,
      input.pointReservationId,
      input.version,
      input.marketsClientId,
      input.planHash,
      input.vectorHash,
      input.eventId,
      input.idempotencyKey,
      input.payloadHash,
      input.reason,
      input.now.getTime(),
    )
    .run();
}

export async function findReleaseReplay(
  db: D1Database,
  marketsClientId: string,
  idempotencyKey: string,
) {
  return db
    .prepare(
      `SELECT event.id, event.point_reservation_id AS pointReservationId,
              event.payload_hash AS payloadHash, event.reason, event.occurred_at AS occurredAt,
              event.plan_hash AS planHash
       FROM point_reservation_event event
       WHERE event.markets_client_id = ? AND event.event_type = 'RELEASED'
         AND event.idempotency_key = ?`,
    )
    .bind(marketsClientId, idempotencyKey)
    .first<{
      id: string;
      occurredAt: number;
      payloadHash: string;
      planHash: string;
      pointReservationId: string;
      reason: string;
    }>();
}

export async function findCaptureReplay(
  db: D1Database,
  marketsClientId: string,
  idempotencyKey: string,
) {
  return db
    .prepare(
      `SELECT id, payload_hash AS payloadHash, settlement_id AS settlementId,
              auction_id AS auctionId, plan_hash AS planHash, status,
              content_hash AS contentHash, captured_at AS capturedAt
       FROM point_settlement_capture WHERE markets_client_id = ? AND idempotency_key = ?`,
    )
    .bind(marketsClientId, idempotencyKey)
    .first<{
      auctionId: string;
      capturedAt: number;
      contentHash: string;
      id: string;
      payloadHash: string;
      planHash: string;
      settlementId: string;
      status: string;
    }>();
}

export async function readCaptureItems(db: D1Database, captureId: string) {
  return (
    await db
      .prepare(
        `SELECT item.point_reservation_id AS pointReservationId,
                reservation.vector_hash AS vectorHash
         FROM point_settlement_capture_item item
         JOIN point_reservation reservation ON reservation.id = item.point_reservation_id
         WHERE item.point_settlement_capture_id = ? ORDER BY item.point_reservation_id`,
      )
      .bind(captureId)
      .all<{ pointReservationId: string; vectorHash: string }>()
  ).results;
}

export async function insertCapture(
  db: D1Database,
  input: {
    auctionId: string;
    captureId: string;
    capturedAt: Date;
    contentHash: string;
    expectedLedgerCount: number;
    idempotencyKey: string;
    marketsClientId: string;
    payloadHash: string;
    planHash: string;
    reservations: Array<{ expectedVectorHash: string; pointReservationId: string }>;
    settlementId: string;
  },
) {
  const items = input.reservations.map((item) => ({
    ...item,
    captureId: input.captureId,
    id: `psci_${crypto.randomUUID()}`,
  }));
  const itemStatements = prepareJsonEachStatements(
    db,
    `INSERT INTO point_settlement_capture_item
       (id, point_settlement_capture_id, point_reservation_id, expected_vector_hash)
     SELECT json_extract(value, '$.id'), json_extract(value, '$.captureId'),
            json_extract(value, '$.pointReservationId'),
            json_extract(value, '$.expectedVectorHash') FROM json_each(?)`,
    chunkCanonicalJsonRows(items),
  );
  await runCsvAtomicBatch(db, [
    db
      .prepare(
        `INSERT INTO point_settlement_capture
           (id, markets_client_id, idempotency_key, payload_hash, settlement_id,
            auction_id, plan_hash, status, expected_reservation_count,
            expected_event_count, expected_ledger_count, content_hash, captured_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.captureId,
        input.marketsClientId,
        input.idempotencyKey,
        input.payloadHash,
        input.settlementId,
        input.auctionId,
        input.planHash,
        items.length,
        items.length,
        input.expectedLedgerCount,
        input.contentHash,
        input.capturedAt.getTime(),
      ),
    ...itemStatements,
    db
      .prepare("UPDATE point_settlement_capture SET status = 'VALIDATED' WHERE id = ?")
      .bind(input.captureId),
    db
      .prepare(
        `INSERT INTO point_reservation_event
           (id, point_reservation_id, event_type, expected_version, markets_client_id,
            plan_hash, vector_hash, point_settlement_capture_id, receipt_id, occurred_at)
         SELECT 'pre_capture_' || item.id, item.point_reservation_id, 'CAPTURED', state.version,
                capture.markets_client_id, capture.plan_hash, reservation.vector_hash,
                capture.id, capture.id, capture.captured_at
         FROM point_settlement_capture_item item
         JOIN point_settlement_capture capture ON capture.id = item.point_settlement_capture_id
         JOIN point_reservation reservation ON reservation.id = item.point_reservation_id
         JOIN point_reservation_state state ON state.point_reservation_id = reservation.id
         WHERE capture.id = ?`,
      )
      .bind(input.captureId),
    db
      .prepare(
        `INSERT INTO point_ledger_entry
           (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
            delta_amount_scaled, affects_evaluation_total, source_type,
            source_reservation_event_id, created_at)
         SELECT 'ledger_capture_' || event.id || '_' || component.id,
                reservation.points_user_id, component.evaluation_criterion_id,
                component.evaluation_criterion_revision_id, -component.amount_scaled,
                0, 'RESERVATION_CAPTURE', event.id, capture.captured_at
         FROM point_reservation_event event
         JOIN point_settlement_capture capture ON capture.id = event.point_settlement_capture_id
         JOIN point_reservation reservation ON reservation.id = event.point_reservation_id
         JOIN point_reservation_component component
           ON component.point_reservation_id = reservation.id
         WHERE capture.id = ? AND event.event_type = 'CAPTURED'
           AND component.amount_scaled <> 0`,
      )
      .bind(input.captureId),
    db
      .prepare("UPDATE point_settlement_capture SET status = 'COMMITTED' WHERE id = ?")
      .bind(input.captureId),
  ]);
}

export async function findInsufficientOwnedReservationIds(
  db: D1Database,
  marketsClientId: string,
  reservationIds: readonly string[],
): Promise<string[]> {
  if (reservationIds.length === 0) return [];
  const rows = await db
    .prepare(
      `SELECT DISTINCT reservation.id
       FROM point_reservation reservation
       JOIN point_reservation_state state ON state.point_reservation_id = reservation.id
       JOIN point_reservation_component component
         ON component.point_reservation_id = reservation.id
       LEFT JOIN point_account account
         ON account.points_user_id = reservation.points_user_id
        AND account.evaluation_criterion_id = component.evaluation_criterion_id
       JOIN json_each(?) requested ON requested.value = reservation.id
       WHERE reservation.markets_client_id = ? AND state.status = 'ACTIVE'
         AND COALESCE(account.balance, 0) < component.amount_scaled
       ORDER BY reservation.id`,
    )
    .bind(JSON.stringify(reservationIds), marketsClientId)
    .all<{ id: string }>();
  return rows.results.map(({ id }) => id);
}
