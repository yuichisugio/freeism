import type { CapturedSettlementReceipt } from "./capture-all-winners";
import type { SettlementPlan } from "./create-settlement-plan";

export interface FinalizedSettlementReceipt {
  captureReceiptId: string;
  finalizeReceiptId: string;
  finalizedAt: string;
  proofIds: readonly string[];
  proofSetHash: string;
  settlementId: string;
}

interface CaptureRow extends Omit<CapturedSettlementReceipt, "reservations"> {
  reservationsJson: string;
  settlementRoundId: string;
}

interface WinnerRow {
  allocationQuantity: number;
  buyerDisplayName: string | null;
  buyerMarketsUserId: string;
  componentVectorJson: string | null;
  pointReservationId: string;
  priceTickCount: number;
  priceTicks: number;
  vectorHash: string;
}

interface ContextRow {
  auctionId: string;
  auctionRevisionId: string;
  description: string;
  externalUrl: string;
  kind: "END_OF_AUCTION" | "BUY_NOW";
  planHash: string;
  planJson: string;
  sagaState: string;
  sellerIdentitySnapshotJson: string;
  title: string;
}

interface ExistingFinalizeRow {
  captureReceiptId: string;
  finalizeReceiptId: string;
  finalizedAt: string;
  planHash: string;
  proofIdsJson: string;
  proofSetHash: string;
  settlementId: string;
}

function canonicalVector(value: string | null): string {
  if (!value) throw new Error("SETTLEMENT_COMPONENT_VECTOR_REQUIRED");
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("SETTLEMENT_COMPONENT_VECTOR_INVALID");
  }
  const items = parsed.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("SETTLEMENT_COMPONENT_VECTOR_INVALID");
    }
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.evaluationCriterionId !== "string" ||
      typeof candidate.evaluationCriterionRevisionId !== "string" ||
      typeof candidate.amountScaled !== "string" ||
      !/^(0|[1-9][0-9]*)$/.test(candidate.amountScaled)
    ) {
      throw new Error("SETTLEMENT_COMPONENT_VECTOR_INVALID");
    }
    return {
      amountScaled: candidate.amountScaled,
      evaluationCriterionId: candidate.evaluationCriterionId,
      evaluationCriterionRevisionId: candidate.evaluationCriterionRevisionId,
    };
  });
  items.sort((left, right) =>
    left.evaluationCriterionId.localeCompare(right.evaluationCriterionId),
  );
  return JSON.stringify(items);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalJson(value: unknown): string {
  const canonicalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, canonicalize(child)]),
      );
    }
    return item;
  };
  return JSON.stringify(canonicalize(value));
}

export async function calculateStoredVectorHash(input: {
  componentVectorJson: string;
  pointPackageRevisionId: string;
  priceTicks: number;
  quantity: number;
}): Promise<string> {
  const components = JSON.parse(canonicalVector(input.componentVectorJson)) as unknown;
  return `sha256:${await sha256(
    canonicalJson({
      components,
      pointPackageRevisionId: input.pointPackageRevisionId,
      priceTicks: input.priceTicks,
      quantity: input.quantity,
    }),
  )}`;
}

async function loadExisting(
  db: D1Database,
  input: { captureReceiptId: string; planHash: string; settlementId: string },
): Promise<FinalizedSettlementReceipt | null> {
  const row = await db
    .prepare(
      `SELECT id AS finalizeReceiptId, settlement_id AS settlementId,
              capture_receipt_id AS captureReceiptId, plan_hash AS planHash,
              proof_ids_json AS proofIdsJson, proof_set_hash AS proofSetHash,
              finalized_at AS finalizedAt
       FROM settlement_finalize_receipts WHERE settlement_id = ?`,
    )
    .bind(input.settlementId)
    .first<ExistingFinalizeRow>();
  if (!row) return null;
  if (row.captureReceiptId !== input.captureReceiptId || row.planHash !== input.planHash) {
    throw new Error("SETTLEMENT_FINALIZE_RECEIPT_CONFLICT");
  }
  return {
    captureReceiptId: row.captureReceiptId,
    finalizeReceiptId: row.finalizeReceiptId,
    finalizedAt: row.finalizedAt,
    proofIds: JSON.parse(row.proofIdsJson) as string[],
    proofSetHash: row.proofSetHash,
    settlementId: row.settlementId,
  };
}

