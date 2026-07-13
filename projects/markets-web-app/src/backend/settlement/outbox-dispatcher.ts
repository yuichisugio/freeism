export interface SettlementWorkflowParams {
  auctionId: string;
  settlementId: string;
  settlementRevision: number;
  workflowAttempt: number;
  planHash: string;
}

interface OutboxRow extends SettlementWorkflowParams {
  id: string;
  status: "PENDING" | "DISPATCHED";
  workflowInstanceId: string | null;
}

export function settlementWorkflowInstanceId(params: SettlementWorkflowParams): string {
  const id = `settlement-${params.settlementId}-revision-${params.settlementRevision}-attempt-${params.workflowAttempt}`;
  if (id.length > 100) throw new Error("SETTLEMENT_WORKFLOW_ID_TOO_LONG");
  return id;
}

export async function dispatchSettlementOutbox(
  db: D1Database,
  workflow: Workflow<SettlementWorkflowParams>,
  outboxId: string,
): Promise<{ instanceId: string; status: "DISPATCHED" }> {
  const row = await db
    .prepare(
      `SELECT o.id, o.status, o.workflow_instance_id AS workflowInstanceId,
              o.settlement_id AS settlementId, o.settlement_revision AS settlementRevision,
              o.workflow_attempt AS workflowAttempt, o.plan_hash AS planHash,
              s.auction_id AS auctionId
       FROM settlement_outbox o JOIN settlements s ON s.id = o.settlement_id
       WHERE o.id = ?`,
    )
    .bind(outboxId)
    .first<OutboxRow>();
  if (!row) throw new Error("SETTLEMENT_OUTBOX_NOT_FOUND");
  const params: SettlementWorkflowParams = {
    auctionId: row.auctionId,
    planHash: row.planHash,
    settlementId: row.settlementId,
    settlementRevision: row.settlementRevision,
    workflowAttempt: row.workflowAttempt,
  };
  const instanceId = settlementWorkflowInstanceId(params);
  if (row.status === "DISPATCHED") {
    if (row.workflowInstanceId !== instanceId)
      throw new Error("SETTLEMENT_OUTBOX_INSTANCE_MISMATCH");
    return { instanceId, status: "DISPATCHED" };
  }

  try {
    await workflow.create({ id: instanceId, params });
  } catch (error) {
    const existing = await workflow.get(instanceId);
    const existingStatus = await existing.status();
    if (existingStatus.status === "unknown") {
      await db
        .prepare(
          `UPDATE settlement_outbox
           SET delivery_attempt_count = delivery_attempt_count + 1,
               last_error_code = 'WORKFLOW_CREATE_FAILED'
           WHERE id = ? AND status = 'PENDING'`,
        )
        .bind(outboxId)
        .run();
      throw error;
    }
  }
  await db
    .prepare(
      `UPDATE settlement_outbox
       SET status = 'DISPATCHED', workflow_instance_id = ?,
           delivery_attempt_count = delivery_attempt_count + 1,
           last_error_code = NULL,
           dispatched_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = 'PENDING'`,
    )
    .bind(instanceId, outboxId)
    .run();
  return { instanceId, status: "DISPATCHED" };
}
