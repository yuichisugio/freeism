export interface PointPackageAuctionEligibilityItemInput {
  auctionItemId: string;
  pointPackageId: string;
  pointPackageRevisionId: string;
  contentHash: string;
}

export interface CheckPointPackageAuctionEligibilityInput {
  marketsClientId: string;
  auctionCommandId: string;
  auctionCommandHash: string;
  idempotencyKey: string;
  items: PointPackageAuctionEligibilityItemInput[];
  now?: Date;
}

type IneligibilityCode =
  | "POINT_PACKAGE_NOT_FOUND"
  | "POINT_PACKAGE_REVISION_NOT_FOUND"
  | "POINT_PACKAGE_REVISION_MISMATCH"
  | "POINT_PACKAGE_REVISION_INACTIVE"
  | "POINT_PACKAGE_INACTIVE"
  | "CONTENT_HASH_MISMATCH";

interface EligibilityItemResult extends PointPackageAuctionEligibilityItemInput {
  packageEligibilityVersion: number;
}

interface EligibilityData {
  pointPackageAuctionEligibilityReceiptId: string;
  auctionCommandId: string;
  auctionCommandHash: string;
  items: EligibilityItemResult[];
  checkedAt: string;
  validUntil: string;
  serverNowIsEligible(serverNow: string | Date): boolean;
}

interface EligibilitySuccessBody {
  data: EligibilityData;
  meta: { requestId: string };
}

interface EligibilityFailureBody {
  code: "POINT_PACKAGE_AUCTION_INELIGIBLE";
  errors: Array<{ auctionItemId: string; code: IneligibilityCode }>;
  checkedAt: string;
}

export class PointPackageAuctionEligibilityError extends Error {
  readonly status = 409;
  constructor(readonly body: EligibilityFailureBody) {
    super("POINT_PACKAGE_AUCTION_INELIGIBLE");
  }
}

export class PointPackageAuctionEligibilityIdempotencyConflictError extends Error {
  readonly status = 409;
  constructor() {
    super("IDEMPOTENCY_KEY_REUSED");
  }
}

export class InvalidPointPackageAuctionEligibilityRequestError extends Error {
  constructor() {
    super("INVALID_AUCTION_ELIGIBILITY_REQUEST");
  }
}

function toEligibilityData(value: Omit<EligibilityData, "serverNowIsEligible">): EligibilityData {
  return {
    ...value,
    serverNowIsEligible(serverNow) {
      const time = serverNow instanceof Date ? serverNow.getTime() : new Date(serverNow).getTime();
      return Number.isFinite(time) && time < new Date(value.validUntil).getTime();
    },
  };
}

function parseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function storedSuccessBody(body: EligibilitySuccessBody) {
  const { serverNowIsEligible: _, ...data } = body.data;
  return { ...body, data };
}

