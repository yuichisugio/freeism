import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { importPointPackages } from "../../src/backend/usecases/import-point-packages";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";
import { commitPointTransaction } from "../../src/backend/infrastructure/db/d1-point-transaction-repository";
import { readOwnedReservations } from "../../src/backend/infrastructure/db/d1-reservation-repository";
import { captureSettlement } from "../../src/backend/usecases/capture-settlement";
import { checkPointBalance } from "../../src/backend/usecases/check-point-balance";
import { createPointReservation } from "../../src/backend/usecases/create-point-reservation";
import { readReservationStatus } from "../../src/backend/usecases/read-reservation-status";
import { releasePointReservation } from "../../src/backend/usecases/release-point-reservation";

const db = env.DB!;

function withQueryBudget(database: D1Database, maximumQueries: number): D1Database {
  let queryCount = 0;
  const count = () => {
    queryCount += 1;
    if (queryCount > maximumQueries) throw new Error("D1_QUERY_BUDGET_EXCEEDED");
  };
  const wrapStatement = (statement: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property) {
        if (property === "bind") {
          return (...values: unknown[]) => wrapStatement(target.bind(...values));
        }
        if (property === "all") {
          return <T = Record<string, unknown>>() => {
            count();
            return target.all<T>();
          };
        }
        if (property === "first") {
          return <T = Record<string, unknown>>(columnName?: string) => {
            count();
            return columnName === undefined ? target.first<T>() : target.first<T>(columnName);
          };
        }
        if (property === "run") {
          return <T = Record<string, unknown>>() => {
            count();
            return target.run<T>();
          };
        }
        return Reflect.get(target, property, target);
      },
    });

  return new Proxy(database, {
    get(target, property) {
      if (property === "prepare") {
        return (query: string) => wrapStatement(target.prepare(query));
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function seedUser(id: string) {
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(id, id, `${id}@example.invalid`, now, now),
    db
      .prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'google', ?, ?, ?)",
      )
      .bind(`account_${id}`, `google_${id}`, id, now, now),
  ]);
  return provisionPointsUser(db, id, () => `pusr_${id}`);
}

async function seedBalance(
  pointsUserId: string,
  criterionId: string,
  criterionRevisionId: string,
  amountScaled: number,
) {
  const suffix = crypto.randomUUID();
  const now = Date.now();
  const resultId = `seed_result_${suffix}`;
  const revisionId = `seed_revision_${suffix}`;
  await db.batch([
    db
      .prepare(
        "INSERT INTO fix_result (id, current_revision_id, current_revision, created_at) VALUES (?, ?, 1, ?)",
      )
      .bind(resultId, revisionId, now),
    db
      .prepare(
        `INSERT INTO fix_revision
           (id, fix_result_id, revision, file_hash, validation_hash, content_hash,
            actor_points_user_id, reason, created_at)
         VALUES (?, ?, 1, ?, ?, ?, ?, 'seed balance', ?)`,
      )
      .bind(
        revisionId,
        resultId,
        "1".repeat(64),
        "2".repeat(64),
        "3".repeat(64),
        pointsUserId,
        now,
      ),
    db
      .prepare(
        `INSERT INTO point_ledger_entry
           (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
            delta_amount_scaled, affects_evaluation_total, source_type,
            source_fix_revision_id, created_at)
         VALUES (?, ?, ?, ?, ?, 1, 'FIX', ?, ?)`,
      )
      .bind(
        `seed_ledger_${suffix}`,
        pointsUserId,
        criterionId,
        criterionRevisionId,
        amountScaled,
        revisionId,
        now,
      ),
    db
      .prepare("INSERT INTO fix_revision_seal (fix_revision_id, sealed_at) VALUES (?, ?)")
      .bind(revisionId, now),
  ]);
}

