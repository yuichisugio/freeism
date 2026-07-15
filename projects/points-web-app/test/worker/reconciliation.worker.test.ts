import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { importPointPackages } from "../../src/backend/usecases/import-point-packages";
import { createPointReservation } from "../../src/backend/usecases/create-point-reservation";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";

const db = env.DB!;

async function seedAdmin(suffix: string) {
  const authUserId = `reconciliation-admin-${suffix}`;
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(authUserId, authUserId, `${authUserId}@example.invalid`, now, now),
    db
      .prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'google', ?, ?, ?)",
      )
      .bind(`account-${suffix}`, `google-${suffix}`, authUserId, now, now),
  ]);
  const pointsUser = await provisionPointsUser(db, authUserId, () => `pusr_${suffix}`);
  await db
    .prepare("INSERT INTO admin_membership (id, points_user_id, role) VALUES (?, ?, 'ADMIN')")
    .bind(`adm_${suffix}`, pointsUser.id)
    .run();
  return { authUserId, pointsUser };
}

function authenticatedApp(authUserId: string, createdAt = new Date()) {
  return createPointsBackendApp({
    getSession: async () => ({
      session: { createdAt, userId: authUserId },
      user: { id: authUserId },
    }),
  });
}

async function seedFixSource(input: {
  amountScaled: number;
  criterionId: string;
  criterionRevisionId: string;
  pointsUserId: string;
  recipientProfileUrl: string;
  suffix: string;
  target: "LEDGER" | "UNCLAIMED";
}) {
  const now = Date.now();
  const resultId = `fix_${input.suffix}`;
  const revisionId = `fixrev_${input.suffix}`;
  const unclaimedFixEntryId = `unclaimed_${input.suffix}`;
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
         VALUES (?, ?, 1, ?, ?, ?, ?, 'reconciliation fixture', ?)`,
      )
      .bind(
        revisionId,
        resultId,
        "1".repeat(64),
        "2".repeat(64),
        "3".repeat(64),
        input.pointsUserId,
        now,
      ),
    input.target === "LEDGER"
      ? db
          .prepare(
            `INSERT INTO point_ledger_entry
               (id, points_user_id, evaluation_criterion_id,
                evaluation_criterion_revision_id, delta_amount_scaled,
                affects_evaluation_total, source_type, source_fix_revision_id, created_at)
             VALUES (?, ?, ?, ?, ?, 1, 'FIX', ?, ?)`,
          )
          .bind(
            `ledger_${input.suffix}`,
            input.pointsUserId,
            input.criterionId,
            input.criterionRevisionId,
            input.amountScaled,
            revisionId,
            now,
          )
      : db
          .prepare(
            `INSERT INTO unclaimed_fix_entry
               (id, source_fix_revision_id, recipient_profile_url,
                evaluation_criterion_id, evaluation_criterion_revision_id,
                delta_amount_scaled, evaluation_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, '2026-07', ?)`,
          )
          .bind(
            unclaimedFixEntryId,
            revisionId,
            input.recipientProfileUrl,
            input.criterionId,
            input.criterionRevisionId,
            input.amountScaled,
            now,
          ),
    db
      .prepare("INSERT INTO fix_revision_seal (fix_revision_id, sealed_at) VALUES (?, ?)")
      .bind(revisionId, now),
  ]);
  return { revisionId, unclaimedFixEntryId };
}

describe("Points reconciliation", () => {
  it("exposes the read-only ADMIN report route", async () => {
    const suffix = crypto.randomUUID();
    const { authUserId } = await seedAdmin(suffix);
    const response = await authenticatedApp(authUserId).fetch(
      new Request("https://points.test/api/reconciliation"),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        accountMismatches: [],
        claimMismatches: [],
        consistent: true,
      },
    });
  });

  it("requires an idempotency key for the manual ADMIN run", async () => {
    const suffix = crypto.randomUUID();
    const { authUserId } = await seedAdmin(suffix);
    const response = await authenticatedApp(authUserId).fetch(
      new Request("https://points.test/api/reconciliation/run", {
        body: JSON.stringify({ reason: "scheduled verification" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "IDEMPOTENCY_KEY_REQUIRED" });
  });

  it("requires a reason for the manual ADMIN run", async () => {
    const suffix = crypto.randomUUID();
    const { authUserId } = await seedAdmin(suffix);
    const response = await authenticatedApp(authUserId).fetch(
      new Request("https://points.test/api/reconciliation/run", {
        body: JSON.stringify({ reason: "" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `reconcile-${suffix}`,
        },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "RECONCILIATION_REASON_REQUIRED",
    });
  });

  it("reports ledger, reservation, and claim differences without repairing data and audits one idempotent run", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const { authUserId, pointsUser } = await seedAdmin(suffix);
    const [criterion] = await importEvaluationCriteria(db, {
      actorPointsUserId: pointsUser.id,
      items: [
        {
          balanceVisibleByDefault: false,
          buyNowEnabled: true,
          description: "Reconciliation criterion",
          evaluationCriterionId: `criterion_${suffix}`,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.0001",
          name: `Reconciliation ${suffix.slice(0, 8)}`,
          relatedUrls: [],
          status: "ACTIVE",
          transferEnabled: true,
        },
      ],
      reason: "reconciliation fixture",
    });
    await seedFixSource({
      amountScaled: 100,
      criterionId: criterion!.evaluationCriterionId,
      criterionRevisionId: criterion!.evaluationCriterionRevisionId,
      pointsUserId: pointsUser.id,
      recipientProfileUrl: `https://example.test/${suffix}/ledger`,
      suffix: `${suffix}_ledger`,
      target: "LEDGER",
    });
    const [pointPackage] = await importPointPackages(db, {
      actorPointsUserId: pointsUser.id,
      items: [
        {
          components: [
            {
              displayOrder: 0,
              evaluationCriterionId: criterion!.evaluationCriterionId,
              weight: 1,
            },
          ],
          description: null,
          expectedRevision: null,
          name: `Reconciliation package ${suffix.slice(0, 8)}`,
          pointPackageId: `pkg_${suffix}`,
          relatedUrl: null,
          status: "ACTIVE",
        },
      ],
      reason: "reconciliation fixture",
    });
    await createPointReservation(db, {
      auctionId: `auc_${suffix}`,
      idempotencyKey: `reservation-${suffix}`,
      marketsClientId: "markets-reconciliation",
      marketsUserId: `markets_${suffix}`,
      planHash: `sha256:${"a".repeat(64)}`,
      pointPackageRevisionId: pointPackage!.pointPackageRevisionId,
      pointsUserId: pointsUser.id,
      priceTicks: 25,
      quantity: 1,
      reservationKey: `reservation_${suffix}`,
      settlementId: `settlement_${suffix}`,
    });
    const pending = await seedFixSource({
      amountScaled: -5,
      criterionId: criterion!.evaluationCriterionId,
      criterionRevisionId: criterion!.evaluationCriterionRevisionId,
      pointsUserId: pointsUser.id,
      recipientProfileUrl: `https://example.test/${suffix}/pending`,
      suffix: `${suffix}_pending`,
      target: "UNCLAIMED",
    });
    const inconsistentClaim = await seedFixSource({
      amountScaled: 7,
      criterionId: criterion!.evaluationCriterionId,
      criterionRevisionId: criterion!.evaluationCriterionRevisionId,
      pointsUserId: pointsUser.id,
      recipientProfileUrl: `https://example.test/${suffix}/claimed`,
      suffix: `${suffix}_claimed`,
      target: "UNCLAIMED",
    });
    await db
      .prepare(
        `INSERT INTO point_ledger_entry
           (id, points_user_id, evaluation_criterion_id,
            evaluation_criterion_revision_id, delta_amount_scaled,
            affects_evaluation_total, source_type, source_fix_revision_id,
            source_unclaimed_fix_entry_id, created_at)
         VALUES (?, ?, ?, ?, 7, 1, 'FIX', ?, ?, ?)`,
      )
      .bind(
        `ledger_${suffix}_claimed`,
        pointsUser.id,
        criterion!.evaluationCriterionId,
        criterion!.evaluationCriterionRevisionId,
        inconsistentClaim.revisionId,
        inconsistentClaim.unclaimedFixEntryId,
        Date.now(),
      )
      .run();
    await db
      .prepare(
        `UPDATE point_account SET balance = balance + 1
         WHERE points_user_id = ? AND evaluation_criterion_id = ?`,
      )
      .bind(pointsUser.id, criterion!.evaluationCriterionId)
      .run();

    const ledgerCountBefore = await db
      .prepare("SELECT count(*) AS count FROM point_ledger_entry")
      .first<{ count: number }>();
    const request = () =>
      authenticatedApp(authUserId).fetch(
        new Request("https://points.test/api/reconciliation/run", {
          body: JSON.stringify({ reason: "manual reconciliation" }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `reconcile-${suffix}`,
          },
          method: "POST",
        }),
        env,
      );
    const first = await request();
    const firstBody = (await first.json()) as { data: Record<string, unknown> };
    const replay = await request();
    const replayBody = await replay.json();

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replayBody).toEqual(firstBody);
    expect(firstBody.data).toMatchObject({
      accountMismatches: [
        {
          actualBalance: 108,
          actualEvaluationTotal: 107,
          evaluationCriterionId: criterion!.evaluationCriterionId,
          expectedBalance: 107,
          expectedEvaluationTotal: 107,
          pointsUserId: pointsUser.id,
        },
      ],
      activeReservationTotals: [
        {
          amountScaled: 25,
          evaluationCriterionId: criterion!.evaluationCriterionId,
          pointsUserId: pointsUser.id,
          reservationCount: 1,
        },
      ],
      claimMismatches: [
        {
          claimed: false,
          ledgered: true,
          unclaimedFixEntryId: inconsistentClaim.unclaimedFixEntryId,
        },
      ],
      claimSummary: { claimedCount: 0, unclaimedCount: 2 },
      consistent: false,
    });
    expect(pending.unclaimedFixEntryId).not.toBe(inconsistentClaim.unclaimedFixEntryId);
    const ledgerCountAfter = await db
      .prepare("SELECT count(*) AS count FROM point_ledger_entry")
      .first<{ count: number }>();
    expect(ledgerCountAfter).toEqual(ledgerCountBefore);
    const audits = await db
      .prepare(
        `SELECT action, reason, result FROM audit_event
         WHERE actor_points_user_id = ? AND action = 'POINTS_RECONCILIATION'`,
      )
      .bind(pointsUser.id)
      .all<{ action: string; reason: string; result: string }>();
    expect(audits.results).toEqual([
      {
        action: "POINTS_RECONCILIATION",
        reason: "manual reconciliation",
        result: "MISMATCH",
      },
    ]);
  });
});
