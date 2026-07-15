import type {
  AuctionImportPreviewRow,
  VerifiedPackageRevision,
} from "../auction/import/validate-auction-import";

export interface StoredAuctionResult {
  auctionId: string;
  revisionId: string;
  startsAt: string;
  status: "SCHEDULED";
  version: number;
}

export interface ImportCommitResult {
  auctionCommandId: string;
  auctions: StoredAuctionResult[];
}

export interface AuctionEligibilityReceipt {
  eligibilityReceiptId: string;
  checkedAt: string;
  validUntil: string;
  versions: Map<string, number>;
}

export interface AuctionWriteRow {
  auctionId: string;
  revisionId: string;
  row: AuctionImportPreviewRow;
}

export interface AuctionManagementSnapshot {
  auctionId: string;
  sellerMarketsUserId: string;
  currentRevisionId: string;
  revisionNumber: number;
  startsAt: string;
  status: string;
  version: number;
}

interface IdempotencyRow {
  payloadHash: string;
  responseBody: string | null;
  state: string;
}

export type IdempotencyLookup<T> =
  | { kind: "MISS" }
  | { kind: "CONFLICT" }
  | { kind: "REPLAY"; value: T };

export interface WriteContext {
  actorMarketsUserId: string;
  commandHash: string;
  commandId: string;
  commitStartedAt: string;
  environment: string;
  idempotencyKey: string;
  operation: string;
  payloadHash: string;
  receipt: AuctionEligibilityReceipt;
  requestId: string;
  sellerIdentitySnapshot: unknown;
}

function extensionRule(row: AuctionImportPreviewRow): string | null {
  if (row.extensionThresholdSeconds === null) return null;
  return JSON.stringify({
    durationSeconds: row.extensionDurationSeconds,
    maxExtensions: row.maxExtensions,
    thresholdSeconds: row.extensionThresholdSeconds,
  });
}

function snapshotId(snapshot: VerifiedPackageRevision): string {
  return `pps_${snapshot.contentHash.slice("sha256:".length, 42)}`;
}

function componentId(snapshot: VerifiedPackageRevision, criterionId: string): string {
  return `ppsc_${snapshot.contentHash.slice("sha256:".length, 24)}_${criterionId}`;
}

export class D1AuctionRepository {
  constructor(private readonly db: D1Database) {}

  async lookupIdempotency<T>(
    actorMarketsUserId: string,
    operation: string,
    idempotencyKey: string,
    payloadHash: string,
  ): Promise<IdempotencyLookup<T>> {
    const row = await this.db
      .prepare(
        `SELECT payload_hash AS payloadHash, state, response_body AS responseBody
         FROM idempotency_results
         WHERE actor_markets_user_id = ? AND operation = ? AND idempotency_key = ?`,
      )
      .bind(actorMarketsUserId, operation, idempotencyKey)
      .first<IdempotencyRow>();
    if (!row) return { kind: "MISS" };
    if (row.payloadHash !== payloadHash) return { kind: "CONFLICT" };
    if (row.state !== "COMPLETED" || row.responseBody === null) {
      throw Object.assign(new Error("IDEMPOTENCY_IN_PROGRESS"), {
        code: "IDEMPOTENCY_IN_PROGRESS",
      });
    }
    return { kind: "REPLAY", value: JSON.parse(row.responseBody) as T };
  }

  async findForManagement(auctionId: string): Promise<AuctionManagementSnapshot | null> {
    return this.db
      .prepare(
        `SELECT a.id AS auctionId, a.seller_markets_user_id AS sellerMarketsUserId,
                a.current_revision_id AS currentRevisionId, a.status, a.version,
                r.revision_number AS revisionNumber, r.starts_at AS startsAt
         FROM auctions a JOIN auction_revisions r ON r.id = a.current_revision_id
         WHERE a.id = ?`,
      )
      .bind(auctionId)
      .first<AuctionManagementSnapshot>();
  }

