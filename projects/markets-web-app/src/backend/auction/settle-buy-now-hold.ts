export interface SettleBuyNowHoldInput {
  auctionId: string;
  captureContentHash: string;
  captureReceiptId: string;
  expectedAuctionVersion: number;
  finalizeReceiptId: string;
  holdId: string;
  proofContentHash: string;
  proofId: string;
  serverNow: string;
  settlementId: string;
}

export interface BuyNowTerminalReceipt {
  holdId: string;
  receiptId: string;
  settledAt: string;
  settlementId: string;
  status: "SETTLED";
}

interface SettleRow {
  auctionVersion: number;
  buyerMarketsUserId: string;
  captureContentHash: string;
  captureReceiptId: string;
  finalizeReceiptId: string;
  holdStatus: string;
  proofContentHash: string;
  proofId: string;
  proofQuantity: number;
  proofTickCount: number;
  quantity: number;
  settledAt: string;
  settlementId: string;
}

export async function settleBuyNowHold(
  db: D1Database,
  input: SettleBuyNowHoldInput,
): Promise<BuyNowTerminalReceipt> {
  const row = await db
    .prepare(
      `SELECT h.status AS holdStatus, h.quantity, h.buy_now_price_tick_count AS proofTickCount,
              h.updated_at AS settledAt,
              h.buyer_markets_user_id AS buyerMarketsUserId, a.version AS auctionVersion,
              s.id AS settlementId, c.capture_receipt_id AS captureReceiptId,
              c.content_hash AS captureContentHash, f.id AS finalizeReceiptId,
              p.id AS proofId, p.content_hash AS proofContentHash,
              p.allocation_quantity AS proofQuantity
       FROM buy_now_holds h
       JOIN auctions a ON a.id = h.auction_id
       JOIN settlements s ON s.auction_id = h.auction_id AND s.kind = 'BUY_NOW'
       JOIN settlement_plans sp ON sp.id = s.current_plan_id
         AND json_extract(sp.plan_json, '$.buyNowHoldId') = h.id
       JOIN settlement_capture_receipts c ON c.settlement_id = s.id
       JOIN settlement_finalize_receipts f ON f.settlement_id = s.id
       JOIN proofs p ON p.settlement_id = s.id
         AND p.buyer_markets_user_id = h.buyer_markets_user_id
       WHERE h.id = ? AND h.auction_id = ? AND s.id = ?`,
    )
    .bind(input.holdId, input.auctionId, input.settlementId)
    .first<SettleRow>();
  if (!row) throw new Error("BUY_NOW_SETTLEMENT_PROOF_NOT_FOUND");
  if (
    row.auctionVersion !== input.expectedAuctionVersion ||
    row.captureReceiptId !== input.captureReceiptId ||
    row.captureContentHash !== input.captureContentHash ||
    row.finalizeReceiptId !== input.finalizeReceiptId ||
    row.proofId !== input.proofId ||
    row.proofContentHash !== input.proofContentHash ||
    row.proofQuantity !== row.quantity
  ) {
    throw new Error("BUY_NOW_SETTLEMENT_PROOF_MISMATCH");
  }
  if (row.holdStatus === "FAILED_RESTORED") {
    throw new Error("BUY_NOW_HOLD_ALREADY_RESTORED");
  }
  const settledAt = row.holdStatus === "SETTLED" ? row.settledAt : input.serverNow;
  const [changed] = await db.batch([
    db
      .prepare(
        `UPDATE buy_now_holds SET status = 'SETTLED', updated_at = ?
         WHERE id = ? AND status = 'CAPTURED_PENDING_FINALIZE'`,
      )
      .bind(input.serverNow, input.holdId),
    db
      .prepare(
        `INSERT OR IGNORE INTO auction_close_resume_outbox
         (id, auction_id, buy_now_hold_id, status, created_at)
         SELECT ?, h.auction_id, h.id, 'PENDING', ?
         FROM buy_now_holds h JOIN auctions a ON a.id = h.auction_id
         WHERE h.id = ? AND h.status = 'SETTLED' AND a.status = 'CLOSING'
           AND EXISTS (SELECT 1 FROM auction_close_cutoffs c WHERE c.auction_id = h.auction_id)`,
      )
      .bind(`close_resume_${input.holdId}`, input.serverNow, input.holdId),
  ]);
  if (row.holdStatus !== "SETTLED" && changed?.meta.changes !== 1) {
    throw new Error("BUY_NOW_HOLD_SETTLE_CONFLICT");
  }
  return {
    holdId: input.holdId,
    receiptId: `buy-now-settle:${input.holdId}:${input.proofId}`,
    settledAt,
    settlementId: input.settlementId,
    status: "SETTLED",
  };
}
