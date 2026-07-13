import type { AuctionCommandDecision } from "../auction/domain/auction-command";
import type { AutoBidPosition } from "../auction/domain/resolve-auto-bids";
import type {
  AuctionCommandResult,
  ExecuteAuctionCommandInput,
  ExecutedAuctionCommand,
} from "../auction/execute-auction-command";
import type { AuctionRoomEvent } from "../auction/auction-room";

export interface AuctionCommandAggregate {
  auctionId: string;
  availableQuantity: number;
  buyNowPriceTickCount: number | null;
  currentRevisionId: string;
  endsAt: string;
  lastBidSeq: number;
  positions: AutoBidPosition[];
  quantity: number;
  revisionNumber: number;
  sellerMarketsUserId: string;
  status: string;
  version: number;
}

export interface AuctionCommandCommit {
  aggregate: AuctionCommandAggregate;
  decision: AuctionCommandDecision;
  holdId: string | null;
  input: ExecuteAuctionCommandInput;
  result: AuctionCommandResult;
  settlementId: string | null;
}

type ReplayLookup =
  | { kind: "MISS" }
  | { kind: "CONFLICT" }
  | { kind: "REPLAY"; result: AuctionCommandResult };

interface ReplayRow {
  actorMarketsUserId?: string;
  operation?: string;
  payloadHash: string;
  responseBody: string | null;
  state?: string;
}

function operation(input: ExecuteAuctionCommandInput) {
  return input.command.kind;
}

export class D1AuctionCommandRepository {
  constructor(private readonly db: D1Database) {}

  async findReplay(
    actorMarketsUserId: string,
    operationName: string,
    idempotencyKey: string,
    payloadHash: string,
    auctionId: string,
    commandId: string,
  ): Promise<ReplayLookup> {
    const idempotency = await this.db
      .prepare(
        `SELECT payload_hash AS payloadHash, state, response_body AS responseBody
         FROM idempotency_results
         WHERE actor_markets_user_id = ? AND operation = ? AND idempotency_key = ?`,
      )
      .bind(actorMarketsUserId, operationName, idempotencyKey)
      .first<ReplayRow>();
    if (idempotency) {
      if (idempotency.payloadHash !== payloadHash) return { kind: "CONFLICT" };
      if (idempotency.state === "COMPLETED" && idempotency.responseBody) {
        return { kind: "REPLAY", result: JSON.parse(idempotency.responseBody) };
      }
      return { kind: "CONFLICT" };
    }
    const command = await this.db
      .prepare(
        `SELECT actor_markets_user_id AS actorMarketsUserId, payload_hash AS payloadHash,
                operation, response_body AS responseBody
         FROM auction_commands WHERE auction_id = ? AND command_id = ?`,
      )
      .bind(auctionId, commandId)
      .first<ReplayRow>();
    if (!command) return { kind: "MISS" };
    if (
      command.actorMarketsUserId !== actorMarketsUserId ||
      command.operation !== operationName ||
      command.payloadHash !== payloadHash ||
      !command.responseBody
    ) {
      return { kind: "CONFLICT" };
    }
    return { kind: "REPLAY", result: JSON.parse(command.responseBody) };
  }

