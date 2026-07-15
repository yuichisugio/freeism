import { canonicalJson, sha256Hex } from "../csv/csv-validation-result";
import {
  expireRequestedReservations,
  findCaptureReplay,
  findInsufficientOwnedReservationIds,
  insertCapture,
  readCaptureItems,
  readOwnedReservations,
} from "../infrastructure/db/d1-reservation-repository";

export class CaptureStateChangedError extends Error {
  readonly code = "CAPTURE_STATE_CHANGED";
  constructor() {
    super("CAPTURE_STATE_CHANGED");
  }
}

export class CaptureInsufficientBalanceError extends Error {
  readonly code = "INSUFFICIENT_BALANCE";
  constructor(readonly insufficientReservationIds: string[]) {
    super("INSUFFICIENT_BALANCE");
  }
}

export async function captureSettlement(
  db: D1Database,
  input: {
    auctionId: string;
    idempotencyKey: string;
    marketsClientId: string;
    now?: Date;
    planHash: string;
    reservations: Array<{ expectedVectorHash: string; pointReservationId: string }>;
    settlementId: string;
  },
) {
  if (
    input.reservations.length < 1 ||
    input.reservations.length > 1_000 ||
    new Set(input.reservations.map(({ pointReservationId }) => pointReservationId)).size !==
      input.reservations.length
  ) {
    throw new CaptureStateChangedError();
  }
  const reservations = [...input.reservations].sort((left, right) =>
    left.pointReservationId.localeCompare(right.pointReservationId),
  );
  const payloadHash = await sha256Hex(
    canonicalJson({
      auctionId: input.auctionId,
      marketsClientId: input.marketsClientId,
      planHash: input.planHash,
      reservations,
      settlementId: input.settlementId,
    }),
  );
  const replay = await findCaptureReplay(db, input.marketsClientId, input.idempotencyKey);
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    if (replay.status !== "COMMITTED") throw new CaptureStateChangedError();
    return {
      auctionId: replay.auctionId,
      captureReceiptId: replay.id,
      capturedAt: new Date(replay.capturedAt),
      contentHash: replay.contentHash,
      planHash: replay.planHash,
      reservations: (await readCaptureItems(db, replay.id)).map((item) => ({
        ...item,
        status: "CAPTURED" as const,
      })),
      settlementId: replay.settlementId,
      status: "CAPTURED" as const,
    };
  }
  const now = input.now ?? new Date();
  const ids = reservations.map(({ pointReservationId }) => pointReservationId);
  await expireRequestedReservations(db, input.marketsClientId, ids, now);
  const owned = await readOwnedReservations(db, input.marketsClientId, ids);
  const requestedById = new Map(reservations.map((item) => [item.pointReservationId, item]));
  if (
    owned.length !== ids.length ||
    owned.some((reservation) => {
      const requested = requestedById.get(reservation.pointReservationId)!;
      return (
        reservation.status !== "ACTIVE" ||
        now.getTime() >= reservation.expiresAt.getTime() ||
        reservation.auctionId !== input.auctionId ||
        reservation.settlementId !== input.settlementId ||
        reservation.planHash !== input.planHash ||
        reservation.vectorHash !== requested.expectedVectorHash
      );
    })
  ) {
    throw new CaptureStateChangedError();
  }
  const insufficient = await findInsufficientOwnedReservationIds(db, input.marketsClientId, ids);
  if (insufficient.length > 0) throw new CaptureInsufficientBalanceError(insufficient);
  const expectedLedgerCount = owned.reduce(
    (count, reservation) =>
      count + reservation.components.filter(({ amountScaled }) => amountScaled !== 0).length,
    0,
  );
  const captureId = `pcr_${crypto.randomUUID()}`;
  const contentHash = `sha256:${await sha256Hex(
    canonicalJson({ captureId, payloadHash, reservations }),
  )}`;
  try {
    await insertCapture(db, {
      ...input,
      captureId,
      capturedAt: now,
      contentHash,
      expectedLedgerCount,
      payloadHash,
      reservations,
    });
  } catch (error) {
    const concurrentReplay = await findCaptureReplay(
      db,
      input.marketsClientId,
      input.idempotencyKey,
    );
    if (concurrentReplay?.status === "COMMITTED" && concurrentReplay.payloadHash === payloadHash) {
      return captureSettlement(db, input);
    }
    if (String(error).includes("INSUFFICIENT_BALANCE")) {
      const after = await findInsufficientOwnedReservationIds(db, input.marketsClientId, ids);
      if (after.length > 0) throw new CaptureInsufficientBalanceError(after);
    }
    throw new CaptureStateChangedError();
  }
  return {
    auctionId: input.auctionId,
    captureReceiptId: captureId,
    capturedAt: now,
    contentHash,
    planHash: input.planHash,
    reservations: (await readCaptureItems(db, captureId)).map((item) => ({
      ...item,
      status: "CAPTURED" as const,
    })),
    settlementId: input.settlementId,
    status: "CAPTURED" as const,
  };
}