  async commitImport(
    rows: readonly AuctionWriteRow[],
    context: WriteContext,
  ): Promise<ImportCommitResult> {
    const result: ImportCommitResult = {
      auctionCommandId: context.commandId,
      auctions: rows.map(({ auctionId, revisionId, row }) => ({
        auctionId,
        revisionId,
        startsAt: row.startsAt,
        status: "SCHEDULED",
        version: 1,
      })),
    };
    const statements: D1PreparedStatement[] = [];
    for (const { auctionId, revisionId, row } of rows) {
      const snapshot = row.packageSnapshot;
      const packageSnapshotId = snapshotId(snapshot);
      statements.push(
        this.db
          .prepare(
            `INSERT OR IGNORE INTO point_package_snapshots
             (id, point_package_id, point_package_revision_id, name, total_weight)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(
            packageSnapshotId,
            snapshot.pointPackageId,
            snapshot.pointPackageRevisionId,
            snapshot.name,
            snapshot.totalWeight,
          ),
      );
      for (const component of snapshot.components) {
        statements.push(
          this.db
            .prepare(
              `INSERT OR IGNORE INTO point_package_snapshot_components
               (id, point_package_snapshot_id, evaluation_criterion_id,
                evaluation_criterion_revision_id, evaluation_criterion_name,
                weight, minimum_unit_scaled, display_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              componentId(snapshot, component.evaluationCriterionId),
              packageSnapshotId,
              component.evaluationCriterionId,
              component.evaluationCriterionRevisionId,
              component.name,
              component.weight,
              component.minimumUnitScaled,
              component.displayOrder,
            ),
        );
      }
      statements.push(
        this.db
          .prepare(
            `INSERT INTO auctions
             (id, seller_markets_user_id, status, version, updated_at)
             VALUES (?, ?, 'DRAFT', 1, ?)`,
          )
          .bind(auctionId, context.actorMarketsUserId, context.commitStartedAt),
        this.db
          .prepare(
            `INSERT INTO auction_revisions
             (id, auction_id, revision_number, title, description, external_url,
              seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity,
              starts_at, ends_at, package_tick, buy_now_price_tick_count, extension_rule_json,
              eligibility_receipt_id, auction_command_id, auction_command_hash,
              package_eligibility_version, eligibility_checked_at, eligibility_valid_until,
              commit_started_at)
             VALUES (?, ?, 1, ?, ?, ?, ?, 'points.freeism.app', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            revisionId,
            auctionId,
            row.title,
            row.description,
            row.externalUrl,
            JSON.stringify(context.sellerIdentitySnapshot),
            packageSnapshotId,
            row.quantity,
            row.startsAt,
            row.endsAt,
            snapshot.packageTick,
            row.buyNowPriceTickCount,
            extensionRule(row),
            context.receipt.eligibilityReceiptId,
            context.commandId,
            context.commandHash,
            context.receipt.versions.get(row.clientRowId),
            context.receipt.checkedAt,
            context.receipt.validUntil,
            context.commitStartedAt,
          ),
        this.db
          .prepare(
            `UPDATE auctions SET current_revision_id = ?, status = 'SCHEDULED', updated_at = ?
             WHERE id = ? AND status = 'DRAFT' AND version = 1`,
          )
          .bind(revisionId, context.commitStartedAt, auctionId),
        this.db
          .prepare(
            `INSERT INTO auction_commands
             (id, auction_id, command_id, actor_markets_user_id, operation, payload_hash,
              expected_auction_version, status, response_body)
             VALUES (?, ?, ?, ?, 'IMPORT_COMMIT', ?, 1, 'COMPLETED', ?)`,
          )
          .bind(
            `ac_${crypto.randomUUID()}`,
            auctionId,
            context.commandId,
            context.actorMarketsUserId,
            context.payloadHash,
            JSON.stringify(result),
          ),
        this.db
          .prepare(
            `INSERT INTO audit_events
             (id, actor_markets_user_id, event_code, target_type, target_id, after_json,
              request_id, environment, result)
             VALUES (?, ?, 'AUCTION_ALARM_SCHEDULE_REQUESTED', 'AUCTION', ?, ?, ?, ?, 'SUCCESS')`,
          )
          .bind(
            `audit_${crypto.randomUUID()}`,
            context.actorMarketsUserId,
            auctionId,
            JSON.stringify({ revisionId, startsAt: row.startsAt }),
            context.requestId,
            context.environment,
          ),
      );
    }
    statements.push(this.completedIdempotencyStatement(context, result));
    await this.db.batch(statements);
    return result;
  }

  async updateBeforeStart(
    snapshot: AuctionManagementSnapshot,
    write: AuctionWriteRow,
    context: WriteContext,
  ): Promise<StoredAuctionResult> {
    const nextVersion = snapshot.version + 1;
    const result: StoredAuctionResult = {
      auctionId: write.auctionId,
      revisionId: write.revisionId,
      startsAt: write.row.startsAt,
      status: "SCHEDULED",
      version: nextVersion,
    };
    const packageSnapshot = write.row.packageSnapshot;
    const packageSnapshotId = snapshotId(packageSnapshot);
    const guard = `EXISTS (
      SELECT 1 FROM auctions a JOIN auction_revisions current ON current.id = a.current_revision_id
      WHERE a.id = ? AND a.seller_markets_user_id = ? AND a.status IN ('DRAFT','SCHEDULED')
        AND a.version = ? AND current.starts_at > ?
    )`;
    const guardBindings = [
      write.auctionId,
      context.actorMarketsUserId,
      snapshot.version,
      context.commitStartedAt,
    ] as const;
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT OR IGNORE INTO point_package_snapshots
           (id, point_package_id, point_package_revision_id, name, total_weight)
           SELECT ?, ?, ?, ?, ? WHERE ${guard}`,
        )
        .bind(
          packageSnapshotId,
          packageSnapshot.pointPackageId,
          packageSnapshot.pointPackageRevisionId,
          packageSnapshot.name,
          packageSnapshot.totalWeight,
          ...guardBindings,
        ),
    ];
    for (const component of packageSnapshot.components) {
      statements.push(
        this.db
          .prepare(
            `INSERT OR IGNORE INTO point_package_snapshot_components
             (id, point_package_snapshot_id, evaluation_criterion_id,
              evaluation_criterion_revision_id, evaluation_criterion_name,
              weight, minimum_unit_scaled, display_order)
             SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`,
          )
          .bind(
            componentId(packageSnapshot, component.evaluationCriterionId),
            packageSnapshotId,
            component.evaluationCriterionId,
            component.evaluationCriterionRevisionId,
            component.name,
            component.weight,
            component.minimumUnitScaled,
            component.displayOrder,
            ...guardBindings,
          ),
      );
    }
    const updateResultIndex = statements.length + 1;
    statements.push(
      this.db
        .prepare(
          `INSERT INTO auction_revisions
           (id, auction_id, revision_number, title, description, external_url,
            seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity,
            starts_at, ends_at, package_tick, buy_now_price_tick_count, extension_rule_json,
            eligibility_receipt_id, auction_command_id, auction_command_hash,
            package_eligibility_version, eligibility_checked_at, eligibility_valid_until,
            commit_started_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, 'points.freeism.app', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE ${guard}`,
        )
        .bind(
          write.revisionId,
          write.auctionId,
          snapshot.revisionNumber + 1,
          write.row.title,
          write.row.description,
          write.row.externalUrl,
          JSON.stringify(context.sellerIdentitySnapshot),
          packageSnapshotId,
          write.row.quantity,
          write.row.startsAt,
          write.row.endsAt,
          packageSnapshot.packageTick,
          write.row.buyNowPriceTickCount,
          extensionRule(write.row),
          context.receipt.eligibilityReceiptId,
          context.commandId,
          context.commandHash,
          context.receipt.versions.get(write.row.clientRowId),
          context.receipt.checkedAt,
          context.receipt.validUntil,
          context.commitStartedAt,
          ...guardBindings,
        ),
      this.db
        .prepare(
          `UPDATE auctions SET current_revision_id = ?, version = version + 1, updated_at = ?
           WHERE id = ? AND seller_markets_user_id = ? AND status IN ('DRAFT','SCHEDULED')
             AND version = ? AND EXISTS (
               SELECT 1 FROM auction_revisions current
               WHERE current.id = auctions.current_revision_id AND current.starts_at > ?
             )`,
        )
        .bind(write.revisionId, context.commitStartedAt, ...guardBindings),
      this.db
        .prepare(
          `INSERT INTO audit_events
           (id, actor_markets_user_id, event_code, target_type, target_id, before_json,
            after_json, request_id, environment, result)
           SELECT ?, ?, 'AUCTION_UPDATED', 'AUCTION', ?, ?, ?, ?, ?, 'SUCCESS'
           WHERE EXISTS (SELECT 1 FROM auctions WHERE id = ? AND current_revision_id = ?)`,
        )
        .bind(
          `audit_${crypto.randomUUID()}`,
          context.actorMarketsUserId,
          write.auctionId,
          JSON.stringify({ revisionId: snapshot.currentRevisionId, version: snapshot.version }),
          JSON.stringify({
            revisionId: write.revisionId,
            startsAt: write.row.startsAt,
            version: nextVersion,
          }),
          context.requestId,
          context.environment,
          write.auctionId,
          write.revisionId,
        ),
      this.db
        .prepare(
          `INSERT INTO audit_events
           (id, actor_markets_user_id, event_code, target_type, target_id, after_json,
            request_id, environment, result)
           SELECT ?, ?, 'AUCTION_ALARM_SCHEDULE_REQUESTED', 'AUCTION', ?, ?, ?, ?, 'SUCCESS'
           WHERE EXISTS (SELECT 1 FROM auctions WHERE id = ? AND current_revision_id = ?)`,
        )
        .bind(
          `audit_${crypto.randomUUID()}`,
          context.actorMarketsUserId,
          write.auctionId,
          JSON.stringify({ revisionId: write.revisionId, startsAt: write.row.startsAt }),
          context.requestId,
          context.environment,
          write.auctionId,
          write.revisionId,
        ),
      this.completedIdempotencyStatement(context, result, write.auctionId, write.revisionId),
    );
    const results = await this.db.batch(statements);
    const updateResult = results[updateResultIndex];
    if (!updateResult || updateResult.meta.changes !== 1) {
      throw Object.assign(new Error("AUCTION_VERSION_CONFLICT"), {
        code: "AUCTION_VERSION_CONFLICT",
      });
    }
    return result;
  }

  async cancelBeforeStart(
    snapshot: AuctionManagementSnapshot,
    context: Omit<
      WriteContext,
      "commandHash" | "commandId" | "receipt" | "sellerIdentitySnapshot"
    > & {
      reason?: string;
    },
  ): Promise<{ auctionId: string; status: "CANCELLED"; version: number }> {
    const result = {
      auctionId: snapshot.auctionId,
      status: "CANCELLED" as const,
      version: snapshot.version + 1,
    };
    const commandMarkerId = `ac_${crypto.randomUUID()}`;
    const commandId = `cancel_${context.payloadHash.slice(0, 32)}`;
    const marker = this.db
      .prepare(
        `INSERT INTO auction_commands
         (id, auction_id, command_id, actor_markets_user_id, operation, payload_hash,
          expected_auction_version, status, response_body)
         SELECT ?, ?, ?, ?, 'CANCEL', ?, ?, 'COMPLETED', ?
         WHERE EXISTS (
           SELECT 1 FROM auctions a JOIN auction_revisions current ON current.id = a.current_revision_id
           WHERE a.id = ? AND a.seller_markets_user_id = ? AND a.status IN ('DRAFT','SCHEDULED')
             AND a.version = ? AND current.starts_at > ?
         )`,
      )
      .bind(
        commandMarkerId,
        snapshot.auctionId,
        commandId,
        context.actorMarketsUserId,
        context.payloadHash,
        snapshot.version,
        JSON.stringify(result),
        snapshot.auctionId,
        context.actorMarketsUserId,
        snapshot.version,
        context.commitStartedAt,
      );
    const update = this.db
      .prepare(
        `UPDATE auctions SET status = 'CANCELLED', version = version + 1, updated_at = ?
         WHERE id = ? AND seller_markets_user_id = ? AND status IN ('DRAFT','SCHEDULED')
           AND version = ? AND EXISTS (
             SELECT 1 FROM auction_revisions current
             WHERE current.id = auctions.current_revision_id AND current.starts_at > ?
           ) AND EXISTS (SELECT 1 FROM auction_commands WHERE id = ?)`,
      )
      .bind(
        context.commitStartedAt,
        snapshot.auctionId,
        context.actorMarketsUserId,
        snapshot.version,
        context.commitStartedAt,
        commandMarkerId,
      );
    try {
      const results = await this.db.batch([
        marker,
        update,
        this.db
          .prepare(
            `INSERT INTO audit_events
             (id, actor_markets_user_id, event_code, target_type, target_id, before_json,
              after_json, reason, request_id, environment, result)
             SELECT ?, ?, 'AUCTION_CANCELLED', 'AUCTION', ?, ?, ?, ?, ?, ?, 'SUCCESS'
             WHERE EXISTS (
               SELECT 1 FROM auctions
               WHERE id = ? AND status = 'CANCELLED' AND version = ?
             ) AND EXISTS (SELECT 1 FROM auction_commands WHERE id = ?)`,
          )
          .bind(
            `audit_${crypto.randomUUID()}`,
            context.actorMarketsUserId,
            snapshot.auctionId,
            JSON.stringify({ status: snapshot.status, version: snapshot.version }),
            JSON.stringify(result),
            context.reason ?? null,
            context.requestId,
            context.environment,
            snapshot.auctionId,
            snapshot.version + 1,
            commandMarkerId,
          ),
        this.db
          .prepare(
            `INSERT INTO audit_events
             (id, actor_markets_user_id, event_code, target_type, target_id, after_json,
              request_id, environment, result)
             SELECT ?, ?, 'AUCTION_ALARM_CANCEL_REQUESTED', 'AUCTION', ?, ?, ?, ?, 'SUCCESS'
             WHERE EXISTS (
               SELECT 1 FROM auctions
               WHERE id = ? AND status = 'CANCELLED' AND version = ?
             ) AND EXISTS (SELECT 1 FROM auction_commands WHERE id = ?)`,
          )
          .bind(
            `audit_${crypto.randomUUID()}`,
            context.actorMarketsUserId,
            snapshot.auctionId,
            JSON.stringify({ revisionId: snapshot.currentRevisionId }),
            context.requestId,
            context.environment,
            snapshot.auctionId,
            snapshot.version + 1,
            commandMarkerId,
          ),
        this.completedIdempotencyStatement(context, result, undefined, undefined, commandMarkerId),
      ]);
      if (results[1]?.meta.changes !== 1) {
        throw Object.assign(new Error("AUCTION_VERSION_CONFLICT"), {
          code: "AUCTION_VERSION_CONFLICT",
        });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("AUCTION_CANCELLATION_BLOCKED")) {
        throw Object.assign(new Error("AUCTION_CANCELLATION_BLOCKED"), {
          code: "AUCTION_CANCELLATION_BLOCKED",
        });
      }
      throw error;
    }
  }

  private completedIdempotencyStatement(
    context: Pick<
      WriteContext,
      "actorMarketsUserId" | "operation" | "idempotencyKey" | "payloadHash" | "commitStartedAt"
    >,
    result: unknown,
    requiredAuctionId?: string,
    requiredRevisionId?: string,
    requiredCommandMarkerId?: string,
  ): D1PreparedStatement {
    const condition = requiredCommandMarkerId
      ? "WHERE EXISTS (SELECT 1 FROM auction_commands WHERE id = ?)"
      : requiredAuctionId
        ? `WHERE EXISTS (SELECT 1 FROM auctions WHERE id = ?${
            requiredRevisionId ? " AND current_revision_id = ?" : " AND status = 'CANCELLED'"
          })`
        : "";
    return this.db
      .prepare(
        `INSERT INTO idempotency_results
         (id, actor_markets_user_id, operation, idempotency_key, payload_hash, state,
          response_status, response_body, response_content_type, completed_at)
         SELECT ?, ?, ?, ?, ?, 'COMPLETED', 200, ?, 'application/json', ? ${condition}`,
      )
      .bind(
        `idem_${crypto.randomUUID()}`,
        context.actorMarketsUserId,
        context.operation,
        context.idempotencyKey,
        context.payloadHash,
        JSON.stringify(result),
        context.commitStartedAt,
        ...(requiredCommandMarkerId
          ? [requiredCommandMarkerId]
          : requiredAuctionId
            ? requiredRevisionId
              ? [requiredAuctionId, requiredRevisionId]
              : [requiredAuctionId]
            : []),
      );
  }
}
