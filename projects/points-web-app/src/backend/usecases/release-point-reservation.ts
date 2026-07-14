import { canonicalJson, sha256Hex } from "../csv/csv-validation-result";
import {
  expireRequestedReservations,
  findReleaseReplay,
  findReservationById,
  insertReleaseEvent,
} from "../infrastructure/db/d1-reservation-repository";

export async function releasePointReservation(
  db: D1Database,
  input: {
    idempotencyKey: string;
    marketsClientId: string;
    now?: Date;
    planHash: string;
    pointReservationId: string;
    reason: string;
  },
) {
  const payloadHash = await sha256Hex(
    canonicalJson({
      marketsClientId: input.marketsClientId,
      planHash: input.planHash,
      pointReservationId: input.pointReservationId,
      reason: input.reason,
    }),
  );
  const replay = await findReleaseReplay(db, input.marketsClientId, input.idempotencyKey);
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return {
      contentHash: `sha256:${payloadHash}`,
      planHash: replay.planHash,
      pointReservationId: replay.pointReservationId,
      reason: replay.reason,
      releaseReceiptId: replay.id,
      releasedAt: new Date(replay.occurredAt),
      status: "RELEASED" as const,
    };
  }
  const now = input.now ?? new Date();
  await expireRequestedReservations(db, input.marketsClientId, [input.pointReservationId], now);
  const reservation = await findReservationById(db, input.pointReservationId);
  if (!reservation || reservation.marketsClientId !== input.marketsClientId) {
    throw new Error("RESOURCE_NOT_FOUND");
  }
  if (
    reservation.status !== "ACTIVE" ||
    reservation.planHash !== input.planHash ||
    now.getTime() >= reservation.expiresAt.getTime()
  ) {
    throw new Error("RESERVATION_STATE_INVALID");
  }
  const eventId = `prr_${crypto.randomUUID()}`;
  await insertReleaseEvent(db, {
    ...input,
    eventId,
    now,
    payloadHash,
    vectorHash: reservation.vectorHash,
    version: reservation.version,
  });
  return {
    contentHash: `sha256:${payloadHash}`,
    planHash: input.planHash,
    pointReservationId: input.pointReservationId,
    reason: input.reason,
    releaseReceiptId: eventId,
    releasedAt: now,
    status: "RELEASED" as const,
  };
}
