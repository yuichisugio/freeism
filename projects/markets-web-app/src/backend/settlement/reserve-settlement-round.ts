import { clearAuction } from "../auction/domain/clear-auction";
import type { BidPosition } from "../auction/domain/auction-types";
import {
  classifyReservationFailure,
  type ReservationFailureClass,
} from "./classify-reservation-failure";
import { createSettlementPlan, type SettlementPlan } from "./create-settlement-plan";

export interface WinnerReservationRequest {
  allocationQuantity: number;
  auctionId: string;
  leaseSeconds: 900;
  marketsUserId: string;
  planHash: string;
  pointPackageRevisionId: string;
  pointsConnectionId: string | null;
  priceTicks: number;
  reservationKey: string;
  settlementId: string;
}

export interface WinnerReservationReceipt {
  expiresAt: string;
  pointReservationId: string;
  requestId?: string;
  vectorHash: string;
}

export interface ReservationStatusReceipt {
  expiresAt?: string;
  pointReservationId?: string;
  reservationKey: string;
  status: "ACTIVE" | "CAPTURED" | "EXPIRED" | "RELEASED" | "NOT_FOUND";
  vectorHash?: string;
}

export interface ReleaseReservationReceipt {
  contentHash: string;
  receiptId: string;
  releasedAt: string;
}

export interface ReservationGateway {
  release(input: {
    planHash: string;
    pointReservationId: string;
    reservationKey: string;
  }): Promise<ReleaseReservationReceipt>;
  reserve(input: WinnerReservationRequest): Promise<WinnerReservationReceipt>;
  statusByKeys(keys: readonly string[]): Promise<readonly ReservationStatusReceipt[]>;
}

export interface BuyNowRestorer {
  restoreBuyNowHold(input: {
    evidenceType: "RESERVATION_REJECTED" | "ALL_RESERVATIONS_NON_CAPTURABLE";
    failureHash: string;
    holdId: string;
    settlementId: string;
  }): Promise<{ receiptId: string }>;
}

export interface LoadedSettlementPlan {
  auctionId: string;
  connectionByUser: Readonly<Record<string, string>>;
  cutoffHash: string;
  excludedUserIds: readonly string[];
  plan: SettlementPlan;
  planHash: string;
  positions: readonly (BidPosition & { id: string; pointsConnectionId: string | null })[];
  reauthRequiredUserIds: readonly string[];
  settlementId: string;
}

export interface RoundWinnerInput {
  allocationQuantity: number;
  marketsUserId: string;
  pointsConnectionId: string | null;
  priceTickCount: number;
  priceTicks: number;
  reservationKey: string;
}

export interface BeginRoundInput {
  cutoffHash: string;
  excludedUserIds: readonly string[];
  now: string;
  planHash: string;
  roundOrdinal: number;
  settlementId: string;
  winners: readonly RoundWinnerInput[];
}

export interface ReservationRoundState {
  excludedUserIds: readonly string[];
  firstAttemptAt: string;
  id: string;
  retryDeadlineAt: string;
  roundOrdinal: number;
  state: "RESERVING" | "RELEASING" | "RELEASED" | "RESERVED" | "FAILED";
  winners: readonly (RoundWinnerInput & {
    attemptCount: number;
    expiresAt: string | null;
    failureClass: ReservationFailureClass | null;
    failureCode: string | null;
    failureHash: string | null;
    pointReservationId: string | null;
    status: "PENDING" | "ACTIVE" | "REJECTED" | "UNKNOWN" | "RELEASED" | "EXPIRED" | "CAPTURED";
    vectorHash: string | null;
  })[];
}

export interface WinnerReceiptInput extends WinnerReservationReceipt {
  marketsUserId: string;
  now: string;
  roundId: string;
}

export interface WinnerFailureInput {
  failureClass: ReservationFailureClass;
  failureCode: string;
  failureHash: string;
  marketsUserId: string;
  now: string;
  requestId?: string;
  roundId: string;
}

