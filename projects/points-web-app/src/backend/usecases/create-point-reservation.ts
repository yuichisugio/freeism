import { canonicalJson, sha256Hex } from "../csv/csv-validation-result";
import { calculatePointReservationVector } from "../domain/reservation/point-reservation";
import { readPersistedPointPackageRevision } from "../infrastructure/db/d1-evaluation-repository";
import {
  findReservationReplay,
  insertReservation,
  type StoredReservation,
} from "../infrastructure/db/d1-reservation-repository";

export interface CreatePointReservationInput {
  auctionId: string;
  idempotencyKey: string;
  marketsClientId: string;
  marketsUserId: string;
  now?: Date;
  planHash: string;
  pointPackageRevisionId: string;
  pointsUserId: string;
  priceTicks: number;
  quantity: number;
  reservationKey: string;
  settlementId: string;
}

export type CreatedPointReservation = Pick<
  StoredReservation,
  | "auctionId"
  | "components"
  | "createdAt"
  | "expiresAt"
  | "leaseSeconds"
  | "planHash"
  | "pointPackageRevisionId"
  | "pointReservationId"
  | "priceTicks"
  | "quantity"
  | "reservationKey"
  | "settlementId"
  | "status"
  | "vectorHash"
>;

function result(value: StoredReservation): CreatedPointReservation {
  const {
    auctionId,
    components,
    createdAt,
    expiresAt,
    leaseSeconds,
    planHash,
    pointPackageRevisionId,
    pointReservationId,
    priceTicks,
    quantity,
    reservationKey,
    settlementId,
    status,
    vectorHash,
  } = value;
  return {
    auctionId,
    components,
    createdAt,
    expiresAt,
    leaseSeconds,
    planHash,
    pointPackageRevisionId,
    pointReservationId,
    priceTicks,
    quantity,
    reservationKey,
    settlementId,
    status,
    vectorHash,
  };
}

export async function createPointReservation(
  db: D1Database,
  input: CreatePointReservationInput,
): Promise<CreatedPointReservation> {
  if (
    [
      input.auctionId,
      input.idempotencyKey,
      input.marketsClientId,
      input.marketsUserId,
      input.planHash,
      input.pointPackageRevisionId,
      input.pointsUserId,
      input.reservationKey,
      input.settlementId,
    ].some((value) => value.length === 0) ||
    input.reservationKey.length > 512
  ) {
    throw new Error("POINT_RESERVATION_INVALID");
  }
  const payload = {
    auctionId: input.auctionId,
    marketsClientId: input.marketsClientId,
    marketsUserId: input.marketsUserId,
    planHash: input.planHash,
    pointPackageRevisionId: input.pointPackageRevisionId,
    pointsUserId: input.pointsUserId,
    priceTicks: input.priceTicks,
    quantity: input.quantity,
    reservationKey: input.reservationKey,
    settlementId: input.settlementId,
  };
  const payloadHash = await sha256Hex(canonicalJson(payload));
  const replay = await findReservationReplay(
    db,
    input.marketsClientId,
    input.reservationKey,
    input.idempotencyKey,
  );
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return result(replay);
  }
  const revision = await readPersistedPointPackageRevision(db, input.pointPackageRevisionId);
  if (!revision) throw new Error("POINT_PACKAGE_REVISION_NOT_FOUND");
  const vector = await calculatePointReservationVector(revision, input.priceTicks, input.quantity);
  const now = input.now ?? new Date();
  const pointReservationId = `prv_${crypto.randomUUID()}`;
  try {
    await insertReservation(db, {
      ...input,
      components: vector.components,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 900_000),
      payloadHash,
      pointReservationId,
      vectorHash: vector.vectorHash,
    });
  } catch (error) {
    const concurrentReplay = await findReservationReplay(
      db,
      input.marketsClientId,
      input.reservationKey,
      input.idempotencyKey,
    );
    if (!concurrentReplay) throw error;
    if (concurrentReplay.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return result(concurrentReplay);
  }
  const stored = await findReservationReplay(
    db,
    input.marketsClientId,
    input.reservationKey,
    input.idempotencyKey,
  );
  if (!stored) throw new Error("POINT_RESERVATION_WRITE_FAILED");
  return result(stored);
}
