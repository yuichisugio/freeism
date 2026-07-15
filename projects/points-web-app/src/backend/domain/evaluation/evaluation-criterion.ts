import { scaledAmountCodec } from "../money/scaled-amount";

export type EvaluationCriterionStatus = "ACTIVE" | "ARCHIVED";

export interface EvaluationCriterionRevisionInput {
  evaluationCriterionId: string;
  expectedRevision: number | null;
  status: EvaluationCriterionStatus;
  name: string;
  description: string;
  minimumUnit: string;
  transferEnabled: boolean;
  exchangeEnabled: boolean;
  balanceVisibleByDefault: boolean;
  buyNowEnabled: boolean;
  relatedUrls: string[];
}

export interface ValidatedEvaluationCriterionRevision extends Omit<
  EvaluationCriterionRevisionInput,
  "minimumUnit"
> {
  minimumUnitScaled: number;
  normalizedName: string;
}

export class InvalidEvaluationCriterionError extends Error {
  constructor() {
    super("INVALID_EVALUATION_CRITERION");
  }
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

export function normalizeEvaluationCriterionName(value: string): string {
  return value.normalize("NFC");
}

function isValidRelatedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

export function validateEvaluationCriterionRevision(
  input: EvaluationCriterionRevisionInput,
): ValidatedEvaluationCriterionRevision {
  let minimumUnitScaled: number;
  try {
    minimumUnitScaled = scaledAmountCodec.parse(input.minimumUnit);
  } catch {
    throw new InvalidEvaluationCriterionError();
  }

  if (
    input.evaluationCriterionId.length === 0 ||
    (input.status !== "ACTIVE" && input.status !== "ARCHIVED") ||
    codePointLength(input.name) < 1 ||
    codePointLength(input.name) > 30 ||
    codePointLength(input.description) < 1 ||
    codePointLength(input.description) > 200 ||
    minimumUnitScaled < 1 ||
    input.relatedUrls.length > 20 ||
    new Set(input.relatedUrls).size !== input.relatedUrls.length ||
    !input.relatedUrls.every(isValidRelatedUrl)
  ) {
    throw new InvalidEvaluationCriterionError();
  }

  return {
    ...input,
    name: input.name.normalize("NFC"),
    description: input.description.normalize("NFC"),
    normalizedName: normalizeEvaluationCriterionName(input.name),
    minimumUnitScaled,
    relatedUrls: input.relatedUrls.map((url) => new URL(url).href),
  };
}
