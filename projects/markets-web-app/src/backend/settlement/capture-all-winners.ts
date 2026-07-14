import type {
  ReleaseReservationReceipt,
  ReservationStatusReceipt,
} from "./reserve-settlement-round";
import { mapCaptureInsufficiencyToUsers } from "./recalculate-after-capture-insufficiency";

export interface CapturedSettlementReceipt {
  auctionId: string;
  capturedAt: string;
  captureReceiptId: string;
  contentHash: string;
  planHash: string;
  reservations: readonly {
    pointReservationId: string;
    status: "CAPTURED";
    vectorHash: string;
  }[];
  settlementId: string;
}

export interface CaptureRoundWinner {
  allocationQuantity: number;
  componentVectorJson: string | null;
  marketsUserId: string;
  pointReservationId: string;
  priceTickCount: number;
  priceTicks: number;
  reservationKey: string;
  status: "ACTIVE" | "CAPTURED" | "EXPIRED" | "RELEASED";
  vectorHash: string;
}

export interface CaptureRound {
  auctionId: string;
  kind: "END_OF_AUCTION" | "BUY_NOW";
  roundId: string;
  roundOrdinal: number;
  state: "RESERVED" | "CAPTURED";
  winners: readonly CaptureRoundWinner[];
}

export interface SettlementCaptureGateway {
  statusByIds(
    ids: readonly string[],
    signal?: AbortSignal,
  ): Promise<
    readonly (ReservationStatusReceipt & {
      auctionId?: string;
      planHash?: string;
      settlementId?: string;
    })[]
  >;
  capture(input: {
    auctionId: string;
    idempotencyKey: string;
    planHash: string;
    reservations: readonly {
      expectedVectorHash: string;
      pointReservationId: string;
    }[];
    settlementId: string;
    signal?: AbortSignal;
  }): Promise<CapturedSettlementReceipt>;
  release(
    input: {
      planHash: string;
      pointReservationId: string;
      reservationKey: string;
    },
    signal?: AbortSignal,
  ): Promise<ReleaseReservationReceipt>;
}

export interface SettlementCaptureRepository {
  loadCaptureRound(input: {
    planHash: string;
    roundOrdinal: number;
    settlementId: string;
    settlementRevision: number;
  }): Promise<CaptureRound>;
  markCaptureManualAction(input: {
    now: string;
    reason: string;
    roundId: string;
    settlementId: string;
  }): Promise<void>;
  recordCaptureReceipt(input: {
    now: string;
    receipt: CapturedSettlementReceipt;
    roundId: string;
  }): Promise<CapturedSettlementReceipt>;
  recordCaptureInsufficiency?(input: {
    insufficientUserIds: readonly string[];
    now: string;
    releases: readonly {
      marketsUserId: string;
      pointReservationId: string;
      receipt: ReleaseReservationReceipt;
    }[];
    roundId: string;
    settlementId: string;
  }): Promise<void>;
}

export interface CaptureAllWinnersDependencies {
  gateway: SettlementCaptureGateway;
  now(): Date;
  repository: SettlementCaptureRepository;
}

export type CaptureAllWinnersResult =
  | { kind: "CAPTURED"; receipt: CapturedSettlementReceipt }
  | { kind: "RECALCULATE"; nextRoundOrdinal: number }
  | { kind: "BUY_NOW_RESTORED"; receiptId: string }
  | { kind: "MANUAL_ACTION"; reason: string };

const SHA256 = /^(?:sha256:)?[0-9a-f]{64}$/;
const PREFIXED_SHA256 = /^sha256:[0-9a-f]{64}$/;

function sorted<T extends { pointReservationId: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) =>
    left.pointReservationId.localeCompare(right.pointReservationId),
  );
}

function statusMatches(
  round: CaptureRound,
  settlementId: string,
  planHash: string,
  statuses: readonly Awaited<ReturnType<SettlementCaptureGateway["statusByIds"]>>[number][],
): boolean {
  if (statuses.length !== round.winners.length) return false;
  const expected = new Map(round.winners.map((winner) => [winner.pointReservationId, winner]));
  const seen = new Set<string>();
  for (const status of statuses) {
    if (!status.pointReservationId || seen.has(status.pointReservationId)) return false;
    seen.add(status.pointReservationId);
    const winner = expected.get(status.pointReservationId);
    if (
      !winner ||
      status.reservationKey !== winner.reservationKey ||
      status.vectorHash !== winner.vectorHash ||
      (status.auctionId !== undefined && status.auctionId !== round.auctionId) ||
      (status.settlementId !== undefined && status.settlementId !== settlementId) ||
      (status.planHash !== undefined && status.planHash !== planHash)
    ) {
      return false;
    }
  }
  return true;
}

function receiptMatches(
  receipt: CapturedSettlementReceipt,
  round: CaptureRound,
  settlementId: string,
  planHash: string,
): boolean {
  if (
    receipt.settlementId !== settlementId ||
    receipt.auctionId !== round.auctionId ||
    receipt.planHash !== planHash ||
    !receipt.captureReceiptId ||
    !Number.isFinite(Date.parse(receipt.capturedAt)) ||
    !PREFIXED_SHA256.test(receipt.contentHash) ||
    receipt.reservations.length !== round.winners.length
  ) {
    return false;
  }
  const actual = sorted(receipt.reservations);
  const expected = sorted(round.winners);
  return actual.every(
    (item, index) =>
      item.status === "CAPTURED" &&
      item.pointReservationId === expected[index]?.pointReservationId &&
      item.vectorHash === expected[index]?.vectorHash &&
      SHA256.test(item.vectorHash),
  );
}