async function seedPackage(suffix: string, pointsUserId: string) {
  const criterionIds = [`criterion_a_${suffix}`, `criterion_b_${suffix}`];
  const criteria = await importEvaluationCriteria(db, {
    actorPointsUserId: pointsUserId,
    reason: "reservation test",
    items: [
      {
        balanceVisibleByDefault: false,
        buyNowEnabled: true,
        description: "A",
        evaluationCriterionId: criterionIds[0]!,
        exchangeEnabled: true,
        expectedRevision: null,
        minimumUnit: "0.0002",
        name: `A ${suffix.slice(0, 8)}`,
        relatedUrls: [],
        status: "ACTIVE",
        transferEnabled: true,
      },
      {
        balanceVisibleByDefault: false,
        buyNowEnabled: true,
        description: "B",
        evaluationCriterionId: criterionIds[1]!,
        exchangeEnabled: true,
        expectedRevision: null,
        minimumUnit: "0.0003",
        name: `B ${suffix.slice(0, 8)}`,
        relatedUrls: [],
        status: "ACTIVE",
        transferEnabled: true,
      },
    ],
  });
  const [pointPackage] = await importPointPackages(db, {
    actorPointsUserId: pointsUserId,
    reason: "reservation test",
    items: [
      {
        components: [
          { displayOrder: 0, evaluationCriterionId: criterionIds[0]!, weight: 1 },
          { displayOrder: 1, evaluationCriterionId: criterionIds[1]!, weight: 2 },
        ],
        description: null,
        expectedRevision: null,
        name: `Package ${suffix.slice(0, 8)}`,
        pointPackageId: `pkg_${suffix}`,
        relatedUrl: null,
        status: "ACTIVE",
      },
    ],
  });
  return { criteria, criterionIds, pointPackage };
}

function createInput(
  suffix: string,
  user: { id: string },
  pointPackageRevisionId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    auctionId: `auc_${suffix}`,
    idempotencyKey: `idem_${suffix}`,
    marketsClientId: "markets-client",
    marketsUserId: `markets_${user.id}`,
    now: new Date("2026-07-13T00:00:00.000Z"),
    planHash: `sha256:${"a".repeat(64)}`,
    pointPackageRevisionId,
    pointsUserId: user.id,
    priceTicks: 18,
    quantity: 2,
    reservationKey: `reservation_${suffix}`,
    settlementId: `settlement_${suffix}`,
    ...overrides,
  };
}

