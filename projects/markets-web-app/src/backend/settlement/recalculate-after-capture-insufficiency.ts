import type { CaptureRound } from "./capture-all-winners";

export function mapCaptureInsufficiencyToUsers(
  round: CaptureRound,
  insufficientReservationIds: readonly unknown[] | undefined,
): readonly string[] {
  if (!insufficientReservationIds || insufficientReservationIds.length === 0) {
    throw new Error("CAPTURE_INSUFFICIENCY_IDS_INVALID");
  }
  if (
    insufficientReservationIds.some((value) => typeof value !== "string") ||
    new Set(insufficientReservationIds).size !== insufficientReservationIds.length
  ) {
    throw new Error("CAPTURE_INSUFFICIENCY_IDS_INVALID");
  }
  const byReservation = new Map(
    round.winners.map((winner) => [winner.pointReservationId, winner.marketsUserId]),
  );
  const users = insufficientReservationIds.map((id) => byReservation.get(id as string));
  if (users.some((user) => user === undefined)) {
    throw new Error("CAPTURE_INSUFFICIENCY_IDS_INVALID");
  }
  return [...new Set(users as string[])].sort();
}