export interface SettlementReservationRepository {
  beginOrResumeRound(input: BeginRoundInput): Promise<ReservationRoundState>;
  completeReleaseAndExclude(input: {
    auctionId: string;
    exclusions: readonly {
      failureClass: "INSUFFICIENT" | "REAUTH_REQUIRED";
      marketsUserId: string;
    }[];
    now: string;
    roundId: string;
    roundOrdinal: number;
    settlementId: string;
    nextRound: { cutoffHash: string; excludedUserIds: readonly string[]; planHash: string };
  }): Promise<void>;
  confirmNoReservationId(roundId: string, marketsUserId: string, now: string): Promise<void>;
  hasNoIssuedReservationEvidence(
    roundId: string,
    marketsUserId: string,
    failureHash: string,
  ): Promise<boolean>;
  loadPlan(
    settlementId: string,
    settlementRevision: number,
    planHash: string,
  ): Promise<LoadedSettlementPlan>;
  markManualAction(settlementId: string, roundId: string, now: string): Promise<void>;
  markReserved(roundId: string, settlementId: string, now: string): Promise<boolean>;
  recordRelease(input: {
    contentHash: string;
    marketsUserId: string;
    now: string;
    receiptId: string;
    releasedAt: string;
    roundId: string;
  }): Promise<void>;
  recordWinnerAttempt(roundId: string, marketsUserId: string, now: string): Promise<void>;
  recordWinnerFailure(input: WinnerFailureInput): Promise<void>;
  recordWinnerReceipt(input: WinnerReceiptInput): Promise<void>;
}

export interface ReserveSettlementRoundDependencies {
  buyNowRestorer: BuyNowRestorer;
  gateway: ReservationGateway;
  now(): Date;
  repository: SettlementReservationRepository;
}

export type ReservationRoundResult =
  | {
      kind: "RESERVED";
      planHash: string;
      reservations: readonly { marketsUserId: string; pointReservationId: string }[];
      roundOrdinal: number;
    }
  | { excludedUserIds: readonly string[]; kind: "RECALCULATE"; nextRoundOrdinal: number }
  | { kind: "BUY_NOW_RESTORED"; receiptId: string }
  | { kind: "MANUAL_ACTION"; reason: string };

function safeProduct(left: number, right: number): number {
  const product = BigInt(left) * BigInt(right);
  if (product > BigInt(Number.MAX_SAFE_INTEGER) || product < 0n) {
    throw new Error("SETTLEMENT_INPUT_UNSAFE_INTEGER");
  }
  return Number(product);
}

async function endWinners(loaded: LoadedSettlementPlan, roundOrdinal: number) {
  if (loaded.plan.kind !== "END_OF_AUCTION") throw new Error("END_PLAN_REQUIRED");
  const rebuilt = await createSettlementPlan({
    algorithmVersion: loaded.plan.algorithmVersion,
    auctionId: loaded.plan.auctionId,
    auctionRevisionId: loaded.plan.auctionRevisionId,
    cutoffAt: loaded.plan.cutoffAt,
    eligibleBids: loaded.positions.map((position) => ({
      bidPositionId: position.id,
      marketsUserId: position.marketsUserId,
      quantity: position.quantity,
      priceTickCount: position.priceTickCount,
      reachedSequence: position.reachedSequence,
    })),
    kind: "END_OF_AUCTION",
    maxBidSeq: loaded.plan.maxBidSeq,
    packageTick: loaded.plan.packageTick,
    pointPackageRevisionId: loaded.plan.pointPackageRevisionId,
    quantity: loaded.plan.quantity,
  });
  if (
    rebuilt.plan.kind !== "END_OF_AUCTION" ||
    rebuilt.plan.rankingInputHash !== loaded.cutoffHash
  ) {
    throw new Error("SETTLEMENT_CUTOFF_MISMATCH");
  }
  const clearing = clearAuction({
    excludedUserIds: new Set(loaded.excludedUserIds),
    positions: loaded.positions,
    saleQuantity: loaded.plan.quantity,
  });
  return clearing.allocations
    .map((allocation) => {
      const pointsConnectionId = loaded.connectionByUser[allocation.marketsUserId] ?? null;
      const reservationKey = `${loaded.settlementId}:${allocation.marketsUserId}:revision_${roundOrdinal}`;
      if (reservationKey.length > 512) throw new Error("RESERVATION_KEY_TOO_LONG");
      return {
        allocationQuantity: allocation.allocatedQuantity,
        marketsUserId: allocation.marketsUserId,
        pointsConnectionId,
        priceTickCount: clearing.clearingPriceTickCount,
        priceTicks: safeProduct(clearing.clearingPriceTickCount, loaded.plan.packageTick),
        reservationKey,
      };
    })
    .sort(
      (left, right) =>
        left.marketsUserId.localeCompare(right.marketsUserId) ||
        left.reservationKey.localeCompare(right.reservationKey),
    );
}

