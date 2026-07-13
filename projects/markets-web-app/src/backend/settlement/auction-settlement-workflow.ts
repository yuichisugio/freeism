import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { Bindings } from "../http/context";
import type { SettlementWorkflowParams } from "./outbox-dispatcher";
import { reserveSettlementRound } from "./reserve-settlement-round";
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
    let roundOrdinal = 1;
    while (true) {
      const result = await step.do(
        `reserve-round-${roundOrdinal}`,
        SETTLEMENT_STEP_POLICIES.reserveRound,
        () =>
          reserveSettlementRound(
            createSettlementReservationDependencies(bindings as Bindings),
            {
              planHash: event.payload.planHash,
              roundOrdinal,
              settlementId: event.payload.settlementId,
              settlementRevision: event.payload.settlementRevision,
            },
          ),
      );
      if (result.kind === "RECALCULATE") {
        roundOrdinal = result.nextRoundOrdinal;
        continue;
      }
      if (result.kind === "RESERVED") {
        throw new NonRetryableError("CAPTURE_NOT_IMPLEMENTED");
      }
      return result;
    }
  }
}
