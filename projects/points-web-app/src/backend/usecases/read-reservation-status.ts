import {
  expireRequestedReservations,
  readOwnedReservations,
} from "../infrastructure/db/d1-reservation-repository";

export async function readReservationStatus(
  db: D1Database,
  input: {
    marketsClientId: string;
    now?: Date;
    pointReservationIds?: string[];
    reservationKeys?: string[];
  },
) {
  let pointReservationIds = input.pointReservationIds;
  if (input.reservationKeys) {
    if (
      input.reservationKeys.length < 1 ||
      new Set(input.reservationKeys).size !== input.reservationKeys.length
    ) {
      throw new Error("POINT_RESERVATION_STATUS_INVALID");
    }
    const rows = await db
      .prepare(
        `SELECT reservation.id
         FROM point_reservation reservation
         JOIN json_each(?) requested ON requested.value = reservation.reservation_key
         WHERE reservation.markets_client_id = ? ORDER BY reservation.id`,
      )
      .bind(JSON.stringify(input.reservationKeys), input.marketsClientId)
      .all<{ id: string }>();
    pointReservationIds = rows.results.map(({ id }) => id);
    if (pointReservationIds.length !== input.reservationKeys.length)
      throw new Error("RESOURCE_NOT_FOUND");
  }
  if (
    input.marketsClientId.length === 0 ||
    !pointReservationIds ||
    pointReservationIds.length < 1 ||
    new Set(pointReservationIds).size !== pointReservationIds.length
  ) {
    throw new Error("POINT_RESERVATION_STATUS_INVALID");
  }
  await expireRequestedReservations(
    db,
    input.marketsClientId,
    pointReservationIds,
    input.now ?? new Date(),
  );
  const reservations = await readOwnedReservations(db, input.marketsClientId, pointReservationIds);
  if (reservations.length !== pointReservationIds.length) throw new Error("RESOURCE_NOT_FOUND");
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
