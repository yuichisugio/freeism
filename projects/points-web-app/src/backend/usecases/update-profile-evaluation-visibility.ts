import {
  findProfileMutationReplay,
  profileMutationPayloadHash,
} from "./profile-mutation-idempotency";

const OPERATION = "profile-evaluation-visibility-update";

export type EvaluationVisibility = "PUBLIC" | "PRIVATE";

export interface EvaluationVisibilityDto {
  balance: EvaluationVisibility;
  evaluationTotal: EvaluationVisibility;
  fix: EvaluationVisibility;
  transfer: EvaluationVisibility;
  exchange: EvaluationVisibility;
}

export interface EvaluationVisibilityPatch {
  balance?: EvaluationVisibility;
  evaluationTotal?: EvaluationVisibility;
  fix?: EvaluationVisibility;
  transfer?: EvaluationVisibility;
  exchange?: EvaluationVisibility;
}

export class FreshGoogleAuthRequiredError extends Error {
  constructor() {
    super("FRESH_GOOGLE_AUTH_REQUIRED");
  }
}

interface VisibilityMutationInput {
  pointsUserId: string;
  evaluationCriterionId: string;
  visibility: EvaluationVisibilityPatch;
  balanceVisibleByDefault: boolean;
  allowPublicExpansion: boolean;
}

const visibilityKeys = ["balance", "evaluationTotal", "fix", "transfer", "exchange"] as const;

function defaults(balanceVisibleByDefault: boolean): EvaluationVisibilityDto {
  return {
    balance: balanceVisibleByDefault ? "PUBLIC" : "PRIVATE",
    evaluationTotal: "PRIVATE",
    fix: "PRIVATE",
    transfer: "PRIVATE",
    exchange: "PRIVATE",
  };
}

function validatePatch(patch: EvaluationVisibilityPatch): void {
  for (const key of visibilityKeys) {
    const value = patch[key];
    if (value !== undefined && value !== "PUBLIC" && value !== "PRIVATE") {
      throw new Error("INVALID_EVALUATION_VISIBILITY");
    }
  }
}

export function isEvaluationVisibilityExpansion(
  previous: EvaluationVisibilityDto,
  next: EvaluationVisibilityDto,
): boolean {
  return visibilityKeys.some((key) => previous[key] === "PRIVATE" && next[key] === "PUBLIC");
}

export async function getProfileEvaluationVisibility(
  db: D1Database,
  input: {
    pointsUserId: string;
    evaluationCriterionId: string;
    balanceVisibleByDefault: boolean;
  },
): Promise<EvaluationVisibilityDto> {
  const row = await db
    .prepare(
      `SELECT balance_visibility AS balance,
              evaluation_total_visibility AS evaluationTotal,
              fix_visibility AS fix,
              transfer_visibility AS transfer,
              exchange_visibility AS exchange
       FROM profile_evaluation_visibility
       WHERE points_user_id = ? AND evaluation_criterion_id = ?`,
    )
    .bind(input.pointsUserId, input.evaluationCriterionId)
    .first<EvaluationVisibilityDto>();
  return row ?? defaults(input.balanceVisibleByDefault);
}

function prepareVisibilityMutation(db: D1Database, input: VisibilityMutationInput) {
  const initial = defaults(input.balanceVisibleByDefault);
  const nextForInsert = { ...initial, ...input.visibility };
  const patchValues = visibilityKeys.map((key) => input.visibility[key] ?? null);
  return db
    .prepare(
      `INSERT INTO profile_evaluation_visibility
         (id, points_user_id, evaluation_criterion_id, balance_visibility,
          evaluation_total_visibility, fix_visibility, transfer_visibility, exchange_visibility)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?
       WHERE ? = 1 OR ? = 0
       ON CONFLICT(points_user_id, evaluation_criterion_id) DO UPDATE SET
         balance_visibility = COALESCE(?, profile_evaluation_visibility.balance_visibility),
         evaluation_total_visibility = COALESCE(?, profile_evaluation_visibility.evaluation_total_visibility),
         fix_visibility = COALESCE(?, profile_evaluation_visibility.fix_visibility),
         transfer_visibility = COALESCE(?, profile_evaluation_visibility.transfer_visibility),
         exchange_visibility = COALESCE(?, profile_evaluation_visibility.exchange_visibility)
       WHERE ? = 1 OR NOT (
         (profile_evaluation_visibility.balance_visibility = 'PRIVATE' AND ? = 'PUBLIC') OR
         (profile_evaluation_visibility.evaluation_total_visibility = 'PRIVATE' AND ? = 'PUBLIC') OR
         (profile_evaluation_visibility.fix_visibility = 'PRIVATE' AND ? = 'PUBLIC') OR
         (profile_evaluation_visibility.transfer_visibility = 'PRIVATE' AND ? = 'PUBLIC') OR
         (profile_evaluation_visibility.exchange_visibility = 'PRIVATE' AND ? = 'PUBLIC')
       )
       RETURNING balance_visibility AS balance,
                 evaluation_total_visibility AS evaluationTotal,
                 fix_visibility AS fix,
                 transfer_visibility AS transfer,
                 exchange_visibility AS exchange`,
    )
    .bind(
      `pev_${input.pointsUserId}_${input.evaluationCriterionId}`,
      input.pointsUserId,
      input.evaluationCriterionId,
      nextForInsert.balance,
      nextForInsert.evaluationTotal,
      nextForInsert.fix,
      nextForInsert.transfer,
      nextForInsert.exchange,
      input.allowPublicExpansion ? 1 : 0,
      isEvaluationVisibilityExpansion(initial, nextForInsert) ? 1 : 0,
      ...patchValues,
      input.allowPublicExpansion ? 1 : 0,
      ...patchValues,
    );
}

