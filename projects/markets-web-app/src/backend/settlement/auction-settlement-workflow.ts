import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { SettlementWorkflowParams } from "./outbox-dispatcher";
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
    throw new NonRetryableError("SETTLEMENT_EXECUTION_NOT_IMPLEMENTED");
  }
}
