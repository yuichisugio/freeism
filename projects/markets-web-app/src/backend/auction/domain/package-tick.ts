export interface PackageComponent {
  evaluationCriterionId?: string;
  minimumUnitScaled: number;
  weight: number;
}

export interface PackageTick {
  components: readonly PackageComponent[];
  packageTick: number;
  totalWeight: number;
}

export interface ComponentAmount {
  amountScaled: number;
  evaluationCriterionId?: string;
  minimumUnitScaled: number;
}

const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);

function positiveSafeInteger(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function leastCommonMultiple(left: bigint, right: bigint): bigint {
  return (left / greatestCommonDivisor(left, right)) * right;
}

function toSafeInteger(value: bigint): number {
  if (value < 0n || value > maxSafeInteger) throw new Error("SAFE_INTEGER_OVERFLOW");
  return Number(value);
}

export function requiredBaseFactor(component: PackageComponent, totalWeight: number): bigint {
  if (
    !positiveSafeInteger(totalWeight) ||
    !positiveSafeInteger(component.weight) ||
    !positiveSafeInteger(component.minimumUnitScaled)
  ) {
    throw new Error("INVALID_PACKAGE_TICK_INPUT");
  }
  const divisor = BigInt(totalWeight) * BigInt(component.minimumUnitScaled);
  return divisor / greatestCommonDivisor(BigInt(component.weight), divisor);
}

export function calculatePackageTick(input: {
  components: readonly PackageComponent[];
  totalWeight: number;
}): PackageTick {
  if (!positiveSafeInteger(input.totalWeight) || input.components.length === 0) {
    throw new Error("INVALID_PACKAGE_TICK_INPUT");
  }

  let weightSum = 0n;
  let packageTick = 1n;
  for (const component of input.components) {
    if (
      !positiveSafeInteger(component.weight) ||
      !positiveSafeInteger(component.minimumUnitScaled)
    ) {
      throw new Error("INVALID_PACKAGE_TICK_INPUT");
    }
    weightSum += BigInt(component.weight);
    packageTick = leastCommonMultiple(
      packageTick,
      requiredBaseFactor(component, input.totalWeight),
    );
  }
  if (weightSum !== BigInt(input.totalWeight)) throw new Error("INVALID_PACKAGE_TICK_INPUT");

  return {
    components: input.components.map((component) => ({ ...component })),
    packageTick: toSafeInteger(packageTick),
    totalWeight: input.totalWeight,
  };
}

export function expandPackageVector(
  priceTickCount: number,
  quantity: number,
  tick: PackageTick,
): readonly ComponentAmount[] {
  if (
    !Number.isSafeInteger(priceTickCount) ||
    priceTickCount < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 1_000 ||
    !positiveSafeInteger(tick.packageTick) ||
    !positiveSafeInteger(tick.totalWeight)
  ) {
    throw new Error("INVALID_PACKAGE_VECTOR_INPUT");
  }

  const totalWeight = BigInt(tick.totalWeight);
  return tick.components.map((component) => {
    if (
      !positiveSafeInteger(component.weight) ||
      !positiveSafeInteger(component.minimumUnitScaled)
    ) {
      throw new Error("INVALID_PACKAGE_VECTOR_INPUT");
    }
    const numerator =
      BigInt(priceTickCount) *
      BigInt(quantity) *
      BigInt(tick.packageTick) *
      BigInt(component.weight);
    if (numerator % totalWeight !== 0n) throw new Error("INVALID_PACKAGE_VECTOR_INPUT");
    const amountScaled = toSafeInteger(numerator / totalWeight);
    if (amountScaled % component.minimumUnitScaled !== 0) {
      throw new Error("INVALID_PACKAGE_VECTOR_INPUT");
    }
    return {
      amountScaled,
      ...(component.evaluationCriterionId
        ? { evaluationCriterionId: component.evaluationCriterionId }
        : {}),
      minimumUnitScaled: component.minimumUnitScaled,
    };
  });
}

export function toPointsPriceTicks(priceTickCount: number, packageTick: number): number {
  if (
    !Number.isSafeInteger(priceTickCount) ||
    priceTickCount < 0 ||
    !positiveSafeInteger(packageTick)
  ) {
    throw new Error("INVALID_PACKAGE_PRICE_INPUT");
  }
  return toSafeInteger(BigInt(priceTickCount) * BigInt(packageTick));
}
