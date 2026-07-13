import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { Bindings } from "../http/context";
import type { SettlementWorkflowParams } from "./outbox-dispatcher";
import { captureAllWinners } from "./capture-all-winners";
import { finalizeSettlement } from "./finalize-settlement";
import { releaseUnusedReservations } from "./release-unused-reservations";
import { reserveSettlementRound } from "./reserve-settlement-round";
import { createSettlementCaptureDependencies } from "./settlement-capture-dependencies";
import { createSettlementReservationDependencies } from "./settlement-dependencies";
import { SETTLEMENT_STEP_POLICIES } from "./settlement-step-policies";

interface PlanValidationRow {
  kind: "END_OF_AUCTION" | "BUY_NOW";
  planHash: string;
  sagaState: string;
  settlementId: string;
  settlementRevision: number;
  workflowAttempt: number;
}

export class AuctionSettlementWorkflow extends WorkflowEntrypoint<Env, SettlementWorkflowParams> {
  async run(event: Readonly<WorkflowEvent<SettlementWorkflowParams>>, step: WorkflowStep) {
    await step.do("validate-plan", SETTLEMENT_STEP_POLICIES.validatePlan, async () => {
      const params = event.payload;
      const row = await this.env.DB.prepare(
        `SELECT s.id AS settlementId, s.kind, s.settlement_revision AS settlementRevision,
                s.workflow_attempt AS workflowAttempt, s.saga_state AS sagaState,
                p.plan_hash AS planHash
         FROM settlements s JOIN settlement_plans p ON p.id = s.current_plan_id
         WHERE s.id = ? AND s.auction_id = ?`,
      )
        .bind(params.settlementId, params.auctionId)
        .first<PlanValidationRow>();
      if (
        !row ||
        row.settlementRevision !== params.settlementRevision ||
        row.workflowAttempt !== params.workflowAttempt ||
        row.planHash !== params.planHash ||
        row.sagaState !== "PLANNED"
      ) {
        throw new NonRetryableError("SETTLEMENT_PLAN_MISMATCH");
      }
      return {
        kind: row.kind,
        planHash: row.planHash,
        sagaState: row.sagaState,
        settlementId: row.settlementId,
        settlementRevision: row.settlementRevision,
      };
    });
    const bindings = this.env as Partial<Bindings>;
    if (
      !bindings.POINTS_SERVICE ||
      !bindings.POINTS_AUDIENCE ||
      !bindings.POINTS_ISSUER ||
      !bindings.POINTS_M2M_CLIENT_ID ||
      !bindings.POINTS_M2M_CLIENT_SECRET ||
      !bindings.POINTS_SETTLEMENT_CLIENT_ID ||
      !bindings.POINTS_SETTLEMENT_CLIENT_SECRET ||
      !bindings.POINTS_USER_CLIENT_ID ||
      !bindings.POINTS_USER_CLIENT_SECRET
    ) {
      throw new NonRetryableError("POINTS_SETTLEMENT_BINDINGS_REQUIRED");
    }
    const captureDependencies = createSettlementCaptureDependencies(bindings as Bindings);
    let roundOrdinal = 1;
    while (true) {
      const result = await step.do(
        `reserve-round-${roundOrdinal}`,
        SETTLEMENT_STEP_POLICIES.reserveRound,
        () =>
          reserveSettlementRound(createSettlementReservationDependencies(bindings as Bindings), {
            planHash: event.payload.planHash,
            roundOrdinal,
            settlementId: event.payload.settlementId,
            settlementRevision: event.payload.settlementRevision,
          }),
      );
      if (result.kind === "RECALCULATE") {
        roundOrdinal = result.nextRoundOrdinal;
        continue;
      }
      if (result.kind === "RESERVED") {
        const captured = await step.do(
          `capture-round-${roundOrdinal}`,
          SETTLEMENT_STEP_POLICIES.capture,
          () =>
            captureAllWinners(captureDependencies, {
              planHash: event.payload.planHash,
              roundOrdinal,
              settlementId: event.payload.settlementId,
              settlementRevision: event.payload.settlementRevision,
            }),
        );
        if (captured.kind === "RECALCULATE") {
          roundOrdinal = captured.nextRoundOrdinal;
          continue;
        }
        if (captured.kind !== "CAPTURED") return captured;
        const finalized = await step.do("forward-finalize", SETTLEMENT_STEP_POLICIES.finalize, () =>
          finalizeSettlement(
            { db: this.env.DB, now: () => new Date() },
            {
              captureReceiptId: captured.receipt.captureReceiptId,
              planHash: event.payload.planHash,
              settlementId: event.payload.settlementId,
            },
          ),
        );
        const buyNow = await this.env.DB.prepare(
          `SELECT json_extract(p.plan_json, '$.buyNowHoldId') AS holdId,
                  a.version AS auctionVersion, c.content_hash AS captureContentHash,
                  pr.id AS proofId, pr.content_hash AS proofContentHash
           FROM settlements s JOIN settlement_plans p ON p.id = s.current_plan_id
           JOIN auctions a ON a.id = s.auction_id
           JOIN settlement_capture_receipts c ON c.settlement_id = s.id
           JOIN proofs pr ON pr.settlement_id = s.id
           WHERE s.id = ? AND s.kind = 'BUY_NOW'`,
        )
          .bind(event.payload.settlementId)
          .first<{
            auctionVersion: number;
            captureContentHash: string;
            holdId: string;
            proofContentHash: string;
            proofId: string;
          }>();
        if (buyNow) {
          await step.do("settle-buy-now-hold", SETTLEMENT_STEP_POLICIES.finalize, async () => {
            const terminal = await this.env.AUCTION_ROOMS.getByName(
              event.payload.auctionId,
            ).settleBuyNowHold({
              auctionId: event.payload.auctionId,
              captureContentHash: buyNow.captureContentHash,
              captureReceiptId: captured.receipt.captureReceiptId,
              expectedAuctionVersion: buyNow.auctionVersion,
              finalizeReceiptId: finalized.finalizeReceiptId,
              holdId: buyNow.holdId,
              proofContentHash: buyNow.proofContentHash,
              proofId: buyNow.proofId,
              serverNow: new Date().toISOString(),
              settlementId: event.payload.settlementId,
            });
            return {
              holdId: terminal.holdId,
              receiptId: terminal.receiptId,
              settledAt: terminal.settledAt,
              settlementId: terminal.settlementId,
              status: terminal.status,
            };
          });
        }
        await step.do("release-unused", SETTLEMENT_STEP_POLICIES.releaseRound, () =>
          releaseUnusedReservations(
            { db: this.env.DB, gateway: captureDependencies.gateway, now: () => new Date() },
            {
              captureReceiptId: captured.receipt.captureReceiptId,
              planHash: event.payload.planHash,
              settlementId: event.payload.settlementId,
            },
          ),
        );
        return finalized;
      }
      return result;
    }
  }
}