function buyNowWinners(loaded: LoadedSettlementPlan, roundOrdinal: number): RoundWinnerInput[] {
  if (loaded.plan.kind !== "BUY_NOW") throw new Error("BUY_NOW_PLAN_REQUIRED");
  const pointsConnectionId = loaded.connectionByUser[loaded.plan.buyerMarketsUserId] ?? null;
  const reservationKey = `${loaded.settlementId}:${loaded.plan.buyerMarketsUserId}:revision_${roundOrdinal}`;
  if (reservationKey.length > 512) throw new Error("RESERVATION_KEY_TOO_LONG");
  return [
    {
      allocationQuantity: loaded.plan.quantity,
      marketsUserId: loaded.plan.buyerMarketsUserId,
      pointsConnectionId,
      priceTickCount: loaded.plan.priceTickCount,
      priceTicks: safeProduct(loaded.plan.priceTickCount, loaded.plan.packageTick),
      reservationKey,
    },
  ];
}

export async function reserveSettlementRound(
  dependencies: ReserveSettlementRoundDependencies,
  input: {
    planHash: string;
    roundOrdinal: number;
    settlementId: string;
    settlementRevision: number;
  },
): Promise<ReservationRoundResult> {
  const now = dependencies.now().toISOString();
  const loaded = await dependencies.repository.loadPlan(
    input.settlementId,
    input.settlementRevision,
    input.planHash,
  );
  let winners: readonly RoundWinnerInput[];
  try {
    winners =
      loaded.plan.kind === "END_OF_AUCTION"
        ? await endWinners(loaded, input.roundOrdinal)
        : buyNowWinners(loaded, input.roundOrdinal);
  } catch (error) {
    if (error instanceof Error && error.message === "REAUTH_REQUIRED") {
      await dependencies.repository.markManualAction(input.settlementId, "", now);
      return { kind: "MANUAL_ACTION", reason: "REAUTH_REQUIRED" };
    }
    throw error;
  }
  const round = await dependencies.repository.beginOrResumeRound({
    cutoffHash: loaded.cutoffHash,
    excludedUserIds: loaded.excludedUserIds,
    now,
    planHash: input.planHash,
    roundOrdinal: input.roundOrdinal,
    settlementId: input.settlementId,
    winners,
  });
  if (round.state === "RELEASED") {
    return {
      excludedUserIds: round.excludedUserIds,
      kind: "RECALCULATE",
      nextRoundOrdinal: round.roundOrdinal + 1,
    };
  }
  if (round.state === "FAILED") {
    return { kind: "MANUAL_ACTION", reason: "SETTLEMENT_ROUND_FAILED" };
  }
  const active = new Map<string, WinnerReservationReceipt>();
  const failures: {
    failureClass: ReservationFailureClass;
    failureHash: string;
    marketsUserId: string;
    idDefinitelyNotIssued: boolean;
  }[] = [];

  for (const winner of round.winners) {
    if (winner.status === "RELEASED") continue;
    if (winner.status === "REJECTED" && winner.failureClass && winner.failureHash) {
      failures.push({
        failureClass: winner.failureClass,
        failureHash: winner.failureHash,
        idDefinitelyNotIssued: [
          "INSUFFICIENT_BALANCE",
          "INVALID_ACCESS_TOKEN",
          "REAUTH_REQUIRED",
          "REAUTH_REQUIRED_LOCAL",
          "POINTS_USER_INTROSPECTION_INVALID",
          "POINTS_TOKEN_NOT_FOUND",
          "RESERVATION_KEY_NOT_FOUND",
        ].includes(winner.failureCode ?? ""),
        marketsUserId: winner.marketsUserId,
      });
      continue;
    }
    if (
      winner.status === "ACTIVE" &&
      winner.pointReservationId &&
      winner.vectorHash &&
      winner.expiresAt
    ) {
      active.set(winner.marketsUserId, {
        expiresAt: winner.expiresAt,
        pointReservationId: winner.pointReservationId,
        vectorHash: winner.vectorHash,
      });
      continue;
    }
    if (loaded.reauthRequiredUserIds.includes(winner.marketsUserId)) {
      const failure = await classifyReservationFailure(new Error("REAUTH_REQUIRED_LOCAL"), {
        planHash: input.planHash,
        reservationKey: winner.reservationKey,
      });
      await dependencies.repository.recordWinnerFailure({
        failureClass: failure.class,
        failureCode: failure.safeCode,
        failureHash: failure.failureHash,
        marketsUserId: winner.marketsUserId,
        now,
        roundId: round.id,
      });
      failures.push({
        failureClass: failure.class,
        failureHash: failure.failureHash,
        idDefinitelyNotIssued: true,
        marketsUserId: winner.marketsUserId,
      });
      continue;
    }
    await dependencies.repository.recordWinnerAttempt(round.id, winner.marketsUserId, now);
    const request: WinnerReservationRequest = {
      allocationQuantity: winner.allocationQuantity,
      auctionId: loaded.auctionId,
      leaseSeconds: 900,
      marketsUserId: winner.marketsUserId,
      planHash: input.planHash,
      pointPackageRevisionId: loaded.plan.pointPackageRevisionId,
      pointsConnectionId: winner.pointsConnectionId,
      priceTicks: winner.priceTicks,
      reservationKey: winner.reservationKey,
      settlementId: input.settlementId,
    };
    try {
      const receipt = await dependencies.gateway.reserve(request);
      active.set(winner.marketsUserId, receipt);
      await dependencies.repository.recordWinnerReceipt({
        ...receipt,
        marketsUserId: winner.marketsUserId,
        now,
        roundId: round.id,
      });
    } catch (error) {
      let failure = await classifyReservationFailure(error, {
        planHash: input.planHash,
        reservationKey: winner.reservationKey,
      });
      if (failure.class === "TEMPORARY") {
        const status = (await dependencies.gateway.statusByKeys([winner.reservationKey])).find(
          (item) => item.reservationKey === winner.reservationKey,
        );
        if (
          status?.status === "ACTIVE" &&
          status.pointReservationId &&
          status.vectorHash &&
          status.expiresAt
        ) {
          const receipt = {
            expiresAt: status.expiresAt,
            pointReservationId: status.pointReservationId,
            vectorHash: status.vectorHash,
          };
          active.set(winner.marketsUserId, receipt);
          await dependencies.repository.recordWinnerReceipt({
            ...receipt,
            marketsUserId: winner.marketsUserId,
            now,
            roundId: round.id,
          });
          continue;
        }
        try {
          const receipt = await dependencies.gateway.reserve(request);
          active.set(winner.marketsUserId, receipt);
          await dependencies.repository.recordWinnerReceipt({
            ...receipt,
            marketsUserId: winner.marketsUserId,
            now,
            roundId: round.id,
          });
          continue;
        } catch (retryError) {
          failure = await classifyReservationFailure(retryError, {
            planHash: input.planHash,
            reservationKey: winner.reservationKey,
          });
        }
      }
      await dependencies.repository.recordWinnerFailure({
        failureClass: failure.class,
        failureCode: failure.safeCode,
        failureHash: failure.failureHash,
        marketsUserId: winner.marketsUserId,
        now,
        requestId: failure.requestId,
        roundId: round.id,
      });
      failures.push({
        failureClass: failure.class,
        failureHash: failure.failureHash,
        idDefinitelyNotIssued: failure.idDefinitelyNotIssued,
        marketsUserId: winner.marketsUserId,
      });
    }
  }

  if (failures.length === 0) {
    const marked = await dependencies.repository.markReserved(round.id, input.settlementId, now);
    if (!marked) {
      await dependencies.repository.markManualAction(input.settlementId, round.id, now);
      return { kind: "MANUAL_ACTION", reason: "RESERVATION_STATE_DIVERGED" };
    }
    return {
      kind: "RESERVED",
      planHash: input.planHash,
      reservations: [...active].map(([marketsUserId, receipt]) => ({
        marketsUserId,
        pointReservationId: receipt.pointReservationId,
      })),
      roundOrdinal: input.roundOrdinal,
    };
  }

  if (loaded.plan.kind === "BUY_NOW") {
    const failure = failures[0]!;
    if (failure.failureClass === "TEMPORARY") {
      await dependencies.repository.markManualAction(input.settlementId, round.id, now);
      return { kind: "MANUAL_ACTION", reason: "BUY_NOW_RESERVATION_UNKNOWN" };
    }
    if (!failure.idDefinitelyNotIssued) {
      try {
        const statuses = await dependencies.gateway.statusByKeys([
          round.winners[0]!.reservationKey,
        ]);
        const status = statuses.find(
          (item) => item.reservationKey === round.winners[0]!.reservationKey,
        );
        if (status?.status === "NOT_FOUND") {
          await dependencies.repository.confirmNoReservationId(
            round.id,
            failure.marketsUserId,
            now,
          );
        } else {
          await dependencies.repository.markManualAction(input.settlementId, round.id, now);
          return { kind: "MANUAL_ACTION", reason: "BUY_NOW_RESERVATION_UNKNOWN" };
        }
      } catch {
        await dependencies.repository.markManualAction(input.settlementId, round.id, now);
        return { kind: "MANUAL_ACTION", reason: "BUY_NOW_RESERVATION_UNKNOWN" };
      }
    }
    if (
      !(await dependencies.repository.hasNoIssuedReservationEvidence(
        round.id,
        failure.marketsUserId,
        failure.failureHash,
      ))
    ) {
      await dependencies.repository.markManualAction(input.settlementId, round.id, now);
      return { kind: "MANUAL_ACTION", reason: "BUY_NOW_RESERVATION_UNKNOWN" };
    }
    const receipt = await dependencies.buyNowRestorer.restoreBuyNowHold({
      evidenceType: "RESERVATION_REJECTED",
      failureHash: failure.failureHash,
      holdId: loaded.plan.buyNowHoldId,
      settlementId: input.settlementId,
    });
    return { kind: "BUY_NOW_RESTORED", receiptId: receipt.receiptId };
  }

  if (
    failures.some(
      (failure) => failure.failureClass === "CONFLICT" || failure.failureClass === "TEMPORARY",
    )
  ) {
    await dependencies.repository.markManualAction(input.settlementId, round.id, now);
    return { kind: "MANUAL_ACTION", reason: "RESERVATION_RESULT_NOT_RECALCULABLE" };
  }

  for (const [marketsUserId, receipt] of active) {
    const winner = round.winners.find((item) => item.marketsUserId === marketsUserId)!;
    const released = await dependencies.gateway.release({
      planHash: input.planHash,
      pointReservationId: receipt.pointReservationId,
      reservationKey: winner.reservationKey,
    });
    await dependencies.repository.recordRelease({
      ...released,
      marketsUserId,
      now,
      roundId: round.id,
    });
  }
  const exclusions = failures.map((failure) => ({
    failureClass: failure.failureClass as "INSUFFICIENT" | "REAUTH_REQUIRED",
    marketsUserId: failure.marketsUserId,
  }));
  const nextExcludedUserIds = [
    ...new Set([...loaded.excludedUserIds, ...exclusions.map((item) => item.marketsUserId)]),
  ].sort();
  await dependencies.repository.completeReleaseAndExclude({
    auctionId: loaded.auctionId,
    exclusions,
    now,
    roundId: round.id,
    roundOrdinal: input.roundOrdinal,
    settlementId: input.settlementId,
    nextRound: {
      cutoffHash: loaded.cutoffHash,
      excludedUserIds: nextExcludedUserIds,
      planHash: input.planHash,
    },
  });
  return {
    excludedUserIds: nextExcludedUserIds,
    kind: "RECALCULATE",
    nextRoundOrdinal: input.roundOrdinal + 1,
  };
}