  async hasActivePointsConnection(marketsUserId: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        "SELECT 1 AS active FROM points_connection WHERE markets_user_id = ? AND status = 'ACTIVE'",
      )
      .bind(marketsUserId)
      .first<{ active: number }>();
    return row?.active === 1;
  }

  async loadForCommand(auctionId: string): Promise<AuctionCommandAggregate | null> {
    const row = await this.db
      .prepare(
        `SELECT a.id AS auctionId, a.seller_markets_user_id AS sellerMarketsUserId,
                a.current_revision_id AS currentRevisionId, a.status, a.version,
                r.revision_number AS revisionNumber, r.quantity, r.ends_at AS endsAt,
                r.buy_now_price_tick_count AS buyNowPriceTickCount,
                COALESCE((SELECT MAX(bid_seq) FROM bid_events WHERE auction_id = a.id), 0) AS lastBidSeq,
                r.quantity - COALESCE((SELECT SUM(quantity) FROM buy_now_holds
                  WHERE auction_id = a.id AND status IN ('PENDING','CAPTURED_PENDING_FINALIZE','SETTLED')), 0)
                  AS availableQuantity
         FROM auctions a JOIN auction_revisions r ON r.id = a.current_revision_id
         WHERE a.id = ?`,
      )
      .bind(auctionId)
      .first<Omit<AuctionCommandAggregate, "positions">>();
    if (!row) return null;
    const positions = await this.db
      .prepare(
        `SELECT p.bidder_markets_user_id AS marketsUserId, p.quantity,
                p.price_tick_count AS priceTickCount, p.reached_sequence AS reachedSequence,
                CASE WHEN r.active = 1 THEN r.auto_bid_max_tick_count ELSE NULL END AS autoBidMaxTickCount
         FROM bid_positions p
         LEFT JOIN auto_bid_rules r
           ON r.auction_id = p.auction_id AND r.bidder_markets_user_id = p.bidder_markets_user_id
         WHERE p.auction_id = ? AND p.status = 'ACTIVE'`,
      )
      .bind(auctionId)
      .all<AutoBidPosition>();
    return { ...row, positions: positions.results };
  }

  async commit(commit: AuctionCommandCommit): Promise<ExecutedAuctionCommand> {
    const { aggregate, decision, input, result } = commit;
    const now = input.serverNow;
    const responseBody = JSON.stringify(result);
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT INTO auction_commands
           (id, auction_id, command_id, actor_markets_user_id, operation, payload_hash,
            expected_auction_version, status, response_body)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`,
        )
        .bind(
          `ac_${crypto.randomUUID()}`,
          input.auctionId,
          input.commandId,
          input.actor.marketsUserId,
          operation(input),
          input.payloadHash,
          input.expectedAuctionVersion,
          responseBody,
        ),
    ];

    const publicEvents: AuctionRoomEvent[] = [];
    if (input.command.kind === "PLACE_BID") {
      const position = decision.positions.find(
        (candidate) => candidate.marketsUserId === input.actor.marketsUserId,
      );
      if (!position) throw new Error("BID_POSITION_MISSING");
      statements.push(
        this.db
          .prepare(
            `INSERT INTO bid_positions
             (id, auction_id, bidder_markets_user_id, quantity, price_tick_count,
              reached_sequence, status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
             ON CONFLICT(auction_id, bidder_markets_user_id) DO UPDATE SET
               quantity=excluded.quantity, price_tick_count=excluded.price_tick_count,
               reached_sequence=excluded.reached_sequence, status='ACTIVE', updated_at=excluded.updated_at`,
          )
          .bind(
            `bp_${crypto.randomUUID()}`,
            input.auctionId,
            input.actor.marketsUserId,
            position.quantity,
            position.priceTickCount,
            position.reachedSequence,
            now,
          ),
        this.db
          .prepare(
            `INSERT INTO auto_bid_rules
             (id, auction_id, bidder_markets_user_id, quantity, auto_bid_max_tick_count,
              active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)
             ON CONFLICT(auction_id, bidder_markets_user_id) DO UPDATE SET
               quantity=excluded.quantity, auto_bid_max_tick_count=excluded.auto_bid_max_tick_count,
               active=1, updated_at=excluded.updated_at`,
          )
          .bind(
            `abr_${crypto.randomUUID()}`,
            input.auctionId,
            input.actor.marketsUserId,
            position.quantity,
            position.autoBidMaxTickCount ?? position.priceTickCount,
            now,
            now,
          ),
      );
      const event = decision.publicEvents[0];
      if (event) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO bid_events
               (id, auction_id, bid_seq, bidder_markets_user_id, command_id,
                event_type, quantity, price_tick_count, created_at)
               VALUES (?, ?, ?, ?, ?, 'BID_POSITION_UPDATED', ?, ?, ?)`,
            )
            .bind(
              `be_${crypto.randomUUID()}`,
              input.auctionId,
              result.kind === "BID_ACCEPTED" ? result.bidSeq : aggregate.lastBidSeq + 1,
              input.actor.marketsUserId,
              input.commandId,
              event.quantity,
              event.priceTickCount,
              now,
            ),
        );
        publicEvents.push({
          auctionId: input.auctionId,
          auctionVersion: result.auctionVersion,
          bidSeq: result.kind === "BID_ACCEPTED" ? result.bidSeq : aggregate.lastBidSeq + 1,
          data: {
            bidderMarketsUserId: input.actor.marketsUserId,
            priceTickCount: event.priceTickCount,
            quantity: event.quantity,
          },
          occurredAt: now,
          type: "auction.bid.updated",
        });
      }
    } else if (input.command.kind === "CANCEL_AUTO_BID") {
      statements.push(
        this.db
          .prepare(
            `UPDATE auto_bid_rules SET active = 0, updated_at = ?
             WHERE auction_id = ? AND bidder_markets_user_id = ?`,
          )
          .bind(now, input.auctionId, input.actor.marketsUserId),
      );
      publicEvents.push({
        auctionId: input.auctionId,
        auctionVersion: result.auctionVersion,
        bidSeq: aggregate.lastBidSeq,
        data: { bidderMarketsUserId: input.actor.marketsUserId },
        occurredAt: now,
        type: "auction.auto-bid.cancelled",
      });
    } else {
      const buyNow = decision.buyNow;
      if (!buyNow?.accepted || !commit.holdId || !commit.settlementId) {
        throw new Error("BUY_NOW_COMMIT_INPUT_MISSING");
      }
      const plan = {
        auctionId: input.auctionId,
        auctionRevisionId: aggregate.currentRevisionId,
        buyerMarketsUserId: input.actor.marketsUserId,
        holdId: commit.holdId,
        kind: "BUY_NOW",
        priceTickCount: buyNow.hold.priceTickCount,
        quantity: buyNow.hold.quantity,
      };
      statements.push(
        this.db
          .prepare(
            `INSERT INTO buy_now_holds
             (id, auction_id, buyer_markets_user_id, quantity, buy_now_price_tick_count,
              status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
          )
          .bind(
            commit.holdId,
            input.auctionId,
            input.actor.marketsUserId,
            buyNow.hold.quantity,
            buyNow.hold.priceTickCount,
            now,
            now,
          ),
        this.db
          .prepare(
            `INSERT INTO settlement_plans
             (id, auction_id, auction_revision_id, kind, command_id, buy_now_hold_id,
              buyer_markets_user_id, quantity, price_tick_count, plan_json, status, created_at)
             VALUES (?, ?, ?, 'BUY_NOW', ?, ?, ?, ?, ?, ?, 'PLANNED', ?)`,
          )
          .bind(
            commit.settlementId,
            input.auctionId,
            aggregate.currentRevisionId,
            input.commandId,
            commit.holdId,
            input.actor.marketsUserId,
            buyNow.hold.quantity,
            buyNow.hold.priceTickCount,
            JSON.stringify(plan),
            now,
          ),
        this.db
          .prepare(
            `INSERT INTO settlement_outbox
             (id, settlement_id, workflow_attempt, status, created_at)
             VALUES (?, ?, 0, 'PENDING', ?)`,
          )
          .bind(`outbox_${crypto.randomUUID()}`, commit.settlementId, now),
      );
      publicEvents.push({
        auctionId: input.auctionId,
        auctionVersion: result.auctionVersion,
        bidSeq: aggregate.lastBidSeq,
        data: { state: "PENDING" },
        occurredAt: now,
        type: "auction.buy-now.pending",
      });
    }

    statements.push(
      this.db
        .prepare(
          `UPDATE auctions SET version = version + 1, updated_at = ?
           WHERE id = ? AND status = 'OPEN' AND version = ?`,
        )
        .bind(now, input.auctionId, input.expectedAuctionVersion),
      this.db
        .prepare(
          `INSERT INTO idempotency_results
           (id, actor_markets_user_id, operation, idempotency_key, payload_hash, state,
            response_status, response_body, response_content_type, completed_at)
           VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?, 'application/json', ?)`,
        )
        .bind(
          `idem_${crypto.randomUUID()}`,
          input.actor.marketsUserId,
          operation(input),
          input.idempotencyKey,
          input.payloadHash,
          result.kind === "BUY_NOW_PENDING" ? 202 : 200,
          responseBody,
          now,
        ),
      this.db
        .prepare(
          `INSERT INTO audit_events
           (id, actor_markets_user_id, event_code, target_type, target_id, after_json,
            request_id, environment, result, created_at)
           VALUES (?, ?, ?, 'AUCTION', ?, ?, ?, ?, 'SUCCESS', ?)`,
        )
        .bind(
          `audit_${crypto.randomUUID()}`,
          input.actor.marketsUserId,
          `AUCTION_${operation(input)}`,
          input.auctionId,
          responseBody,
          `req_${crypto.randomUUID()}`,
          "worker",
          now,
        ),
    );
    await this.db.batch(statements);
    return { publicEvents, replayed: false, result };
  }
}
