import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { importPointPackages } from "../../src/backend/usecases/import-point-packages";
import { updateProfilePointPackages } from "../../src/backend/usecases/update-profile-point-packages";
import { commitFixRows } from "../../src/backend/infrastructure/db/d1-fix-repository";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";
import { validateSubstitutionCsv } from "../../src/backend/usecases/commit-substitution-fixes";

const METHOD_HEADER =
  "sourceEvaluationCriterionId,targetEvaluationCriterionId,expectedRevision,status,similarityNumerator,similarityDenominator,exchangeRateRevisionId";
const EXECUTION_HEADER =
  "sourceEvaluationCriterionId,targetEvaluationCriterionId,evaluationMonth,methodRevisionId,expectedResultRevision";

async function seedAdmin(suffix: string) {
  const authUserId = `substitution-admin-${suffix}`;
  const now = Date.now();
  await env.DB!.batch([
    env
      .DB!.prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(authUserId, authUserId, `${authUserId}@example.invalid`, now, now),
    env
      .DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'google', ?, ?, ?)",
      )
      .bind(`account-${suffix}`, `google-${suffix}`, authUserId, now, now),
  ]);
  const pointsUser = await provisionPointsUser(env.DB!, authUserId, () => `pusr_${suffix}`);
  await env
    .DB!.prepare("INSERT INTO admin_membership (id, points_user_id, role) VALUES (?, ?, 'ADMIN')")
    .bind(`adm_${suffix}`, pointsUser.id)
    .run();
  return { authUserId, pointsUser };
}

async function seedUser(id: string) {
  const now = Date.now();
  await env.DB!.batch([
    env
      .DB!.prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(id, id, `${id}@example.invalid`, now, now),
    env
      .DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'google', ?, ?, ?)",
      )
      .bind(`account-${id}`, `google-${id}`, id, now, now),
  ]);
  return provisionPointsUser(env.DB!, id, () => `pusr_${id}`);
}

async function seedFixBalance(
  actorPointsUserId: string,
  pointsUserId: string,
  criterionId: string,
  criterionRevisionId: string,
  amountScaled: number,
) {
  const suffix = crypto.randomUUID();
  const resultId = `seed-result-${suffix}`;
  const revisionId = `seed-revision-${suffix}`;
  const now = Date.now();
  await env.DB!.batch([
    env
      .DB!.prepare(
        "INSERT INTO fix_result (id, current_revision_id, current_revision, created_at) VALUES (?, ?, 1, ?)",
      )
      .bind(resultId, revisionId, now),
    env
      .DB!.prepare(
        `INSERT INTO fix_revision
           (id, fix_result_id, revision, file_hash, validation_hash, content_hash,
            actor_points_user_id, reason, created_at)
         VALUES (?, ?, 1, ?, ?, ?, ?, 'seed', ?)`,
      )
      .bind(
        revisionId,
        resultId,
        "1".repeat(64),
        "2".repeat(64),
        "3".repeat(64),
        actorPointsUserId,
        now,
      ),
    env
      .DB!.prepare(
        `INSERT INTO point_ledger_entry
           (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
            delta_amount_scaled, affects_evaluation_total, source_type, source_fix_revision_id, created_at)
         VALUES (?, ?, ?, ?, ?, 1, 'FIX', ?, ?)`,
      )
      .bind(
        `seed-ledger-${suffix}`,
        pointsUserId,
        criterionId,
        criterionRevisionId,
        amountScaled,
        revisionId,
        now,
      ),
    env
      .DB!.prepare("INSERT INTO fix_revision_seal (fix_revision_id, sealed_at) VALUES (?, ?)")
      .bind(revisionId, now),
  ]);
}