describe("point reservation use cases", () => {
  it("recomputes the immutable package vector, reserves all axes for 15 minutes and replays the same key", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const user = await seedUser(`user_${suffix}`);
    const { criteria, criterionIds, pointPackage } = await seedPackage(suffix, user.id);
    await Promise.all([
      seedBalance(user.id, criterionIds[0]!, criteria[0]!.evaluationCriterionRevisionId, 100),
      seedBalance(user.id, criterionIds[1]!, criteria[1]!.evaluationCriterionRevisionId, 100),
    ]);

    const input = createInput(suffix, user, pointPackage.pointPackageRevisionId, {
      now: new Date(),
    });
    const created = await createPointReservation(db, input);
    const replay = await createPointReservation(db, input);

    expect(created).toMatchObject({
      components: [
        { amountScaled: 12, evaluationCriterionId: criterionIds[0] },
        { amountScaled: 24, evaluationCriterionId: criterionIds[1] },
      ],
      leaseSeconds: 900,
      status: "ACTIVE",
    });
    expect(created.expiresAt.getTime() - created.createdAt.getTime()).toBe(900_000);
    expect(replay).toEqual(created);

    await expect(createPointReservation(db, { ...input, quantity: 4 })).rejects.toThrow(
      "IDEMPOTENCY_KEY_REUSED",
    );
    const stored = await readReservationStatus(db, {
      marketsClientId: input.marketsClientId,
      now: input.now,
      pointReservationIds: [created.pointReservationId],
    });
    expect(stored[0]).toMatchObject({ status: "ACTIVE", terminalAt: null });
  });

  it("checks available balance without writing and resolves status by reservation key", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const user = await seedUser(`user_${suffix}`);
    const { criteria, criterionIds, pointPackage } = await seedPackage(suffix, user.id);
    await Promise.all([
      seedBalance(user.id, criterionIds[0]!, criteria[0]!.evaluationCriterionRevisionId, 100),
      seedBalance(user.id, criterionIds[1]!, criteria[1]!.evaluationCriterionRevisionId, 100),
    ]);
    const input = createInput(suffix, user, pointPackage.pointPackageRevisionId);
    const before = await checkPointBalance(db, {
      now: input.now,
      pointPackageRevisionId: input.pointPackageRevisionId,
      pointsUserId: user.id,
      priceTicks: input.priceTicks,
      quantity: input.quantity,
    });
    expect(before).toMatchObject({
      canReserve: true,
      components: [
        { availableBalanceScaled: "100", requiredAmountScaled: "12", sufficient: true },
        { availableBalanceScaled: "100", requiredAmountScaled: "24", sufficient: true },
      ],
    });

    const created = await createPointReservation(db, input);
    const after = await checkPointBalance(db, {
      now: input.now,
      pointPackageRevisionId: input.pointPackageRevisionId,
      pointsUserId: user.id,
      priceTicks: input.priceTicks,
      quantity: input.quantity,
    });
    expect(after.components.map(({ availableBalanceScaled }) => availableBalanceScaled)).toEqual([
      "88",
      "76",
    ]);
    await expect(
      readReservationStatus(db, {
        marketsClientId: input.marketsClientId,
        now: input.now,
        reservationKeys: [input.reservationKey],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        pointReservationId: created.pointReservationId,
        reservationKey: input.reservationKey,
        status: "ACTIVE",
      }),
    ]);
  });

  it("rejects a route-bound reservation after its Points connection is unlinked", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const user = await seedUser(`user_${suffix}`);
    const { pointPackage } = await seedPackage(suffix, user.id);
    const input = createInput(suffix, user, pointPackage.pointPackageRevisionId);
    const now = input.now.getTime();
    const attemptId = `pla_${suffix}`;
    const connectionId = `pcn_${suffix}`;
    await db.batch([
      db
        .prepare(
          `INSERT INTO points_oauth_link_attempt
             (id, idempotency_key, payload_hash, state_hash, user_client_id, m2m_client_id,
              markets_user_id, points_user_id, requested_scopes, status, created_at, expires_at)
           VALUES (?, ?, ?, ?, 'markets-user-client', ?, ?, ?, '[]', 'CONFIRMED', ?, ?)`,
        )
        .bind(
          attemptId,
          `link_${suffix}`,
          `sha256:${"1".repeat(64)}`,
          `sha256:${"2".repeat(64)}`,
          input.marketsClientId,
          input.marketsUserId,
          user.id,
          now,
          now + 600_000,
        ),
      db
        .prepare(
          `INSERT INTO points_oauth_connection
             (id, link_attempt_id, markets_points_connection_id, user_client_id,
              m2m_client_id, markets_user_id, points_user_id, issuer, points_subject,
              granted_scopes, status, grant_version, linked_at, updated_at)
           VALUES (?, ?, ?, 'markets-user-client', ?, ?, ?, 'https://points.example.test/api/auth',
                   ?, '[]', 'UNLINKED', 2, ?, ?)`,
        )
        .bind(
          connectionId,
          attemptId,
          `mpc_${suffix}`,
          input.marketsClientId,
          input.marketsUserId,
          user.id,
          `subject_${suffix}`,
          now,
          now,
        ),
    ]);

    await expect(
      createPointReservation(db, { ...input, pointsConnectionId: connectionId }),
    ).rejects.toThrow("POINTS_CONNECTION_NOT_ACTIVE");
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM point_reservation WHERE reservation_key = ?")
        .bind(input.reservationKey)
        .first(),
    ).toEqual({ count: 0 });
  });

  it("bulk-loads components within two D1 queries for a 1,000-item reservation list", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const user = await seedUser(`user_${suffix}`);
    const { criteria, criterionIds, pointPackage } = await seedPackage(suffix, user.id);
    await Promise.all([
      seedBalance(user.id, criterionIds[0]!, criteria[0]!.evaluationCriterionRevisionId, 100),
      seedBalance(user.id, criterionIds[1]!, criteria[1]!.evaluationCriterionRevisionId, 100),
    ]);
    const input = createInput(suffix, user, pointPackage.pointPackageRevisionId);
    const created = await createPointReservation(db, input);

    const reservations = await readOwnedReservations(
      withQueryBudget(db, 2),
      input.marketsClientId,
      Array.from({ length: 1_000 }, () => created.pointReservationId),
    );

    expect(reservations).toHaveLength(1_000);
    expect(reservations.every(({ components }) => components.length === 2)).toBe(true);
  });

  it("keeps zero-vector components and captures them without ledger or projection changes", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const user = await seedUser(`user_${suffix}`);
    const { pointPackage } = await seedPackage(suffix, user.id);
    const input = createInput(suffix, user, pointPackage.pointPackageRevisionId, { priceTicks: 0 });
    const created = await createPointReservation(db, input);
    expect(created.components.map(({ amountScaled }) => amountScaled)).toEqual([0, 0]);

    const receipt = await captureSettlement(db, {
      auctionId: input.auctionId,
      idempotencyKey: `capture_${suffix}`,
      marketsClientId: input.marketsClientId,
      now: new Date(input.now.getTime() + 1),
      planHash: input.planHash,
      reservations: [
        {
          expectedVectorHash: created.vectorHash,
          pointReservationId: created.pointReservationId,
        },
      ],
      settlementId: input.settlementId,
    });
    expect(receipt.status).toBe("CAPTURED");
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM point_ledger_entry WHERE source_type = 'RESERVATION_CAPTURE'",
        )
        .first<{ count: number }>("count"),
    ).toBe(0);
  });

  it("rolls back all capture rows after a negative FIX and exposes only owned requested insufficient IDs", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const user = await seedUser(`user_${suffix}`);
    const { criteria, criterionIds, pointPackage } = await seedPackage(suffix, user.id);
    await Promise.all([
      seedBalance(user.id, criterionIds[0]!, criteria[0]!.evaluationCriterionRevisionId, 12),
      seedBalance(user.id, criterionIds[1]!, criteria[1]!.evaluationCriterionRevisionId, 24),
    ]);
    const input = createInput(suffix, user, pointPackage.pointPackageRevisionId);
    const created = await createPointReservation(db, input);
    await seedBalance(user.id, criterionIds[0]!, criteria[0]!.evaluationCriterionRevisionId, -2);

    await expect(
      captureSettlement(db, {
        auctionId: input.auctionId,
        idempotencyKey: `capture_${suffix}`,
        marketsClientId: input.marketsClientId,
        now: new Date(input.now.getTime() + 1),
        planHash: input.planHash,
        reservations: [
          {
            expectedVectorHash: created.vectorHash,
            pointReservationId: created.pointReservationId,
          },
        ],
        settlementId: input.settlementId,
      }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
      insufficientReservationIds: [created.pointReservationId],
    });
    const status = await readReservationStatus(db, {
      marketsClientId: input.marketsClientId,
      now: new Date(input.now.getTime() + 2),
      pointReservationIds: [created.pointReservationId],
    });
    expect(status[0]!.status).toBe("ACTIVE");

    await expect(
      captureSettlement(db, {
        auctionId: input.auctionId,
        idempotencyKey: `capture_unknown_${suffix}`,
        marketsClientId: input.marketsClientId,
        now: new Date(input.now.getTime() + 3),
        planHash: input.planHash,
        reservations: [
          { expectedVectorHash: created.vectorHash, pointReservationId: "prv_unknown" },
        ],
        settlementId: input.settlementId,
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_STATE_CHANGED" });
  });

  it("releases ACTIVE reservations and rejects capture after the exact 15-minute boundary", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const user = await seedUser(`user_${suffix}`);
    const { criteria, criterionIds, pointPackage } = await seedPackage(suffix, user.id);
    await Promise.all([
      seedBalance(user.id, criterionIds[0]!, criteria[0]!.evaluationCriterionRevisionId, 100),
      seedBalance(user.id, criterionIds[1]!, criteria[1]!.evaluationCriterionRevisionId, 100),
    ]);
    const firstInput = createInput(`${suffix}_release`, user, pointPackage.pointPackageRevisionId);
    const first = await createPointReservation(db, firstInput);
    const released = await releasePointReservation(db, {
      idempotencyKey: `release_${suffix}`,
      marketsClientId: firstInput.marketsClientId,
      now: new Date(firstInput.now.getTime() + 1),
      planHash: firstInput.planHash,
      pointReservationId: first.pointReservationId,
      reason: "round restarted",
    });
    expect(released.status).toBe("RELEASED");

    const secondInput = createInput(`${suffix}_expired`, user, pointPackage.pointPackageRevisionId);
    const second = await createPointReservation(db, secondInput);
    await expect(
      captureSettlement(db, {
        auctionId: secondInput.auctionId,
        idempotencyKey: `capture_expired_${suffix}`,
        marketsClientId: secondInput.marketsClientId,
        now: second.expiresAt,
        planHash: secondInput.planHash,
        reservations: [
          {
            expectedVectorHash: second.vectorHash,
            pointReservationId: second.pointReservationId,
          },
        ],
        settlementId: secondInput.settlementId,
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_STATE_CHANGED" });
    const expired = await readReservationStatus(db, {
      marketsClientId: secondInput.marketsClientId,
      now: second.expiresAt,
      pointReservationIds: [second.pointReservationId],
    });
    expect(expired[0]!.status).toBe("EXPIRED");
  });

  it("subtracts unexpired ACTIVE reservations from transfer available balance", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const user = await seedUser(`user_${suffix}`);
    const recipient = await seedUser(`recipient_${suffix}`);
    const { criteria, criterionIds, pointPackage } = await seedPackage(suffix, user.id);
    await Promise.all([
      seedBalance(user.id, criterionIds[0]!, criteria[0]!.evaluationCriterionRevisionId, 100),
      seedBalance(user.id, criterionIds[1]!, criteria[1]!.evaluationCriterionRevisionId, 100),
    ]);
    const input = createInput(suffix, user, pointPackage.pointPackageRevisionId, {
      now: new Date(),
    });
    const reservation = await createPointReservation(db, input);
    const transaction = (key: string) =>
      commitPointTransaction(db, {
        actorPointsUserId: user.id,
        batchId: `ptb_${key}`,
        fileHash: "4".repeat(64),
        idempotencyKey: key,
        items: [
          {
            exchangeRateRevisionId: null,
            id: `pti_${key}`,
            minimumUnitRemainderScaled: null,
            rateDivisionRemainder: null,
            recipientPointsUserId: recipient.id,
            roundingRule: null,
            rowNumber: 2,
            senderPointsUserId: user.id,
            sourceAmountScaled: 90,
            sourceEvaluationCriterionId: criterionIds[0]!,
            sourceEvaluationCriterionRevisionId: criteria[0]!.evaluationCriterionRevisionId,
            targetAmountScaled: null,
            targetEvaluationCriterionId: null,
            targetEvaluationCriterionRevisionId: null,
            transactionType: "TRANSFER",
          },
        ],
        now: input.now,
        payloadHash: "5".repeat(64),
        requestId: `request_${key}`,
        transactionType: "TRANSFER",
        validationHash: "6".repeat(64),
      });

    await expect(transaction(`blocked_${suffix}`)).rejects.toThrow("INSUFFICIENT_BALANCE");
    await releasePointReservation(db, {
      idempotencyKey: `release_available_${suffix}`,
      marketsClientId: input.marketsClientId,
      now: new Date(input.now.getTime() + 1),
      planHash: input.planHash,
      pointReservationId: reservation.pointReservationId,
      reason: "release balance",
    });
    await expect(transaction(`allowed_${suffix}`)).resolves.toMatchObject({
      data: { itemCount: 1 },
    });
  });
});
