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

export async function updateProfileEvaluationVisibility(
  db: D1Database,
  input: {
    pointsUserId: string;
    evaluationCriterionId: string;
    visibility: EvaluationVisibilityPatch;
    balanceVisibleByDefault: boolean;
  },
): Promise<EvaluationVisibilityDto> {
  validatePatch(input.visibility);
  const previous = await getProfileEvaluationVisibility(db, input);
  const next = { ...previous, ...input.visibility };
  await db
    .prepare(
      `INSERT INTO profile_evaluation_visibility
         (id, points_user_id, evaluation_criterion_id, balance_visibility,
          evaluation_total_visibility, fix_visibility, transfer_visibility, exchange_visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(points_user_id, evaluation_criterion_id) DO UPDATE SET
         balance_visibility = excluded.balance_visibility,
         evaluation_total_visibility = excluded.evaluation_total_visibility,
         fix_visibility = excluded.fix_visibility,
         transfer_visibility = excluded.transfer_visibility,
         exchange_visibility = excluded.exchange_visibility`,
    )
    .bind(
      `pev_${input.pointsUserId}_${input.evaluationCriterionId}`,
      input.pointsUserId,
      input.evaluationCriterionId,
      next.balance,
      next.evaluationTotal,
      next.fix,
      next.transfer,
      next.exchange,
    )
    .run();
  return next;
}
