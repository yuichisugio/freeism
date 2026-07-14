import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";

const RATE_HEADER =
  "sourceEvaluationCriterionId,targetEvaluationCriterionId,expectedRevision,status,numerator,denominator";
const TRANSFER_HEADER = "evaluationCriterionId,amount,recipientPointsUserId";
const EXCHANGE_HEADER =
  "sourceEvaluationCriterionId,sourceAmount,targetEvaluationCriterionId,targetAmount";

async function seedAuthUser(id: string) {
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
      .bind(`account_${id}`, `google_${id}`, id, now, now),
  ]);
  return provisionPointsUser(env.DB!, id, () => `pusr_${id}`);
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
    env
      .DB!.prepare(
        `INSERT INTO point_ledger_entry
           (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
            delta_amount_scaled, affects_evaluation_total, source_type, source_fix_revision_id,
            created_at)
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
    env
      .DB!.prepare("INSERT INTO fix_revision_seal (fix_revision_id, sealed_at) VALUES (?, ?)")
      .bind(revisionId, now),
  ]);
}

describe("transfer and exchange transaction ledger", () => {
  it("commits a directed rate, transfer and exchange as double-entry ledger writes", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const adminAuthId = `admin_${suffix}`;
    const aliceAuthId = `alice_${suffix}`;
    const bobAuthId = `bob_${suffix}`;
    const [admin, alice, bob] = await Promise.all([
      seedAuthUser(adminAuthId),
      seedAuthUser(aliceAuthId),
      seedAuthUser(bobAuthId),
    ]);
    await env
      .DB!.prepare("INSERT INTO admin_membership (id, points_user_id, role) VALUES (?, ?, 'ADMIN')")
      .bind(`adm_${suffix}`, admin.id)
      .run();
    const sourceCriterionId = `source_${suffix}`;
    const targetCriterionId = `target_${suffix}`;
    const criteria = await importEvaluationCriteria(env.DB!, {
      actorPointsUserId: admin.id,
      items: [
        {
          balanceVisibleByDefault: false,
          buyNowEnabled: true,
          description: "Source criterion",
          evaluationCriterionId: sourceCriterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.0001",
          name: `Source ${suffix.slice(0, 8)}`,
          relatedUrls: [],
          status: "ACTIVE",
          transferEnabled: true,
        },
        {
          balanceVisibleByDefault: false,
          buyNowEnabled: true,
          description: "Target criterion",
          evaluationCriterionId: targetCriterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.1",
          name: `Target ${suffix.slice(0, 8)}`,
          relatedUrls: [],
          status: "ACTIVE",
          transferEnabled: true,
        },
      ],
      reason: "transaction test",
    });
    await seedBalance(
      alice.id,
      sourceCriterionId,
      criteria[0].evaluationCriterionRevisionId,
      200_000,
    );

    const app = createPointsBackendApp({
      getSession: async (_bindings, headers) => {
        const userId = headers.get("X-Test-Auth-User");
        return userId ? { session: { createdAt: new Date(), userId }, user: { id: userId } } : null;
      },
    });
    const requestCsv = (
      path: string,
      csv: string,
      authUserId: string,
      headers: Record<string, string> = {},
    ) =>
      app.fetch(
        new Request(`https://points.test${path}`, {
          body: csv,
          headers: {
            "Content-Type": "text/csv",
            "X-Test-Auth-User": authUserId,
            ...headers,
          },
          method: "POST",
        }),
        env,
      );

    const rateCsv = `${RATE_HEADER}\n${sourceCriterionId},${targetCriterionId},,ACTIVE,2,3`;
    const ratePreview = await requestCsv(
      "/api/admin/exchange-rates/csv/validate",
      rateCsv,
      adminAuthId,
    );
    expect(ratePreview.status).toBe(200);
    const ratePreviewBody = (await ratePreview.json()) as { data: { validationHash: string } };
    const rateCommit = await requestCsv(
      "/api/admin/exchange-rates/csv/commit",
      rateCsv,
      adminAuthId,
      {
        "Idempotency-Key": `rate_${suffix}`,
        "X-Reason": "create directed rate",
        "X-Validation-Hash": ratePreviewBody.data.validationHash,
      },
    );
    expect(rateCommit.status).toBe(201);

    const transferCsv = `${TRANSFER_HEADER}\n${sourceCriterionId},2,${bob.id}`;
    const transferPreview = await requestCsv(
      "/api/transfers/csv/validate",
      transferCsv,
      aliceAuthId,
    );
    expect(transferPreview.status).toBe(200);
    const transferPreviewBody = (await transferPreview.json()) as {
      data: { validationHash: string };
    };
    const transferHeaders = {
      "Idempotency-Key": `transfer_${suffix}`,
      "X-Validation-Hash": transferPreviewBody.data.validationHash,
    };
    const [transferCommit, transferRetry] = await Promise.all([
      requestCsv("/api/transfers/csv/commit", transferCsv, aliceAuthId, transferHeaders),
      requestCsv("/api/transfers/csv/commit", transferCsv, aliceAuthId, transferHeaders),
    ]);
    expect(transferCommit.status).toBe(201);
    const transferBody = await transferCommit.json();
    expect(transferRetry.status).toBe(201);
    await expect(transferRetry.json()).resolves.toEqual(transferBody);

    const exchangeCsv = `${EXCHANGE_HEADER}\n${sourceCriterionId},3,${targetCriterionId},\n${sourceCriterionId},,${targetCriterionId},2\n${sourceCriterionId},3,${targetCriterionId},2`;
    const exchangePreview = await requestCsv(
      "/api/exchanges/csv/validate",
      exchangeCsv,
      aliceAuthId,
    );
    expect(exchangePreview.status).toBe(200);
    const exchangePreviewBody = (await exchangePreview.json()) as {
      data: { validationHash: string };
    };
    const exchangeCommit = await requestCsv("/api/exchanges/csv/commit", exchangeCsv, aliceAuthId, {
      "Idempotency-Key": `exchange_${suffix}`,
      "X-Validation-Hash": exchangePreviewBody.data.validationHash,
    });
    expect(exchangeCommit.status).toBe(201);

    const accounts = await env
      .DB!.prepare(
        `SELECT points_user_id AS pointsUserId, evaluation_criterion_id AS criterionId,
                balance, evaluation_total AS evaluationTotal
         FROM point_account
         WHERE points_user_id IN (?, ?)
           AND evaluation_criterion_id IN (?, ?)
         ORDER BY points_user_id, evaluation_criterion_id`,
      )
      .bind(alice.id, bob.id, sourceCriterionId, targetCriterionId)
      .all<{
        balance: number;
        criterionId: string;
        evaluationTotal: number;
        pointsUserId: string;
      }>();
    expect(accounts.results).toEqual(
      [
        {
          balance: 90_000,
          criterionId: sourceCriterionId,
          evaluationTotal: 200_000,
          pointsUserId: alice.id,
        },
        {
          balance: 60_000,
          criterionId: targetCriterionId,
          evaluationTotal: 0,
          pointsUserId: alice.id,
        },
        {
          balance: 20_000,
          criterionId: sourceCriterionId,
          evaluationTotal: 0,
          pointsUserId: bob.id,
        },
      ].sort((left, right) =>
        `${left.pointsUserId}:${left.criterionId}`.localeCompare(
          `${right.pointsUserId}:${right.criterionId}`,
        ),
      ),
    );
    const transactionLedger = await env
      .DB!.prepare(
        `SELECT source_type AS sourceType, affects_evaluation_total AS affectsEvaluationTotal,
                COUNT(*) AS count
         FROM point_ledger_entry WHERE source_transaction_item_id IS NOT NULL
         GROUP BY source_type, affects_evaluation_total ORDER BY source_type`,
      )
      .all<{ affectsEvaluationTotal: number; count: number; sourceType: string }>();
    expect(transactionLedger.results).toEqual([
      { affectsEvaluationTotal: 0, count: 3, sourceType: "EXCHANGE_BURN" },
      { affectsEvaluationTotal: 0, count: 3, sourceType: "EXCHANGE_MINT" },
      { affectsEvaluationTotal: 0, count: 1, sourceType: "TRANSFER_CREDIT" },
      { affectsEvaluationTotal: 0, count: 1, sourceType: "TRANSFER_DEBIT" },
    ]);

    const rateRevision = await env
      .DB!.prepare(
        `SELECT id FROM exchange_rate_revision
         WHERE source_evaluation_criterion_id = ? AND target_evaluation_criterion_id = ?`,
      )
      .bind(sourceCriterionId, targetCriterionId)
      .first<{ id: string }>();
    await expect(
      env
        .DB!.prepare("UPDATE exchange_rate_revision SET numerator = 1 WHERE id = ?")
        .bind(rateRevision!.id)
        .run(),
    ).rejects.toThrow("IMMUTABLE_EXCHANGE_RATE_REVISION");

    const disabledRateCsv = `${RATE_HEADER}\n${sourceCriterionId},${targetCriterionId},1,DISABLED,,`;
    const disabledPreview = await requestCsv(
      "/api/admin/exchange-rates/csv/validate",
      disabledRateCsv,
      adminAuthId,
    );
    expect(disabledPreview.status).toBe(200);
    const disabledPreviewBody = (await disabledPreview.json()) as {
      data: { validationHash: string };
    };
    const disabledCommit = await requestCsv(
      "/api/admin/exchange-rates/csv/commit",
      disabledRateCsv,
      adminAuthId,
      {
        "Idempotency-Key": `rate_disabled_${suffix}`,
        "X-Reason": "disable directed rate",
        "X-Validation-Hash": disabledPreviewBody.data.validationHash,
      },
    );
    expect(disabledCommit.status).toBe(201);
    const revisions = await env
      .DB!.prepare(
        `SELECT revision, status FROM exchange_rate_revision
         WHERE source_evaluation_criterion_id = ? AND target_evaluation_criterion_id = ?
         ORDER BY revision`,
      )
      .bind(sourceCriterionId, targetCriterionId)
      .all<{ revision: number; status: string }>();
    expect(revisions.results).toEqual([
      { revision: 1, status: "ACTIVE" },
      { revision: 2, status: "DISABLED" },
    ]);

    const staleRateCsv = `${RATE_HEADER}\n${sourceCriterionId},${targetCriterionId},2,ACTIVE,3,4`;
    const stalePreview = await requestCsv(
      "/api/admin/exchange-rates/csv/validate",
      staleRateCsv,
      adminAuthId,
    );
    const stalePreviewBody = (await stalePreview.json()) as {
      data: { validationHash: string };
    };
    const competingRateCsv = `${RATE_HEADER}\n${sourceCriterionId},${targetCriterionId},2,ACTIVE,1,1`;
    const competingPreview = await requestCsv(
      "/api/admin/exchange-rates/csv/validate",
      competingRateCsv,
      adminAuthId,
    );
    const competingPreviewBody = (await competingPreview.json()) as {
      data: { validationHash: string };
    };
    const competingCommit = await requestCsv(
      "/api/admin/exchange-rates/csv/commit",
      competingRateCsv,
      adminAuthId,
      {
        "Idempotency-Key": `rate_competing_${suffix}`,
        "X-Reason": "concurrent update",
        "X-Validation-Hash": competingPreviewBody.data.validationHash,
      },
    );
    expect(competingCommit.status).toBe(201);
    const staleCommit = await requestCsv(
      "/api/admin/exchange-rates/csv/commit",
      staleRateCsv,
      adminAuthId,
      {
        "Idempotency-Key": `rate_stale_${suffix}`,
        "X-Reason": "stale update",
        "X-Validation-Hash": stalePreviewBody.data.validationHash,
      },
    );
    expect(staleCommit.status).toBe(409);
    await expect(staleCommit.json()).resolves.toMatchObject({ code: "VALIDATION_CHANGED" });
  });

  it("rolls back every row when aggregate transfer debits exceed the current balance", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const senderAuthId = `sum_sender_${suffix}`;
    const firstRecipientAuthId = `sum_first_${suffix}`;
    const secondRecipientAuthId = `sum_second_${suffix}`;
    const overflowRecipientAuthId = `sum_overflow_${suffix}`;
    const [sender, firstRecipient, secondRecipient, overflowRecipient] = await Promise.all([
      seedAuthUser(senderAuthId),
      seedAuthUser(firstRecipientAuthId),
      seedAuthUser(secondRecipientAuthId),
      seedAuthUser(overflowRecipientAuthId),
    ]);
    const criterionId = `sum_criterion_${suffix}`;
    const [criterion] = await importEvaluationCriteria(env.DB!, {
      actorPointsUserId: sender.id,
      items: [
        {
          balanceVisibleByDefault: false,
          buyNowEnabled: true,
          description: "Aggregate balance guard",
          evaluationCriterionId: criterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.0001",
          name: `Sum ${suffix.slice(0, 8)}`,
          relatedUrls: [],
          status: "ACTIVE",
          transferEnabled: true,
        },
      ],
      reason: "aggregate guard",
    });
    await seedBalance(sender.id, criterionId, criterion.evaluationCriterionRevisionId, 30_000);
    const app = createPointsBackendApp({
      getSession: async (_bindings, headers) => {
        const userId = headers.get("X-Test-Auth-User");
        return userId ? { session: { createdAt: new Date(), userId }, user: { id: userId } } : null;
      },
    });
    const csv = `${TRANSFER_HEADER}\n${criterionId},2,${firstRecipient.id}\n${criterionId},2,${secondRecipient.id}`;
    const request = (path: "validate" | "commit", headers: Record<string, string> = {}) =>
      app.fetch(
        new Request(`https://points.test/api/transfers/csv/${path}`, {
          body: csv,
          headers: {
            "Content-Type": "text/csv",
            "X-Test-Auth-User": senderAuthId,
            ...headers,
          },
          method: "POST",
        }),
        env,
      );
    const preview = await request("validate");
    expect(preview.status).toBe(200);
    const previewBody = (await preview.json()) as { data: { validationHash: string } };
    const commit = await request("commit", {
      "Idempotency-Key": `sum_${suffix}`,
      "X-Validation-Hash": previewBody.data.validationHash,
    });
    expect(commit.status).toBe(409);
    await expect(commit.json()).resolves.toMatchObject({ code: "INSUFFICIENT_BALANCE" });

    const transactionCount = await env
      .DB!.prepare(
        `SELECT COUNT(*) AS count FROM point_transaction_batch
         WHERE actor_points_user_id = ? AND idempotency_key = ?`,
      )
      .bind(sender.id, `sum_${suffix}`)
      .first<{ count: number }>();
    expect(transactionCount?.count).toBe(0);
    const accounts = await env
      .DB!.prepare(
        `SELECT points_user_id AS pointsUserId, balance, evaluation_total AS evaluationTotal
         FROM point_account WHERE evaluation_criterion_id = ? ORDER BY points_user_id`,
      )
      .bind(criterionId)
      .all<{ balance: number; evaluationTotal: number; pointsUserId: string }>();
    expect(accounts.results).toEqual([
      { balance: 30_000, evaluationTotal: 30_000, pointsUserId: sender.id },
    ]);

    await seedBalance(
      overflowRecipient.id,
      criterionId,
      criterion.evaluationCriterionRevisionId,
      Number.MAX_SAFE_INTEGER,
    );
    const overflowCsv = `${TRANSFER_HEADER}\n${criterionId},0.0001,${overflowRecipient.id}`;
    const overflowRequest = (path: "validate" | "commit", headers: Record<string, string> = {}) =>
      app.fetch(
        new Request(`https://points.test/api/transfers/csv/${path}`, {
          body: overflowCsv,
          headers: {
            "Content-Type": "text/csv",
            "X-Test-Auth-User": senderAuthId,
            ...headers,
          },
          method: "POST",
        }),
        env,
      );
    const overflowPreview = await overflowRequest("validate");
    const overflowPreviewBody = (await overflowPreview.json()) as {
      data: { validationHash: string };
    };
    const overflowCommit = await overflowRequest("commit", {
      "Idempotency-Key": `overflow_${suffix}`,
      "X-Validation-Hash": overflowPreviewBody.data.validationHash,
    });
    expect(overflowCommit.status).toBe(409);
    await expect(overflowCommit.json()).resolves.toMatchObject({ code: "SAFE_INTEGER_OVERFLOW" });
    const balancesAfterOverflow = await env
      .DB!.prepare(
        `SELECT points_user_id AS pointsUserId, balance FROM point_account
         WHERE evaluation_criterion_id = ? AND points_user_id IN (?, ?) ORDER BY points_user_id`,
      )
      .bind(criterionId, sender.id, overflowRecipient.id)
      .all<{ balance: number; pointsUserId: string }>();
    expect(balancesAfterOverflow.results).toEqual(
      [
        { balance: 30_000, pointsUserId: sender.id },
        { balance: Number.MAX_SAFE_INTEGER, pointsUserId: overflowRecipient.id },
      ].sort((left, right) => left.pointsUserId.localeCompare(right.pointsUserId)),
    );
  });
});
