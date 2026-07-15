export interface StoredIdempotencyResult {
  contentType: string;
  responseBody: string;
  status: number;
}

export type IdempotencyReservation =
  | { kind: "RESERVED"; reservationId: string }
  | { kind: "REPLAY"; result: StoredIdempotencyResult }
  | { kind: "CONFLICT" }
  | { kind: "IN_PROGRESS" };

interface IdempotencyRow {
  id: string;
  payloadHash: string;
  responseBody: string | null;
  responseContentType: string | null;
  responseStatus: number | null;
  state: "PENDING" | "COMPLETED";
}

export class D1IdempotencyRepository {
  constructor(private readonly database: D1Database) {}

  async replayOrReserve(
    actorMarketsUserId: string,
    operation: string,
    idempotencyKey: string,
    payloadHash: string,
  ): Promise<IdempotencyReservation> {
    const reservationId = `idem_${crypto.randomUUID()}`;
    const results = await this.database.batch<IdempotencyRow>([
      this.database
        .prepare(
          `INSERT OR IGNORE INTO idempotency_results
             (id, actor_markets_user_id, operation, idempotency_key, payload_hash, state)
           VALUES (?, ?, ?, ?, ?, 'PENDING')`,
        )
        .bind(reservationId, actorMarketsUserId, operation, idempotencyKey, payloadHash),
      this.database
        .prepare(
          `SELECT id, payload_hash AS payloadHash, state,
                  response_status AS responseStatus,
                  response_body AS responseBody,
                  response_content_type AS responseContentType
             FROM idempotency_results
            WHERE actor_markets_user_id = ? AND operation = ? AND idempotency_key = ?`,
        )
        .bind(actorMarketsUserId, operation, idempotencyKey),
    ]);
    const insert = results[0];
    const selected = results[1];
    if (!insert || !selected) throw new Error("IDEMPOTENCY_BATCH_RESULT_MISSING");
    const row = selected.results[0];
    if (!row) throw new Error("IDEMPOTENCY_RESERVATION_MISSING");
    if (insert.meta.changes === 1) return { kind: "RESERVED", reservationId };
    if (row.payloadHash !== payloadHash) return { kind: "CONFLICT" };
    if (row.state !== "COMPLETED") return { kind: "IN_PROGRESS" };
    if (
      row.responseStatus === null ||
      row.responseBody === null ||
      row.responseContentType === null
    ) {
      throw new Error("IDEMPOTENCY_RESULT_INCOMPLETE");
    }
    return {
      kind: "REPLAY",
      result: {
        contentType: row.responseContentType,
        responseBody: row.responseBody,
        status: row.responseStatus,
      },
    };
  }

  async complete(reservationId: string, result: StoredIdempotencyResult) {
    const completed = await this.database
      .prepare(
        `UPDATE idempotency_results
            SET state = 'COMPLETED', response_status = ?, response_body = ?,
                response_content_type = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ? AND state = 'PENDING'`,
      )
      .bind(result.status, result.responseBody, result.contentType, reservationId)
      .run();
    if (completed.meta.changes !== 1) throw new Error("IDEMPOTENCY_COMPLETION_CONFLICT");
  }
}