describe("substitution and automatic distribution", () => {
  it("validates 1,000 substitution method rows with set-based lookups", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const admin = await seedAdmin(`bulk-${suffix}`);
    const fixtures = Array.from({ length: 1_001 }, (_, index) => ({
      criterionId: `bulk-criterion-${suffix}-${index}`,
      name: `Bulk ${suffix} ${index}`,
      normalizedName: `bulk-${suffix}-${index}`,
      revisionId: `bulk-criterion-revision-${suffix}-${index}`,
    }));
    const fixtureJson = JSON.stringify(fixtures);
    await env.DB!.batch([
      env
        .DB!.prepare(
          `INSERT INTO evaluation_criterion
             (id, normalized_name, current_revision_id, current_revision, created_at)
           SELECT json_extract(value, '$.criterionId'), json_extract(value, '$.normalizedName'),
                  json_extract(value, '$.revisionId'), 1, ? FROM json_each(?)`,
        )
        .bind(Date.now(), fixtureJson),
      env
        .DB!.prepare(
          `INSERT INTO evaluation_criterion_revision
             (id, evaluation_criterion_id, revision, status, name, description,
              minimum_unit_scaled, transfer_enabled, exchange_enabled,
              balance_visible_by_default, buy_now_enabled, actor_points_user_id, reason, created_at)
           SELECT json_extract(value, '$.revisionId'), json_extract(value, '$.criterionId'),
                  1, 'ACTIVE', json_extract(value, '$.name'), 'Bulk validation fixture',
                  10000, 1, 1, 0, 1, ?, 'bulk validation fixture', ?
           FROM json_each(?)`,
        )
        .bind(admin.pointsUser.id, Date.now(), fixtureJson),
    ]);
    const sourceId = fixtures[0]!.criterionId;
    const csv = [
      METHOD_HEADER,
      ...fixtures.slice(1).map((fixture) => `${sourceId},${fixture.criterionId},,DISABLED,,,`),
    ].join("\n");

    const validation = await validateSubstitutionCsv(env.DB!, new TextEncoder().encode(csv));

    expect(validation.errors).toEqual([]);
    expect(validation.rows).toHaveLength(1_000);
  });

  it("validates a substitution method CSV through the ADMIN route", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const admin = await seedAdmin(suffix);
    const sourceId = `source_${suffix}`;
    const targetId = `target_${suffix}`;
    const criteria = await importEvaluationCriteria(env.DB!, {
      actorPointsUserId: admin.pointsUser.id,
      items: [sourceId, targetId].map((evaluationCriterionId) => ({
        balanceVisibleByDefault: false,
        buyNowEnabled: true,
        description: "Substitution test criterion",
        evaluationCriterionId,
        exchangeEnabled: true,
        expectedRevision: null,
        minimumUnit: "1",
        name: `${evaluationCriterionId.slice(0, 20)} ${suffix.slice(0, 4)}`,
        relatedUrls: [],
        status: "ACTIVE" as const,
        transferEnabled: true,
      })),
      reason: "substitution test",
    });
    const rateRevisionId = `rate_revision_${suffix}`;
    await env.DB!.batch([
      env
        .DB!.prepare(
          `INSERT INTO exchange_rate
             (source_evaluation_criterion_id, target_evaluation_criterion_id,
              current_revision_id, current_revision, created_at)
           VALUES (?, ?, ?, 1, ?)`,
        )
        .bind(sourceId, targetId, rateRevisionId, Date.now()),
      env
        .DB!.prepare(
          `INSERT INTO exchange_rate_revision
             (id, source_evaluation_criterion_id, target_evaluation_criterion_id,
              source_evaluation_criterion_revision_id, target_evaluation_criterion_revision_id,
              revision, status, numerator, denominator, actor_points_user_id, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 1, 'ACTIVE', 1, 1, ?, 'substitution test', ?)`,
        )
        .bind(
          rateRevisionId,
          sourceId,
          targetId,
          criteria[0]!.evaluationCriterionRevisionId,
          criteria[1]!.evaluationCriterionRevisionId,
          admin.pointsUser.id,
          Date.now(),
        ),
    ]);
    const app = createPointsBackendApp({
      getSession: async () => ({
        session: { createdAt: new Date(), userId: admin.authUserId },
        user: { id: admin.authUserId },
      }),
    });
    const invalidMethodExpected = await app.fetch(
      new Request("https://points.test/api/admin/substitutions/csv/validate", {
        body: `${METHOD_HEADER}\n${sourceId},${targetId},abc,ACTIVE,1,2,${rateRevisionId}`,
        headers: { "Content-Type": "text/csv" },
        method: "POST",
      }),
      env,
    );
    expect(invalidMethodExpected.status).toBe(422);
    await expect(invalidMethodExpected.json()).resolves.toMatchObject({
      code: "CSV_VALIDATION_FAILED",
      errors: [{ code: "REVISION_CONFLICT", column: "expectedRevision", row: 2 }],
    });
    const csv = `${METHOD_HEADER}\n${sourceId},${targetId},,ACTIVE,1,2,${rateRevisionId}`;

    const response = await app.fetch(
      new Request("https://points.test/api/admin/substitutions/csv/validate", {
        body: csv,
        headers: { "Content-Type": "text/csv" },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(200);
    const validation = (await response.json()) as { data: { validationHash: string } };
    const commitRequest = () =>
      app.fetch(
        new Request("https://points.test/api/admin/substitutions/csv/commit", {
          body: csv,
          headers: {
            "Content-Type": "text/csv",
            "Idempotency-Key": `substitution-${suffix}`,
            "X-Reason": "create method",
            "X-Validation-Hash": validation.data.validationHash,
          },
          method: "POST",
        }),
        env,
      );
    const committed = await commitRequest();
    expect(committed.status).toBe(201);
    const responseBody = await committed.json();
    const replay = await commitRequest();
    expect(replay.status).toBe(201);
    await expect(replay.json()).resolves.toEqual(responseBody);
    const method = await env
      .DB!.prepare(
        `SELECT head.current_revision AS revision, revision.status
         FROM substitution_method head
         JOIN substitution_method_revision revision ON revision.id = head.current_revision_id
         WHERE head.source_evaluation_criterion_id = ? AND head.target_evaluation_criterion_id = ?`,
      )
      .bind(sourceId, targetId)
      .first<{ revision: number; status: string; revisionId?: string }>();
    expect(method).toMatchObject({ revision: 1, status: "ACTIVE" });
    const methodRevision = await env
      .DB!.prepare(
        `SELECT current_revision_id AS revisionId FROM substitution_method
         WHERE source_evaluation_criterion_id = ? AND target_evaluation_criterion_id = ?`,
      )
      .bind(sourceId, targetId)
      .first<{ revisionId: string }>();
    await commitFixRows(env.DB!, {
      actorPointsUserId: admin.pointsUser.id,
      auditEventId: `audit-sub-source-${suffix}`,
      fileHash: "6".repeat(64),
      idempotencyKey: `fix-sub-source-${suffix}`,
      now: new Date(),
      reason: "substitution source",
      requestId: `req-sub-source-${suffix}`,
      rows: [
        {
          amount: "9",
          amountScaled: 90_000,
          evaluationAt: "2099-01",
          evaluationCriterionId: sourceId,
          evaluationCriterionRevisionId: criteria[0]!.evaluationCriterionRevisionId,
          expectedRevision: "",
          fixResultId: "",
          managementId: "",
          memo: "",
          minimumUnitScaled: 10_000,
          normalizedRecipientProfileUrl: `https://example.com/${admin.pointsUser.id}`,
          recipientAccountId: null,
          recipientPointsUserId: admin.pointsUser.id,
          recipientProfileUrl: `https://example.com/${admin.pointsUser.id}`,
          recipientProviderId: null,
        },
      ],
      validationHash: "7".repeat(64),
    });
    const executionCsv = `${EXECUTION_HEADER}\n${sourceId},${targetId},2099-01,${methodRevision!.revisionId},`;
    const invalidExecutionExpected = await app.fetch(
      new Request("https://points.test/api/admin/substitutions/csv/validate", {
        body: `${EXECUTION_HEADER}\n${sourceId},${targetId},2099-01,${methodRevision!.revisionId},abc`,
        headers: { "Content-Type": "text/csv" },
        method: "POST",
      }),
      env,
    );
    expect(invalidExecutionExpected.status).toBe(422);
    await expect(invalidExecutionExpected.json()).resolves.toMatchObject({
      code: "CSV_VALIDATION_FAILED",
      errors: [{ code: "REVISION_CONFLICT", column: "expectedResultRevision", row: 2 }],
    });
    const executionValidation = await app.fetch(
      new Request("https://points.test/api/admin/substitutions/csv/validate", {
        body: executionCsv,
        headers: { "Content-Type": "text/csv" },
        method: "POST",
      }),
      env,
    );
    expect(executionValidation.status).toBe(200);
    const executionValidationBody = (await executionValidation.json()) as {
      data: { validationHash: string };
    };
    const execution = await app.fetch(
      new Request("https://points.test/api/admin/substitutions/csv/commit", {
        body: executionCsv,
        headers: {
          "Content-Type": "text/csv",
          "Idempotency-Key": `execution-${suffix}`,
          "X-Reason": "calculate substitution",
          "X-Validation-Hash": executionValidationBody.data.validationHash,
        },
        method: "POST",
      }),
      env,
    );
    expect(execution.status).toBe(201);
    const executionBody = (await execution.json()) as {
      data: { results: Array<{ resultRevisionId: string }> };
    };
    await expect(
      env
        .DB!.prepare(
          `INSERT INTO point_ledger_entry
             (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
              delta_amount_scaled, affects_evaluation_total, source_type,
              source_substitution_result_revision_id, created_at)
           VALUES (?, ?, ?, ?, 1, 1, 'SUBSTITUTION_FIX', ?, ?)`,
        )
        .bind(
          `invalid-substitution-ledger-${suffix}`,
          admin.pointsUser.id,
          targetId,
          criteria[1]!.evaluationCriterionRevisionId,
          executionBody.data.results[0]!.resultRevisionId,
          Date.now(),
        )
        .run(),
    ).rejects.toThrow("SUBSTITUTION_LEDGER_INVALID");
    const targetAccount = await env
      .DB!.prepare(
        `SELECT balance, evaluation_total AS evaluationTotal FROM point_account
         WHERE points_user_id = ? AND evaluation_criterion_id = ?`,
      )
      .bind(admin.pointsUser.id, targetId)
      .first<{ balance: number; evaluationTotal: number }>();
    expect(targetAccount).toEqual({ balance: 40_000, evaluationTotal: 40_000 });
  });

  it("commits an immutable setting and distributes a positive FIX in the same batch", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    const admin = await seedAdmin(`dist-admin-${suffix}`);
    const sourceAuthId = `dist-source-${suffix}`;
    const candidateAuthId = `dist-candidate-${suffix}`;
    const source = await seedUser(sourceAuthId);
    const candidate = await seedUser(candidateAuthId);
    const criterionId = `dist-criterion-${suffix}`;
    const [criterion] = await importEvaluationCriteria(env.DB!, {
      actorPointsUserId: admin.pointsUser.id,
      items: [
        {
          balanceVisibleByDefault: false,
          buyNowEnabled: true,
          description: "Distribution criterion",
          evaluationCriterionId: criterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "1",
          name: `Distribution ${suffix}`,
          relatedUrls: [],
          status: "ACTIVE",
          transferEnabled: true,
        },
      ],
      reason: "distribution test",
    });
    const packageId = `dist-package-${suffix}`;
    await importPointPackages(env.DB!, {
      actorPointsUserId: admin.pointsUser.id,
      items: [
        {
          components: [{ displayOrder: 0, evaluationCriterionId: criterionId, weight: 1 }],
          description: null,
          expectedRevision: null,
          name: `Distribution Package ${suffix}`,
          pointPackageId: packageId,
          relatedUrl: null,
          status: "ACTIVE",
        },
      ],
      reason: "distribution test",
    });
    await updateProfilePointPackages(env.DB!, {
      pointPackageIds: [packageId],
      pointsUserId: source.id,
    });
    await seedFixBalance(
      admin.pointsUser.id,
      candidate.id,
      criterionId,
      criterion.evaluationCriterionRevisionId,
      100_000,
    );

    const beforeSetting = await commitFixRows(env.DB!, {
      actorPointsUserId: admin.pointsUser.id,
      auditEventId: `audit-before-setting-${suffix}`,
      fileHash: "a".repeat(64),
      idempotencyKey: `fix-before-setting-${suffix}`,
      now: new Date(),
      reason: "FIX before distribution setting",
      requestId: `req-before-setting-${suffix}`,
      rows: [
        {
          amount: "10",
          amountScaled: 100_000,
          evaluationAt: "2098-12",
          evaluationCriterionId: criterionId,
          evaluationCriterionRevisionId: criterion.evaluationCriterionRevisionId,
          expectedRevision: "",
          fixResultId: "",
          managementId: "before-setting",
          memo: "",
          minimumUnitScaled: 10_000,
          normalizedRecipientProfileUrl: `https://example.com/before-${source.id}`,
          recipientAccountId: null,
          recipientPointsUserId: source.id,
          recipientProfileUrl: `https://example.com/before-${source.id}`,
          recipientProviderId: null,
        },
      ],
      validationHash: "b".repeat(64),
    });

    const app = createPointsBackendApp({
      getSession: async () => ({
        session: { createdAt: new Date(), userId: sourceAuthId },
        user: { id: sourceAuthId },
      }),
    });
    const settingCsv =
      `expectedRevision,status,pointPackageId,retentionType,retentionPercent,retentionAmount\n` +
      `,ON,${packageId},PERCENT,50,`;
    const validate = await app.fetch(
      new Request("https://points.test/api/settings/auto-distribution/csv/validate", {
        body: settingCsv,
        headers: { "Content-Type": "text/csv" },
        method: "POST",
      }),
      env,
    );
    expect(validate.status).toBe(200);
    const validation = (await validate.json()) as { data: { validationHash: string } };
    const setting = await app.fetch(
      new Request("https://points.test/api/settings/auto-distribution/csv/commit", {
        body: settingCsv,
        headers: {
          "Content-Type": "text/csv",
          "Idempotency-Key": `setting-${suffix}`,
          "X-Validation-Hash": validation.data.validationHash,
        },
        method: "POST",
      }),
      env,
    );
    expect(setting.status).toBe(201);

    await commitFixRows(env.DB!, {
      actorPointsUserId: admin.pointsUser.id,
      auditEventId: `audit-before-setting-correction-${suffix}`,
      fileHash: "c".repeat(64),
      idempotencyKey: `fix-before-setting-correction-${suffix}`,
      now: new Date(Date.now() + 1),
      reason: "correct pre-setting FIX after enabling",
      requestId: `req-before-setting-correction-${suffix}`,
      rows: [
        {
          amount: "20",
          amountScaled: 200_000,
          evaluationAt: "2098-12",
          evaluationCriterionId: criterionId,
          evaluationCriterionRevisionId: criterion.evaluationCriterionRevisionId,
          expectedRevision: "1",
          fixResultId: beforeSetting.results[0]!.fixResultId,
          managementId: "before-setting",
          memo: "",
          minimumUnitScaled: 10_000,
          normalizedRecipientProfileUrl: `https://example.com/before-${source.id}`,
          recipientAccountId: null,
          recipientPointsUserId: source.id,
          recipientProfileUrl: `https://example.com/before-${source.id}`,
          recipientProviderId: null,
        },
      ],
      validationHash: "d".repeat(64),
    });
    const disabledSnapshot = await env
      .DB!.prepare(
        `SELECT outcome, setting_revision_id AS settingRevisionId
         FROM auto_distribution_snapshot WHERE source_fix_result_id = ?`,
      )
      .bind(beforeSetting.results[0]!.fixResultId)
      .first<{ outcome: string; settingRevisionId: string | null }>();
    expect(disabledSnapshot).toEqual({ outcome: "NOT_ENABLED", settingRevisionId: null });

    await importPointPackages(env.DB!, {
      actorPointsUserId: admin.pointsUser.id,
      items: [
        {
          components: [{ displayOrder: 0, evaluationCriterionId: criterionId, weight: 1 }],
          description: "New current revision keeps the saved distribution revision valid",
          expectedRevision: 1,
          name: `Distribution Package ${suffix} v2`,
          pointPackageId: packageId,
          relatedUrl: null,
          status: "ACTIVE",
        },
      ],
      reason: "advance package revision after distribution setting",
    });

    const initialFix = await commitFixRows(env.DB!, {
      actorPointsUserId: admin.pointsUser.id,
      auditEventId: `audit-dist-${suffix}`,
      fileHash: "4".repeat(64),
      idempotencyKey: `fix-dist-${suffix}`,
      now: new Date(),
      reason: "distribution FIX",
      requestId: `req-dist-${suffix}`,
      rows: [
        {
          amount: "10",
          amountScaled: 100_000,
          evaluationAt: "2099-01",
          evaluationCriterionId: criterionId,
          evaluationCriterionRevisionId: criterion.evaluationCriterionRevisionId,
          expectedRevision: "",
          fixResultId: "",
          managementId: "",
          memo: "",
          minimumUnitScaled: 10_000,
          normalizedRecipientProfileUrl: `https://example.com/${source.id}`,
          recipientAccountId: null,
          recipientPointsUserId: source.id,
          recipientProfileUrl: `https://example.com/${source.id}`,
          recipientProviderId: null,
        },
      ],
      validationHash: "5".repeat(64),
    });
    const accounts = await env
      .DB!.prepare(
        `SELECT points_user_id AS pointsUserId, balance, evaluation_total AS evaluationTotal
         FROM point_account WHERE evaluation_criterion_id = ?
           AND points_user_id IN (?, ?) ORDER BY points_user_id`,
      )
      .bind(criterionId, source.id, candidate.id)
      .all<{ balance: number; evaluationTotal: number; pointsUserId: string }>();
    const byUser = new Map(accounts.results.map((row) => [row.pointsUserId, row]));
    expect(byUser.get(source.id)).toMatchObject({ balance: 250_000, evaluationTotal: 300_000 });
    expect(byUser.get(candidate.id)).toMatchObject({
      balance: 150_000,
      evaluationTotal: 100_000,
    });
    const distributionLedger = await env
      .DB!.prepare(
        `SELECT source_type AS sourceType, affects_evaluation_total AS affectsEvaluationTotal,
                delta_amount_scaled AS delta
         FROM point_ledger_entry WHERE source_auto_distribution_revision_id IS NOT NULL
         ORDER BY source_type`,
      )
      .all<{ affectsEvaluationTotal: number; delta: number; sourceType: string }>();
    expect(distributionLedger.results).toEqual([
      { affectsEvaluationTotal: 0, delta: 50_000, sourceType: "AUTO_DISTRIBUTION_CREDIT" },
      { affectsEvaluationTotal: 0, delta: -50_000, sourceType: "AUTO_DISTRIBUTION_DEBIT" },
    ]);
    const savedSnapshot = await env
      .DB!.prepare(
        `SELECT target.component_snapshot AS componentSnapshot,
                revision.allocation_snapshot AS allocationSnapshot
         FROM auto_distribution_snapshot snapshot
         JOIN auto_distribution_snapshot_target target ON target.snapshot_id = snapshot.id
         JOIN auto_distribution_revision revision ON revision.snapshot_id = snapshot.id
         WHERE snapshot.source_fix_result_id = ?`,
      )
      .bind(initialFix.results[0]!.fixResultId)
      .first<{ allocationSnapshot: string; componentSnapshot: string }>();
    expect(JSON.parse(savedSnapshot!.componentSnapshot)[0]).toMatchObject({
      evaluationCriterionId: criterionId,
      evaluationCriterionRevisionId: criterion.evaluationCriterionRevisionId,
      evaluationTotalScaled: 100_000,
      weight: 1,
    });
    expect(JSON.parse(savedSnapshot!.allocationSnapshot)[0]).toMatchObject({
      amountScaled: 50_000,
      baseQuotientUnits: "5",
      finalUnitCount: "5",
      pointsUserId: candidate.id,
      remainder: "0",
      score: 100_000,
      tieBreakOrder: 0,
    });

    await env
      .DB!.prepare("UPDATE points_user SET account_status = 'CLOSED' WHERE id = ?")
      .bind(candidate.id)
      .run();
    await commitFixRows(env.DB!, {
      actorPointsUserId: admin.pointsUser.id,
      auditEventId: `audit-dist-correction-${suffix}`,
      fileHash: "8".repeat(64),
      idempotencyKey: `fix-dist-correction-${suffix}`,
      now: new Date(Date.now() + 1),
      reason: "cancel distributed FIX",
      requestId: `req-dist-correction-${suffix}`,
      rows: [
        {
          amount: "0",
          amountScaled: 0,
          evaluationAt: "2099-01",
          evaluationCriterionId: criterionId,
          evaluationCriterionRevisionId: criterion.evaluationCriterionRevisionId,
          expectedRevision: "1",
          fixResultId: initialFix.results[0]!.fixResultId,
          managementId: "",
          memo: "",
          minimumUnitScaled: 10_000,
          normalizedRecipientProfileUrl: `https://example.com/${source.id}`,
          recipientAccountId: null,
          recipientPointsUserId: source.id,
          recipientProfileUrl: `https://example.com/${source.id}`,
          recipientProviderId: null,
        },
      ],
      validationHash: "9".repeat(64),
    });
    const correctedAccounts = await env
      .DB!.prepare(
        `SELECT points_user_id AS pointsUserId, balance, evaluation_total AS evaluationTotal
         FROM point_account WHERE evaluation_criterion_id = ?
           AND points_user_id IN (?, ?) ORDER BY points_user_id`,
      )
      .bind(criterionId, source.id, candidate.id)
      .all<{ balance: number; evaluationTotal: number; pointsUserId: string }>();
    const correctedByUser = new Map(
      correctedAccounts.results.map((row) => [row.pointsUserId, row]),
    );
    expect(correctedByUser.get(source.id)).toMatchObject({
      balance: 200_000,
      evaluationTotal: 200_000,
    });
    expect(correctedByUser.get(candidate.id)).toMatchObject({
      balance: 100_000,
      evaluationTotal: 100_000,
    });

    await updateProfilePointPackages(env.DB!, { pointPackageIds: [], pointsUserId: source.id });
    await commitFixRows(env.DB!, {
      actorPointsUserId: admin.pointsUser.id,
      auditEventId: `audit-unregistered-package-${suffix}`,
      fileHash: "e".repeat(64),
      idempotencyKey: `fix-unregistered-package-${suffix}`,
      now: new Date(Date.now() + 2),
      reason: "FIX after package unregistered",
      requestId: `req-unregistered-package-${suffix}`,
      rows: [
        {
          amount: "5",
          amountScaled: 50_000,
          evaluationAt: "2099-02",
          evaluationCriterionId: criterionId,
          evaluationCriterionRevisionId: criterion.evaluationCriterionRevisionId,
          expectedRevision: "",
          fixResultId: "",
          managementId: "unregistered-package",
          memo: "",
          minimumUnitScaled: 10_000,
          normalizedRecipientProfileUrl: `https://example.com/unregistered-${source.id}`,
          recipientAccountId: null,
          recipientPointsUserId: source.id,
          recipientProfileUrl: `https://example.com/unregistered-${source.id}`,
          recipientProviderId: null,
        },
      ],
      validationHash: "f".repeat(64),
    });
    const outcomes = await env
      .DB!.prepare(
        `SELECT outcome, COUNT(*) AS count FROM auto_distribution_snapshot
         WHERE source_points_user_id = ? GROUP BY outcome ORDER BY outcome`,
      )
      .bind(source.id)
      .all<{ count: number; outcome: string }>();
    expect(outcomes.results).toEqual([
      { count: 1, outcome: "DISTRIBUTED" },
      { count: 2, outcome: "NOT_ENABLED" },
    ]);
  });
});
