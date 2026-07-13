import {
  expireRequestedReservations,
  readOwnedReservations,
} from "../infrastructure/db/d1-reservation-repository";

export async function readReservationStatus(
  db: D1Database,
  input: { marketsClientId: string; now?: Date; pointReservationIds: string[] },
) {
  if (
    input.marketsClientId.length === 0 ||
    input.pointReservationIds.length < 1 ||
    new Set(input.pointReservationIds).size !== input.pointReservationIds.length
  ) {
    throw new Error("POINT_RESERVATION_STATUS_INVALID");
  }
  await expireRequestedReservations(
    db,
    input.marketsClientId,
    input.pointReservationIds,
    input.now ?? new Date(),
  );
  const reservations = await readOwnedReservations(
    db,
    input.marketsClientId,
    input.pointReservationIds,
  );
  if (reservations.length !== input.pointReservationIds.length)
    throw new Error("RESOURCE_NOT_FOUND");
  return reservations.map((reservation) => ({
    auctionId: reservation.auctionId,
    createdAt: reservation.createdAt,
    expiresAt: reservation.expiresAt,
    planHash: reservation.planHash,
    pointReservationId: reservation.pointReservationId,
    reservationKey: reservation.reservationKey,
    settlementId: reservation.settlementId,
    status: reservation.status,
    terminalAt: reservation.terminalAt,
    terminalReceiptId: reservation.terminalReceiptId,
    vectorHash: reservation.vectorHash,
  }));
}