export async function updateProfileEvaluationVisibility(
  db: D1Database,
  input: VisibilityMutationInput,
): Promise<EvaluationVisibilityDto> {
  validatePatch(input.visibility);
  const row = await prepareVisibilityMutation(db, input).first<EvaluationVisibilityDto>();
  if (!row) {
    throw new FreshGoogleAuthRequiredError();
  }
  return row;
}

interface VisibilityResponseBody {
  data: {
    balanceVisibility: EvaluationVisibility;
    evaluationTotalVisibility: EvaluationVisibility;
    fixHistoryVisibility: EvaluationVisibility;
    transferHistoryVisibility: EvaluationVisibility;
    exchangeHistoryVisibility: EvaluationVisibility;
  };
  meta: { requestId: string };
}

export async function updateProfileEvaluationVisibilityIdempotently(
  db: D1Database,
  input: VisibilityMutationInput & {
    visibility: EvaluationVisibilityDto;
    idempotencyKey: string;
    requestId: string;
  },
): Promise<{ status: number; body: VisibilityResponseBody }> {
  validatePatch(input.visibility);
  const payloadHash = await profileMutationPayloadHash({
    evaluationCriterionId: input.evaluationCriterionId,
    visibility: input.visibility,
  });
  const replayInput = {
    pointsUserId: input.pointsUserId,
    operation: OPERATION,
    idempotencyKey: input.idempotencyKey,
    payloadHash,
  };
  const replay = await findProfileMutationReplay<VisibilityResponseBody>(db, replayInput);
  if (replay) {
    return replay;
  }
  const body: VisibilityResponseBody = {
    data: {
      balanceVisibility: input.visibility.balance,
      evaluationTotalVisibility: input.visibility.evaluationTotal,
      fixHistoryVisibility: input.visibility.fix,
      transferHistoryVisibility: input.visibility.transfer,
      exchangeHistoryVisibility: input.visibility.exchange,
    },
    meta: { requestId: input.requestId },
  };
  try {
    const results = await db.batch([
      prepareVisibilityMutation(db, input),
      db
        .prepare(
          `INSERT INTO idempotency_results
             (id, actor_points_user_id, operation, idempotency_key, payload_hash,
              status, response_body)
           SELECT ?, ?, ?, ?, ?, 200, ?
           WHERE EXISTS (
             SELECT 1 FROM profile_evaluation_visibility
             WHERE points_user_id = ? AND evaluation_criterion_id = ?
               AND balance_visibility = ? AND evaluation_total_visibility = ?
               AND fix_visibility = ? AND transfer_visibility = ? AND exchange_visibility = ?
           )`,
        )
        .bind(
          `idemr_${crypto.randomUUID()}`,
          input.pointsUserId,
          OPERATION,
          input.idempotencyKey,
          payloadHash,
          JSON.stringify(body),
          input.pointsUserId,
          input.evaluationCriterionId,
          input.visibility.balance,
          input.visibility.evaluationTotal,
          input.visibility.fix,
          input.visibility.transfer,
          input.visibility.exchange,
        ),
    ]);
    if ((results[1]?.meta.changes ?? 0) === 0) {
      throw new FreshGoogleAuthRequiredError();
    }
  } catch (error) {
    const concurrent = await findProfileMutationReplay<VisibilityResponseBody>(db, replayInput);
    if (concurrent) {
      return concurrent;
    }
    throw error;
  }
  return { status: 200, body };
}