async function manualAction(
  dependencies: CaptureAllWinnersDependencies,
  round: CaptureRound,
  settlementId: string,
  reason: string,
): Promise<CaptureAllWinnersResult> {
  await dependencies.repository.markCaptureManualAction({
    now: dependencies.now().toISOString(),
    reason,
    roundId: round.roundId,
    settlementId,
  });
  return { kind: "MANUAL_ACTION", reason };
}

export async function captureAllWinners(
  dependencies: CaptureAllWinnersDependencies,
  input: {
    planHash: string;
    roundOrdinal: number;
    settlementId: string;
    settlementRevision: number;
  },
): Promise<CaptureAllWinnersResult> {
  const round = await dependencies.repository.loadCaptureRound(input);
  if (
    round.roundOrdinal !== input.roundOrdinal ||
    round.state !== "RESERVED" ||
    round.winners.length === 0 ||
    round.winners.some(
      (winner) =>
        !winner.pointReservationId ||
        !winner.componentVectorJson ||
        !SHA256.test(winner.vectorHash),
    )
  ) {
    return manualAction(dependencies, round, input.settlementId, "CAPTURE_ROUND_INVALID");
  }

  const winners = sorted(round.winners);
  const statuses = await dependencies.gateway.statusByIds(
    winners.map((winner) => winner.pointReservationId),
  );
  if (!statusMatches(round, input.settlementId, input.planHash, statuses)) {
    return manualAction(dependencies, round, input.settlementId, "CAPTURE_STATUS_MISMATCH");
  }

  const capturedStatuses = statuses.filter((status) => status.status === "CAPTURED");
  const activeStatuses = statuses.filter((status) => status.status === "ACTIVE");
  const replayReceiptIds = new Set(
    capturedStatuses.map((status) => status.terminalReceiptId).filter(Boolean),
  );
  const mayCapture = activeStatuses.length === statuses.length;
  const mayReplay =
    capturedStatuses.length === statuses.length &&
    replayReceiptIds.size === 1 &&
    capturedStatuses.every((status) => Boolean(status.terminalReceiptId));

  if (!mayCapture && !mayReplay) {
    if (capturedStatuses.length > 0) {
      return manualAction(dependencies, round, input.settlementId, "CAPTURE_STATUS_MIXED");
    }
    if (round.kind === "BUY_NOW") {
      return manualAction(dependencies, round, input.settlementId, "BUY_NOW_NOT_CAPTURABLE");
    }
    for (const status of activeStatuses) {
      const winner = winners.find((item) => item.pointReservationId === status.pointReservationId);
      if (!winner) continue;
      await dependencies.gateway.release({
        planHash: input.planHash,
        pointReservationId: winner.pointReservationId,
        reservationKey: winner.reservationKey,
      });
    }
    return { kind: "RECALCULATE", nextRoundOrdinal: input.roundOrdinal + 1 };
  }

  const idempotencyKey = `capture:${input.settlementId}:${input.settlementRevision}:${input.roundOrdinal}`;
  let receipt: CapturedSettlementReceipt;
  try {
    receipt = await dependencies.gateway.capture({
      auctionId: round.auctionId,
      idempotencyKey,
      planHash: input.planHash,
      reservations: winners.map((winner) => ({
        expectedVectorHash: winner.vectorHash,
        pointReservationId: winner.pointReservationId,
      })),
      settlementId: input.settlementId,
    });
  } catch (error) {
    const failure = error as {
      code?: unknown;
      insufficientReservationIds?: readonly unknown[];
      status?: unknown;
    };
    if (
      failure.status === 409 &&
      failure.code === "INSUFFICIENT_BALANCE" &&
      round.kind === "END_OF_AUCTION"
    ) {
      let insufficientUserIds: readonly string[];
      try {
        insufficientUserIds = mapCaptureInsufficiencyToUsers(
          round,
          failure.insufficientReservationIds,
        );
      } catch {
        return manualAction(
          dependencies,
          round,
          input.settlementId,
          "CAPTURE_INSUFFICIENCY_IDS_INVALID",
        );
      }
      const releases: {
        marketsUserId: string;
        pointReservationId: string;
        receipt: ReleaseReservationReceipt;
      }[] = [];
      for (const winner of winners) {
        const releaseReceipt = await dependencies.gateway.release({
          planHash: input.planHash,
          pointReservationId: winner.pointReservationId,
          reservationKey: winner.reservationKey,
        });
        releases.push({
          marketsUserId: winner.marketsUserId,
          pointReservationId: winner.pointReservationId,
          receipt: releaseReceipt,
        });
      }
      await dependencies.repository.recordCaptureInsufficiency?.({
        insufficientUserIds,
        now: dependencies.now().toISOString(),
        releases,
        roundId: round.roundId,
        settlementId: input.settlementId,
      });
      return { kind: "RECALCULATE", nextRoundOrdinal: input.roundOrdinal + 1 };
    }
    return manualAction(dependencies, round, input.settlementId, "CAPTURE_REQUEST_FAILED");
  }
  if (!receiptMatches(receipt, round, input.settlementId, input.planHash)) {
    return manualAction(dependencies, round, input.settlementId, "CAPTURE_RECEIPT_MISMATCH");
  }
  const recorded = await dependencies.repository.recordCaptureReceipt({
    now: dependencies.now().toISOString(),
    receipt: { ...receipt, reservations: sorted(receipt.reservations) },
    roundId: round.roundId,
  });
  return { kind: "CAPTURED", receipt: recorded };
}