async function sha256Json(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalPayload(input: CheckPointPackageAuctionEligibilityInput) {
  return {
    marketsClientId: input.marketsClientId,
    auctionCommandId: input.auctionCommandId,
    auctionCommandHash: input.auctionCommandHash,
    items: [...input.items]
      .sort((left, right) => left.auctionItemId.localeCompare(right.auctionItemId))
      .map((item) => ({
        auctionItemId: item.auctionItemId,
        pointPackageId: item.pointPackageId,
        pointPackageRevisionId: item.pointPackageRevisionId,
        contentHash: item.contentHash,
      })),
  };
}

function validateInput(input: CheckPointPackageAuctionEligibilityInput): void {
  if (
    input.marketsClientId.length === 0 ||
    input.auctionCommandId.length === 0 ||
    input.auctionCommandHash.length === 0 ||
    input.idempotencyKey.length === 0 ||
    input.items.length < 1 ||
    input.items.length > 1_000 ||
    new Set(input.items.map(({ auctionItemId }) => auctionItemId)).size !== input.items.length ||
    input.items.some(
      (item) =>
        item.auctionItemId.length === 0 ||
        item.pointPackageId.length === 0 ||
        item.pointPackageRevisionId.length === 0 ||
        item.contentHash.length === 0,
    )
  ) {
    throw new InvalidPointPackageAuctionEligibilityRequestError();
  }
}

async function findReplay(
  db: D1Database,
  marketsClientId: string,
  idempotencyKey: string,
  payloadHash: string,
) {
  const row = await db
    .prepare(
      `SELECT payload_hash AS payloadHash, status, response_body AS responseBody
       FROM point_package_auction_eligibility_idempotency
       WHERE markets_client_id = ? AND idempotency_key = ?`,
    )
    .bind(marketsClientId, idempotencyKey)
    .first<{ payloadHash: string; status: number; responseBody: unknown }>();
  if (!row) {
    return null;
  }
  if (row.payloadHash !== payloadHash) {
    throw new PointPackageAuctionEligibilityIdempotencyConflictError();
  }
  if (row.status === 409) {
    throw new PointPackageAuctionEligibilityError(
      parseJson<EligibilityFailureBody>(row.responseBody),
    );
  }
  const stored = parseJson<
    Omit<EligibilitySuccessBody, "data"> & { data: Omit<EligibilityData, "serverNowIsEligible"> }
  >(row.responseBody);
  return {
    status: 201 as const,
    body: { ...stored, data: toEligibilityData(stored.data) },
  };
}

async function inspectItem(db: D1Database, item: PointPackageAuctionEligibilityItemInput) {
  const pointPackage = await db
    .prepare(
      `SELECT lifecycle_status AS lifecycleStatus, eligibility_version AS eligibilityVersion
       FROM point_package WHERE id = ?`,
    )
    .bind(item.pointPackageId)
    .first<{ lifecycleStatus: "ACTIVE" | "INACTIVE"; eligibilityVersion: number }>();
  if (!pointPackage) {
    return { code: "POINT_PACKAGE_NOT_FOUND" as const };
  }
  const revision = await db
    .prepare(
      `SELECT point_package_id AS pointPackageId, status, content_hash AS contentHash
       FROM point_package_revision WHERE id = ?`,
    )
    .bind(item.pointPackageRevisionId)
    .first<{ pointPackageId: string; status: "ACTIVE" | "INACTIVE"; contentHash: string }>();
  if (!revision) {
    return { code: "POINT_PACKAGE_REVISION_NOT_FOUND" as const };
  }
  if (revision.pointPackageId !== item.pointPackageId) {
    return { code: "POINT_PACKAGE_REVISION_MISMATCH" as const };
  }
  if (revision.status !== "ACTIVE") {
    return { code: "POINT_PACKAGE_REVISION_INACTIVE" as const };
  }
  if (pointPackage.lifecycleStatus !== "ACTIVE") {
    return { code: "POINT_PACKAGE_INACTIVE" as const };
  }
  if (revision.contentHash !== item.contentHash) {
    return { code: "CONTENT_HASH_MISMATCH" as const };
  }
  return { eligibilityVersion: pointPackage.eligibilityVersion };
}

async function storeFailure(
  db: D1Database,
  input: CheckPointPackageAuctionEligibilityInput,
  payloadHash: string,
  checkedAt: Date,
  errors: Array<{ auctionItemId: string; code: IneligibilityCode }>,
): Promise<never> {
  const body: EligibilityFailureBody = {
    code: "POINT_PACKAGE_AUCTION_INELIGIBLE",
    errors: errors.sort((left, right) => left.auctionItemId.localeCompare(right.auctionItemId)),
    checkedAt: checkedAt.toISOString(),
  };
  try {
    await db
      .prepare(
        `INSERT INTO point_package_auction_eligibility_idempotency
           (id, markets_client_id, idempotency_key, payload_hash, expected_item_count,
            status, response_body, checked_at, valid_until)
         VALUES (?, ?, ?, ?, ?, 409, ?, ?, NULL)`,
      )
      .bind(
        `paei_${crypto.randomUUID()}`,
        input.marketsClientId,
        input.idempotencyKey,
        payloadHash,
        input.items.length,
        JSON.stringify(body),
        checkedAt.getTime(),
      )
      .run();
  } catch {
    const replay = await findReplay(db, input.marketsClientId, input.idempotencyKey, payloadHash);
    if (replay) {
      throw new Error("UNREACHABLE_SUCCESS_REPLAY");
    }
  }
  throw new PointPackageAuctionEligibilityError(body);
}

export async function checkPointPackageAuctionEligibility(
  db: D1Database,
  input: CheckPointPackageAuctionEligibilityInput,
): Promise<{ status: 201; body: EligibilitySuccessBody }> {
  validateInput(input);
  const payload = canonicalPayload(input);
  const payloadHash = await sha256Json(payload);
  const replay = await findReplay(db, input.marketsClientId, input.idempotencyKey, payloadHash);
  if (replay) {
    return replay;
  }

  const checkedAt = input.now ?? new Date();
  const inspections = await Promise.all(
    payload.items.map(async (item) => ({ item, result: await inspectItem(db, item) })),
  );
  const errors: Array<{ auctionItemId: string; code: IneligibilityCode }> = [];
  for (const { item, result } of inspections) {
    if ("code" in result && result.code !== undefined) {
      errors.push({ auctionItemId: item.auctionItemId, code: result.code });
    }
  }
  if (errors.length > 0) {
    return storeFailure(db, input, payloadHash, checkedAt, errors);
  }

  const validUntil = new Date(checkedAt.getTime() + 30_000);
  const receiptId = `paer_${crypto.randomUUID()}`;
  const idempotencyId = `paei_${crypto.randomUUID()}`;
  const items = inspections.map(({ item, result }) => ({
    ...item,
    packageEligibilityVersion: (result as { eligibilityVersion: number }).eligibilityVersion,
  }));
  const body: EligibilitySuccessBody = {
    data: toEligibilityData({
      pointPackageAuctionEligibilityReceiptId: receiptId,
      auctionCommandId: input.auctionCommandId,
      auctionCommandHash: input.auctionCommandHash,
      items,
      checkedAt: checkedAt.toISOString(),
      validUntil: validUntil.toISOString(),
    }),
    meta: { requestId: `req_${crypto.randomUUID()}` },
  };

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO point_package_auction_eligibility_idempotency
           (id, markets_client_id, idempotency_key, payload_hash, expected_item_count,
            status, response_body, checked_at, valid_until)
         VALUES (?, ?, ?, ?, ?, 0, '{}', ?, ?)`,
      )
      .bind(
        idempotencyId,
        input.marketsClientId,
        input.idempotencyKey,
        payloadHash,
        items.length,
        checkedAt.getTime(),
        validUntil.getTime(),
      ),
    db
      .prepare(
        `INSERT INTO point_package_auction_eligibility_receipt
           (id, idempotency_id, markets_client_id, auction_command_id, auction_command_hash,
            checked_at, valid_until)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        receiptId,
        idempotencyId,
        input.marketsClientId,
        input.auctionCommandId,
        input.auctionCommandHash,
        checkedAt.getTime(),
        validUntil.getTime(),
      ),
    ...items.map((item) =>
      db
        .prepare(
          `INSERT INTO point_package_auction_eligibility_item
             (id, receipt_id, auction_item_id, point_package_id, point_package_revision_id,
              content_hash, package_eligibility_version)
           SELECT ?, ?, ?, revision.point_package_id, revision.id,
                  revision.content_hash, package.eligibility_version
           FROM point_package_revision revision
           JOIN point_package package ON package.id = revision.point_package_id
           WHERE revision.id = ? AND revision.point_package_id = ?
             AND revision.content_hash = ? AND revision.status = 'ACTIVE'
             AND package.lifecycle_status = 'ACTIVE'
             AND package.eligibility_version = ?`,
        )
        .bind(
          `${receiptId}_${item.auctionItemId}`,
          receiptId,
          item.auctionItemId,
          item.pointPackageRevisionId,
          item.pointPackageId,
          item.contentHash,
          item.packageEligibilityVersion,
        ),
    ),
    db
      .prepare(
        `UPDATE point_package_auction_eligibility_idempotency
         SET status = 201, response_body = ?
         WHERE id = ? AND status = 0`,
      )
      .bind(JSON.stringify(storedSuccessBody(body)), idempotencyId),
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    const concurrentReplay = await findReplay(
      db,
      input.marketsClientId,
      input.idempotencyKey,
      payloadHash,
    );
    if (concurrentReplay) {
      return concurrentReplay;
    }
    throw error;
  }
  return { status: 201, body };
}
