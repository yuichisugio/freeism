import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import { sha256Hex } from "../csv/csv-validation-result";
import type { CreateAccountsRecipientResolver } from "../identity/accounts-recipient-resolver";
import {
  commitFixRows,
  findFixCommitReplay,
  type CommittedFixResult,
} from "../infrastructure/db/d1-fix-repository";
import { validateFixCsv } from "./validate-fix-csv";

/**
 * 検証済みの FIX CSV を確定する。
 * 確定の直前に Accounts で再照合し、検証時と結果が変わった場合や照合できなかった場合は `VALIDATION_CHANGED` で全件を止める。
 * @see ../../../docs/v0.2/details-ja/unclaimed-fix-and-ownership.md
 * @see ../../../test/worker/fix-ledger.worker.test.ts
 */
export async function commitFixCsv(
  db: D1Database,
  bytes: Uint8Array,
  input: {
    accountsConnectionId: string;
    actorPointsUserId: string;
    createResolver: CreateAccountsRecipientResolver;
    expectedValidationHash: string;
    idempotencyKey: string;
    now?: Date;
    reason: string;
  },
): Promise<{
  replay: boolean;
  responseBody: unknown;
  results: CommittedFixResult[];
  status: number;
}> {
  const preflightPayloadHash = await hashCanonicalPayload({
    fileHash: await sha256Hex(bytes),
    reason: input.reason,
    validationHash: input.expectedValidationHash,
  });
  const saved = await findFixCommitReplay(
    db,
    input.actorPointsUserId,
    input.idempotencyKey,
    preflightPayloadHash,
  );
  if (saved) return { replay: true, responseBody: saved.body, results: [], status: saved.status };
  const validated = await validateFixCsv(db, bytes, {
    accountsConnectionId: input.accountsConnectionId,
    createResolver: input.createResolver,
  });
  if (validated.status === "INVALID")
    throw Object.assign(new Error("CSV_VALIDATION_FAILED"), { errors: validated.errors });
  if (
    validated.status === "UNRESOLVED" ||
    validated.validationHash !== input.expectedValidationHash
  )
    throw new Error("VALIDATION_CHANGED");
  const now = input.now ?? new Date();
  const committed = await commitFixRows(db, {
    accountsConnectionId: validated.accountsConnectionId,
    actorPointsUserId: input.actorPointsUserId,
    auditEventId: `audit_${crypto.randomUUID()}`,
    fileHash: validated.fileHash,
    idempotencyKey: input.idempotencyKey,
    now,
    reason: input.reason,
    requestId: `req_${crypto.randomUUID()}`,
    rows: validated.rows,
    validationHash: validated.validationHash,
  });
  return {
    replay: false,
    responseBody: committed.responseBody,
    results: committed.results,
    status: 201,
  };
}