export async function finalizeSettlement(
  dependencies: { db: D1Database; now(): Date },
  input: { captureReceiptId: string; planHash: string; settlementId: string },
): Promise<FinalizedSettlementReceipt> {
  const existing = await loadExisting(dependencies.db, input);
  if (existing) return existing;

  const capture = await dependencies.db
    .prepare(
      `SELECT capture_receipt_id AS captureReceiptId, settlement_id AS settlementId,
              settlement_round_id AS settlementRoundId, auction_id AS auctionId,
              plan_hash AS planHash, captured_at AS capturedAt,
              content_hash AS contentHash, reservations_json AS reservationsJson
       FROM settlement_capture_receipts WHERE settlement_id = ?`,
    )
    .bind(input.settlementId)
    .first<CaptureRow>();
  if (
    !capture ||
    capture.captureReceiptId !== input.captureReceiptId ||
    capture.planHash !== input.planHash
  ) {
    throw new Error("SETTLEMENT_CAPTURE_RECEIPT_MISMATCH");
  }
  const context = await dependencies.db
    .prepare(
      `SELECT s.auction_id AS auctionId, s.kind, s.saga_state AS sagaState,
              p.plan_hash AS planHash, p.plan_json AS planJson,
              ar.id AS auctionRevisionId, ar.title, ar.description,
              ar.external_url AS externalUrl,
              ar.seller_identity_snapshot AS sellerIdentitySnapshotJson
       FROM settlements s
       JOIN settlement_plans p ON p.id = s.current_plan_id
       JOIN auction_revisions ar ON ar.id = json_extract(p.plan_json, '$.auctionRevisionId')
       WHERE s.id = ?`,
    )
    .bind(input.settlementId)
    .first<ContextRow>();
  if (!context || context.planHash !== input.planHash || context.sagaState !== "CAPTURED") {
    throw new Error("SETTLEMENT_FINALIZE_STATE_MISMATCH");
  }
  const plan = JSON.parse(context.planJson) as SettlementPlan;
  const winners = await dependencies.db
    .prepare(
      `SELECT w.markets_user_id AS buyerMarketsUserId,
              w.point_reservation_id AS pointReservationId,
              w.allocation_quantity AS allocationQuantity,
              w.price_tick_count AS priceTickCount, w.price_ticks AS priceTicks,
              w.vector_hash AS vectorHash, w.component_vector_json AS componentVectorJson,
              u.name AS buyerDisplayName
       FROM settlement_round_winners w
       JOIN markets_user mu ON mu.id = w.markets_user_id
       JOIN user u ON u.id = mu.auth_user_id
       WHERE w.settlement_round_id = ? AND w.status = 'CAPTURED'
       ORDER BY w.point_reservation_id`,
    )
    .bind(capture.settlementRoundId)
    .all<WinnerRow>();
  const capturedReservations = JSON.parse(
    capture.reservationsJson,
  ) as CapturedSettlementReceipt["reservations"];
  if (
    winners.results.length === 0 ||
    winners.results.length !== capturedReservations.length ||
    winners.results.some((winner, index) => {
      const item = capturedReservations[index];
      return (
        !item ||
        item.status !== "CAPTURED" ||
        item.pointReservationId !== winner.pointReservationId ||
        item.vectorHash !== winner.vectorHash
      );
    })
  ) {
    throw new Error("SETTLEMENT_FINALIZE_WINNER_MISMATCH");
  }

  const finalizedAt = dependencies.now().toISOString();
  const statements: D1PreparedStatement[] = [];
  const proofIds: string[] = [];
  const proofHashes: { contentHash: string; proofId: string }[] = [];
  for (const [index, winner] of winners.results.entries()) {
    const ordinal = index + 1;
    const allocationId = `allocation:${input.settlementId}:${ordinal}`;
    const proofId = `proof:${input.settlementId}:${ordinal}`;
    const componentVectorJson = canonicalVector(winner.componentVectorJson);
    const calculatedVectorHash = await calculateStoredVectorHash({
      componentVectorJson,
      pointPackageRevisionId: plan.pointPackageRevisionId,
      priceTicks: winner.priceTicks,
      quantity: winner.allocationQuantity,
    });
    if (
      winner.vectorHash !== calculatedVectorHash &&
      winner.vectorHash !== calculatedVectorHash.slice("sha256:".length)
    ) {
      throw new Error("SETTLEMENT_COMPONENT_VECTOR_HASH_MISMATCH");
    }
    const itemSnapshotJson = JSON.stringify({
      description: context.description,
      externalUrl: context.externalUrl,
      title: context.title,
    });
    const sellerIdentitySnapshotJson = JSON.stringify(
      JSON.parse(context.sellerIdentitySnapshotJson) as unknown,
    );
    const buyerIdentitySnapshotJson = JSON.stringify({
      displayName: winner.buyerDisplayName ?? "",
      marketsUserId: winner.buyerMarketsUserId,
    });
    const proofBody = {
      allocationId,
      allocationQuantity: winner.allocationQuantity,
      auctionId: context.auctionId,
      auctionRevisionId: context.auctionRevisionId,
      buyerIdentitySnapshot: JSON.parse(buyerIdentitySnapshotJson) as unknown,
      buyerMarketsUserId: winner.buyerMarketsUserId,
      completionStatus: "SETTLED",
      componentVector: JSON.parse(componentVectorJson) as unknown,
      itemSnapshot: JSON.parse(itemSnapshotJson) as unknown,
      planHash: input.planHash,
      pointPackageRevisionId: plan.pointPackageRevisionId,
      priceTicks: winner.priceTicks,
      sellerIdentitySnapshot: JSON.parse(sellerIdentitySnapshotJson) as unknown,
      settledAt: finalizedAt,
      settlementId: input.settlementId,
      uniformPriceTickCount: winner.priceTickCount,
    };
    const contentHash = await sha256(JSON.stringify(proofBody));
    proofIds.push(proofId);
    proofHashes.push({ contentHash, proofId });
    statements.push(
      dependencies.db
        .prepare(
          `INSERT INTO settlement_allocations
           (id, settlement_id, settlement_round_id, allocation_ordinal, auction_id,
            buyer_markets_user_id, point_reservation_id, quantity,
            uniform_price_tick_count, price_ticks, vector_hash, settled_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          allocationId,
          input.settlementId,
          capture.settlementRoundId,
          ordinal,
          context.auctionId,
          winner.buyerMarketsUserId,
          winner.pointReservationId,
          winner.allocationQuantity,
          winner.priceTickCount,
          winner.priceTicks,
          winner.vectorHash,
          finalizedAt,
          finalizedAt,
        ),
      dependencies.db
        .prepare(
          `INSERT INTO proofs
           (id, allocation_id, settlement_id, auction_id, auction_revision_id,
            buyer_markets_user_id, point_package_revision_id, item_snapshot_json,
            seller_identity_snapshot_json, buyer_identity_snapshot_json,
            allocation_quantity, uniform_price_tick_count, price_ticks,
            component_vector_json, completion_status, settled_at, plan_hash,
            content_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SETTLED', ?, ?, ?, ?)`,
        )
        .bind(
          proofId,
          allocationId,
          input.settlementId,
          context.auctionId,
          context.auctionRevisionId,
          winner.buyerMarketsUserId,
          plan.pointPackageRevisionId,
          itemSnapshotJson,
          sellerIdentitySnapshotJson,
          buyerIdentitySnapshotJson,
          winner.allocationQuantity,
          winner.priceTickCount,
          winner.priceTicks,
          componentVectorJson,
          finalizedAt,
          input.planHash,
          contentHash,
          finalizedAt,
        ),
    );
  }
  const proofSetHash = await sha256(JSON.stringify(proofHashes));
  const finalizeReceiptId = `finalize:${input.settlementId}`;
  statements.push(
    dependencies.db
      .prepare(
        `INSERT INTO settlement_finalize_receipts
         (id, settlement_id, capture_receipt_id, plan_hash, proof_ids_json,
          proof_set_hash, finalized_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        finalizeReceiptId,
        input.settlementId,
        input.captureReceiptId,
        input.planHash,
        JSON.stringify(proofIds),
        proofSetHash,
        finalizedAt,
        finalizedAt,
      ),
    dependencies.db
      .prepare(
        `UPDATE settlements SET saga_state = 'SETTLED', updated_at = ?
         WHERE id = ? AND saga_state = 'CAPTURED'`,
      )
      .bind(finalizedAt, input.settlementId),
  );
  if (context.kind === "END_OF_AUCTION") {
    statements.push(
      dependencies.db
        .prepare(
          `UPDATE auctions SET status = 'SETTLED', version = version + 1, updated_at = ?
           WHERE id = ? AND status IN ('CLOSING', 'SETTLING')`,
        )
        .bind(finalizedAt, context.auctionId),
    );
  }
  await dependencies.db.batch(statements);
  return {
    captureReceiptId: input.captureReceiptId,
    finalizeReceiptId,
    finalizedAt,
    proofIds,
    proofSetHash,
    settlementId: input.settlementId,
  };
}
