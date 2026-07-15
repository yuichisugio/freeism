export type PointPackageStatus = "ACTIVE" | "INACTIVE";

export interface PointPackageComponentInput {
  evaluationCriterionId: string;
  evaluationCriterionRevisionId: string;
  evaluationCriterionName: string;
  displayOrder: number;
  minimumUnitScaled: number;
  buyNowEnabled: boolean;
  weight: number;
}

export interface PointPackageRevisionInput {
  pointPackageId: string;
  pointPackageRevisionId: string;
  status: PointPackageStatus;
  name: string;
  description: string | null;
  relatedUrl: string | null;
  components: PointPackageComponentInput[];
}

export interface PointPackageComponent extends Omit<
  PointPackageComponentInput,
  "evaluationCriterionName"
> {
  name: string;
}

export interface PointPackageRevisionCanonicalContent {
  pointPackageId: string;
  pointPackageRevisionId: string;
  status: PointPackageStatus;
  name: string;
  description: string | null;
  relatedUrl: string | null;
  totalWeight: number;
  packageTick: number;
  components: PointPackageComponent[];
}

export interface CreatedPointPackageRevision extends PointPackageRevisionCanonicalContent {
  normalizedName: string;
  contentHash: string;
  canonicalBytes: Uint8Array;
}

export class InvalidPointPackageError extends Error {
  constructor() {
    super("INVALID_POINT_PACKAGE");
  }
}

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function lcm(left: bigint, right: bigint): bigint {
  return (left / gcd(left, right)) * right;
}

function toSafeNumber(value: bigint): number {
  if (value < 1n || value > MAX_SAFE_BIGINT) {
    throw new InvalidPointPackageError();
  }
  return Number(value);
}

export function normalizePointPackageName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "")
    .replace(/\p{White_Space}+/gu, " ")
    .toLowerCase();
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function canonicalize(value: unknown): string {
  if (typeof value === "string" && hasLoneSurrogate(value)) {
    throw new InvalidPointPackageError();
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new InvalidPointPackageError();
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }
  throw new InvalidPointPackageError();
}

type CanonicalPointPackageRevisionInput = Omit<
  PointPackageRevisionCanonicalContent,
  "components"
> & {
  components: Array<
    Omit<PointPackageComponent, "minimumUnitScaled"> & { minimumUnitScaled: number | string }
  >;
};

function canonicalContent(input: CanonicalPointPackageRevisionInput) {
  return {
    pointPackageId: input.pointPackageId,
    pointPackageRevisionId: input.pointPackageRevisionId,
    status: input.status,
    name: input.name,
    description: input.description,
    relatedUrl: input.relatedUrl,
    totalWeight: input.totalWeight,
    packageTick: input.packageTick,
    components: input.components.map((component) => ({
      evaluationCriterionId: component.evaluationCriterionId,
      evaluationCriterionRevisionId: component.evaluationCriterionRevisionId,
      name: component.name,
      displayOrder: component.displayOrder,
      minimumUnitScaled: String(component.minimumUnitScaled),
      buyNowEnabled: component.buyNowEnabled,
      weight: component.weight,
    })),
  };
}

export function canonicalPointPackageRevisionBytes(
  input: CanonicalPointPackageRevisionInput,
): Uint8Array {
  return new TextEncoder().encode(canonicalize(canonicalContent(input)));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return `sha256:${hex}`;
}

function normalizeRelatedUrl(value: string | null): string | null {
  if (value === null || value === "") {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidPointPackageError();
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hash !== "") {
    throw new InvalidPointPackageError();
  }
  const normalized = url.href;
  if (utf8Length(normalized) > 2_048) {
    throw new InvalidPointPackageError();
  }
  return normalized;
}

export async function createPointPackageRevision(
  input: PointPackageRevisionInput,
): Promise<CreatedPointPackageRevision> {
  const name = input.name.normalize("NFC");
  const description =
    input.description === "" ? null : (input.description?.normalize("NFC") ?? null);
  const relatedUrl = normalizeRelatedUrl(input.relatedUrl);
  if (
    input.pointPackageId.length === 0 ||
    input.pointPackageRevisionId.length === 0 ||
    (input.status !== "ACTIVE" && input.status !== "INACTIVE") ||
    codePointLength(name) < 1 ||
    codePointLength(name) > 60 ||
    utf8Length(name) > 240 ||
    (description !== null &&
      (codePointLength(description) > 500 || utf8Length(description) > 2_000)) ||
    input.components.length < 1
  ) {
    throw new InvalidPointPackageError();
  }

  const sorted = [...input.components].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
  const criterionIds = new Set<string>();
  for (let index = 0; index < sorted.length; index += 1) {
    const component = sorted[index]!;
    if (
      component.displayOrder !== index ||
      criterionIds.has(component.evaluationCriterionId) ||
      !Number.isSafeInteger(component.weight) ||
      component.weight <= 0 ||
      !Number.isSafeInteger(component.minimumUnitScaled) ||
      component.minimumUnitScaled <= 0
    ) {
      throw new InvalidPointPackageError();
    }
    criterionIds.add(component.evaluationCriterionId);
  }

  const weightGcd = sorted
    .map(({ weight }) => BigInt(weight))
    .reduce((current, weight) => gcd(current, weight));
  const components = sorted.map(({ evaluationCriterionName, ...component }) => ({
    ...component,
    name: evaluationCriterionName,
    weight: toSafeNumber(BigInt(component.weight) / weightGcd),
  }));
  const totalWeightBigInt = components.reduce((sum, { weight }) => sum + BigInt(weight), 0n);
  const totalWeight = toSafeNumber(totalWeightBigInt);
  const packageTickBigInt = components.reduce((tick, component) => {
    const requiredDivisor = totalWeightBigInt * BigInt(component.minimumUnitScaled);
    const requiredTick = requiredDivisor / gcd(BigInt(component.weight), requiredDivisor);
    return lcm(tick, requiredTick);
  }, 1n);
  const packageTick = toSafeNumber(packageTickBigInt);

  const content: PointPackageRevisionCanonicalContent = {
    pointPackageId: input.pointPackageId,
    pointPackageRevisionId: input.pointPackageRevisionId,
    status: input.status,
    name,
    description,
    relatedUrl,
    totalWeight,
    packageTick,
    components,
  };
  const canonicalBytes = canonicalPointPackageRevisionBytes(content);
  return {
    ...content,
    normalizedName: normalizePointPackageName(name),
    canonicalBytes,
    contentHash: await sha256(canonicalBytes),
  };
}
