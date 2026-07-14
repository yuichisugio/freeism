import { canonicalJson, sha256Hex } from "../../csv/csv-validation-result";

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export interface PointReservationPackageRevision {
  pointPackageRevisionId: string;
  totalWeight: number;
  packageTick: number;
  components: Array<{
    evaluationCriterionId: string;
    evaluationCriterionRevisionId: string;
    displayOrder: number;
    minimumUnitScaled: number;
    weight: number;
  }>;
}

export interface PointReservationVector {
  vectorHash: string;
  totalAmountScaled: number;
  components: Array<{
    evaluationCriterionId: string;
    evaluationCriterionRevisionId: string;
    displayOrder: number;
    amountScaled: number;
  }>;
}

function safeNumber(value: bigint): number {
  if (value < 0n || value > MAX_SAFE) throw new Error("SAFE_INTEGER_OVERFLOW");
  return Number(value);
}

export async function calculatePointReservationVector(
  revision: PointReservationPackageRevision,
  priceTicks: number,
  quantity: number,
): Promise<PointReservationVector> {
  if (
    !Number.isSafeInteger(priceTicks) ||
    priceTicks < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    !Number.isSafeInteger(revision.totalWeight) ||
    revision.totalWeight < 1 ||
    !Number.isSafeInteger(revision.packageTick) ||
    revision.packageTick < 1 ||
    priceTicks % revision.packageTick !== 0 ||
    revision.components.length < 1
  ) {
    throw new Error("POINT_RESERVATION_VECTOR_INVALID");
  }

  let total = 0n;
  const components = revision.components
    .map((component) => {
      const weightedPrice = BigInt(priceTicks) * BigInt(component.weight);
      safeNumber(weightedPrice);
      const totalWeight = BigInt(revision.totalWeight);
      if (weightedPrice % totalWeight !== 0n) throw new Error("POINT_RESERVATION_VECTOR_INVALID");
      const unitAmount = weightedPrice / totalWeight;
      const amount = unitAmount * BigInt(quantity);
      const amountScaled = safeNumber(amount);
      if (
        !Number.isSafeInteger(component.minimumUnitScaled) ||
        component.minimumUnitScaled < 1 ||
        amount % BigInt(component.minimumUnitScaled) !== 0n
      ) {
        throw new Error("POINT_RESERVATION_VECTOR_INVALID");
      }
      total += amount;
      safeNumber(total);
      return {
        amountScaled,
        displayOrder: component.displayOrder,
        evaluationCriterionId: component.evaluationCriterionId,
        evaluationCriterionRevisionId: component.evaluationCriterionRevisionId,
      };
    })
    .sort((left, right) => left.evaluationCriterionId.localeCompare(right.evaluationCriterionId));
  const hashInput = {
    components: components.map(({ displayOrder: _, ...component }) => component),
    pointPackageRevisionId: revision.pointPackageRevisionId,
    priceTicks,
    quantity,
  };
  return {
    components,
    totalAmountScaled: safeNumber(total),
    vectorHash: `sha256:${await sha256Hex(canonicalJson(hashInput))}`,
  };
}
