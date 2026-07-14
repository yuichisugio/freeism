import {
  InvalidEvaluationCriterionError,
  type EvaluationCriterionRevisionInput,
  validateEvaluationCriterionRevision,
} from "../domain/evaluation/evaluation-criterion";
import {
  appendEvaluationCriterionRevisions,
  findEvaluationCriterionHead,
} from "../infrastructure/db/d1-evaluation-repository";

export type EvaluationCriterionImportItem = EvaluationCriterionRevisionInput;

export class EvaluationCriterionRevisionConflictError extends Error {
  constructor() {
    super("EVALUATION_CRITERION_REVISION_CONFLICT");
  }
}

export class EvaluationCriterionNameConflictError extends Error {
  constructor() {
    super("EVALUATION_CRITERION_NAME_CONFLICT");
  }
}

export interface ImportedEvaluationCriterionRevision {
  evaluationCriterionId: string;
  evaluationCriterionRevisionId: string;
  revision: number;
  status: "ACTIVE" | "ARCHIVED";
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

export async function importEvaluationCriteria(
  db: D1Database,
  input: {
    actorPointsUserId: string;
    reason: string;
    items: EvaluationCriterionImportItem[];
    now?: Date;
  },
): Promise<[ImportedEvaluationCriterionRevision, ...ImportedEvaluationCriterionRevision[]]> {
  if (
    input.items.length < 1 ||
    input.items.length > 20 ||
    input.reason.trim().length === 0 ||
    new Set(input.items.map(({ evaluationCriterionId }) => evaluationCriterionId)).size !==
      input.items.length
  ) {
    throw new InvalidEvaluationCriterionError();
  }

  const validated = input.items.map(validateEvaluationCriterionRevision);
  if (new Set(validated.map(({ normalizedName }) => normalizedName)).size !== validated.length) {
    throw new EvaluationCriterionNameConflictError();
  }
  const now = input.now ?? new Date();
  const rows = await Promise.all(
    validated.map(async (value) => {
      const head = await findEvaluationCriterionHead(db, value.evaluationCriterionId);
      if (
        (head === null && value.expectedRevision !== null) ||
        (head !== null && value.expectedRevision !== head.currentRevision)
      ) {
        throw new EvaluationCriterionRevisionConflictError();
      }
      const revision = (head?.currentRevision ?? 0) + 1;
      return {
        value,
        revision,
        revisionId: `ecr_${value.evaluationCriterionId}_${revision}`,
        actorPointsUserId: input.actorPointsUserId,
        reason: input.reason,
        now,
        isNew: head === null,
      };
    }),
  );

  try {
    await appendEvaluationCriterionRevisions(db, rows);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new EvaluationCriterionNameConflictError();
    }
    throw error;
  }

  return rows.map(({ value, revision, revisionId }) => ({
    evaluationCriterionId: value.evaluationCriterionId,
    evaluationCriterionRevisionId: revisionId,
    revision,
    status: value.status,
  })) as [ImportedEvaluationCriterionRevision, ...ImportedEvaluationCriterionRevision[]];
}
