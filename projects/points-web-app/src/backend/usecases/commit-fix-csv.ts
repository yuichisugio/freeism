import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import { sha256Hex } from "../csv/csv-validation-result";
import {
  commitFixRows,
  findFixCommitReplay,
  type CommittedFixResult,
} from "../infrastructure/db/d1-fix-repository";
import { validateFixCsv } from "./validate-fix-csv";

export async function commitFixCsv(
  db: D1Database,
  bytes: Uint8Array,
  input: {
    actorPointsUserId: string;
    expectedValidationHash: string;
    githubClientId: string;
    githubClientSecret: string;
    githubFetch?: typeof fetch;
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
    githubClientId: input.githubClientId,
    githubClientSecret: input.githubClientSecret,
    githubFetch: input.githubFetch,
    now: input.now,
  });
  if (validated.errors.length > 0)
    throw Object.assign(new Error("CSV_VALIDATION_FAILED"), { errors: validated.errors });
  if (validated.validationHash !== input.expectedValidationHash)
    throw new Error("VALIDATION_CHANGED");
  const now = input.now ?? new Date();
  const committed = await commitFixRows(db, {
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
