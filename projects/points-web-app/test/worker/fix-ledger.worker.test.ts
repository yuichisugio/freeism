import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";

const FIX_HEADER =
  "fixResultId,expectedRevision,recipientProfileUrl,evaluationCriterionId,amount,evaluationAt,managementId,memo";

describe("immutable FIX revision and delta ledger", () => {
  it("exposes an ADMIN-only raw CSV validation route", async () => {
    const suffix = crypto.randomUUID();
    const authUserId = `fix-admin-${suffix}`;
    const now = Date.now();
    await env
      .DB!.prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(authUserId, authUserId, `${authUserId}@example.invalid`, now, now)
      .run();
    await env
      .DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'google', ?, ?, ?)",
      )
      .bind(`account-${suffix}`, `google-${suffix}`, authUserId, now, now)
      .run();
    const pointsUser = await provisionPointsUser(env.DB!, authUserId, () => `pusr_${suffix}`);
    await env
      .DB!.prepare("INSERT INTO admin_membership (id, points_user_id, role) VALUES (?, ?, 'ADMIN')")
      .bind(`adm_${suffix}`, pointsUser.id)
      .run();
    const app = createPointsBackendApp({
      getSession: async () => ({
        session: { createdAt: new Date(), userId: authUserId },
        user: { id: authUserId },
      }),
    });
    const response = await app.fetch(
      new Request("https://points.test/api/admin/fixes/csv/validate", {
        body: `${FIX_HEADER}\n,,https://example.com/alice,criterion-a,1,2026-07,,`,
        headers: { "Content-Type": "text/csv" },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ code: "CSV_VALIDATION_FAILED" });
  });

  it("commits an initial FIX, appends only correction deltas, and permits a negative balance", async () => {
    const suffix = crypto.randomUUID();
    const authUserId = `fix-owner-${suffix}`;
    const recipientAuthUserId = `fix-recipient-${suffix}`;
    const githubId = `${Math.floor(Math.random() * 1_000_000) + 10_000}`;
    const now = Date.now();
    for (const id of [authUserId, recipientAuthUserId]) {
      await env
        .DB!.prepare(
          "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
        )
        .bind(id, id, `${id}@example.invalid`, now, now)
        .run();
    }
    await env.DB!.batch([
      env
        .DB!.prepare(
          "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'google', ?, ?, ?)",
        )
        .bind(`google-${suffix}`, `google-${suffix}`, authUserId, now, now),
      env
        .DB!.prepare(
          "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'github', ?, ?, ?)",
        )
        .bind(`github-${suffix}`, githubId, recipientAuthUserId, now, now),
    ]);
    const owner = await provisionPointsUser(env.DB!, authUserId, () => `pusr_owner_${suffix}`);
    const recipient = await provisionPointsUser(
      env.DB!,
      recipientAuthUserId,
      () => `pusr_recipient_${suffix}`,
    );
    await env
      .DB!.prepare("INSERT INTO admin_membership (id, points_user_id, role) VALUES (?, ?, 'ADMIN')")
      .bind(`adm_owner_${suffix}`, owner.id)
      .run();
    const criterionId = `criterion_${suffix}`;
    await importEvaluationCriteria(env.DB!, {
      actorPointsUserId: owner.id,
      items: [
        {
          balanceVisibleByDefault: false,
          buyNowEnabled: true,
          description: "FIX test criterion",
          evaluationCriterionId: criterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.0001",
          name: `FIX ${suffix.slice(0, 8)}`,
          relatedUrls: [],
          status: "ACTIVE",
          transferEnabled: true,
        },
      ],
      reason: "FIX test",
    });
    const app = createPointsBackendApp({
      getSession: async () => ({
        session: { createdAt: new Date(), userId: authUserId },
        user: { id: authUserId },
      }),
      githubFetch: async (request) => {
        const login = new URL(String(request)).pathname.split("/").pop();
        return Response.json({
          html_url: `https://github.com/${login}`,
          id: Number(githubId),
          login,
          type: "User",
        });
      },
    });
    const requestCsv = async (path: "validate" | "commit", csv: string, headers = {}) =>
      app.fetch(
        new Request(`https://points.test/api/admin/fixes/csv/${path}`, {
          body: csv,
          headers: { "Content-Type": "text/csv", ...headers },
          method: "POST",
        }),
        env,
      );
    const initialCsv = `${FIX_HEADER}\n,,https://github.com/alice,${criterionId},10,2026-07,,initial`;
    const preview = await requestCsv("validate", initialCsv);
    expect(preview.status).toBe(200);
    const previewBody = (await preview.json()) as { data: { validationHash: string } };
    const initial = await requestCsv("commit", initialCsv, {
      "Idempotency-Key": `initial-${suffix}`,
      "X-Reason": "initial FIX",
      "X-Validation-Hash": previewBody.data.validationHash,
    });
    expect(initial.status).toBe(201);
    const initialBody = (await initial.json()) as {
      data: { results: Array<{ fixResultId: string; fixRevisionId: string }> };
    };
    const fixResultId = initialBody.data.results[0]!.fixResultId;

    const correctionCsv = `${FIX_HEADER}\n${fixResultId},1,https://github.com/alice,${criterionId},-3,2026-07,,correction`;
    const correctionPreview = await requestCsv("validate", correctionCsv);
    expect(correctionPreview.status).toBe(200);
    const correctionPreviewBody = (await correctionPreview.json()) as {
      data: { validationHash: string };
    };
    const correction = await requestCsv("commit", correctionCsv, {
      "Idempotency-Key": `correction-${suffix}`,
      "X-Reason": "correct FIX",
      "X-Validation-Hash": correctionPreviewBody.data.validationHash,
    });
    expect(correction.status).toBe(201);
    const retry = await requestCsv("commit", correctionCsv, {
      "Idempotency-Key": `correction-${suffix}`,
      "X-Reason": "correct FIX",
      "X-Validation-Hash": correctionPreviewBody.data.validationHash,
    });
    expect(retry.status).toBe(201);
    await expect(retry.json()).resolves.toEqual(await correction.json());

    const sameCsv = `${FIX_HEADER}\n${fixResultId},2,https://github.com/alice,${criterionId},-3,2026-07,,same`;
    const samePreview = await requestCsv("validate", sameCsv);
    const samePreviewBody = (await samePreview.json()) as { data: { validationHash: string } };
    const same = await requestCsv("commit", sameCsv, {
      "Idempotency-Key": `same-${suffix}`,
      "X-Reason": "same FIX",
      "X-Validation-Hash": samePreviewBody.data.validationHash,
    });
    expect(same.status).toBe(201);
    const sameBody = (await same.json()) as {
      data: { results: Array<{ fixRevisionId: string }> };
    };
    const duplicateCorrectionCsv = `${FIX_HEADER}\n${fixResultId},3,https://github.com/alice,${criterionId},1,2026-07,,duplicate-a\n${fixResultId},3,https://github.com/alice/,${criterionId},2,2026-07,,duplicate-b`;
    const duplicateCorrection = await requestCsv("validate", duplicateCorrectionCsv);
    expect(duplicateCorrection.status).toBe(422);
    await expect(duplicateCorrection.json()).resolves.toMatchObject({
      code: "CSV_VALIDATION_FAILED",
      errors: [
        { code: "CSV_DUPLICATE_BUSINESS_KEY", row: 2 },
        { code: "CSV_DUPLICATE_BUSINESS_KEY", row: 3 },
      ],
    });

    const twoNewResultsCsv = `${FIX_HEADER}\n,,https://github.com/alice,${criterionId},1,2026-07,,new-a\n,,https://github.com/alice/,${criterionId},2,2026-07,,new-b`;
    const twoNewResults = await requestCsv("validate", twoNewResultsCsv);
    expect(twoNewResults.status).toBe(200);

    const sealedRevisionId = sameBody.data.results[0]!.fixRevisionId;
    await expect(
      env
        .DB!.prepare(
          `INSERT INTO fix_revision_entry
             (id, fix_revision_id, recipient_profile_url, evaluation_criterion_id,
              evaluation_criterion_revision_id, amount_scaled, evaluation_at, created_at)
           VALUES (?, ?, 'https://freeism.app/late', ?, ?, 1, '2026-07', ?)`,
        )
        .bind(`late-entry-${suffix}`, sealedRevisionId, criterionId, `ecr_${criterionId}_1`, now)
        .run(),
    ).rejects.toThrow("SEALED_FIX_REVISION");
    await expect(
      env
        .DB!.prepare(
          `INSERT INTO unclaimed_fix_entry
             (id, source_fix_revision_id, recipient_profile_url, evaluation_criterion_id,
              evaluation_criterion_revision_id, delta_amount_scaled, evaluation_at, created_at)
           VALUES (?, ?, 'https://freeism.app/late', ?, ?, 1, '2026-07', ?)`,
        )
        .bind(
          `late-unclaimed-${suffix}`,
          sealedRevisionId,
          criterionId,
          `ecr_${criterionId}_1`,
          now,
        )
        .run(),
    ).rejects.toThrow("SEALED_FIX_REVISION");
    await expect(
      env
        .DB!.prepare("UPDATE fix_revision_seal SET sealed_at = ? WHERE fix_revision_id = ?")
        .bind(now + 1, sealedRevisionId)
        .run(),
    ).rejects.toThrow("IMMUTABLE_FIX_REVISION_SEAL");
    await expect(
      env
        .DB!.prepare("DELETE FROM fix_revision_seal WHERE fix_revision_id = ?")
        .bind(sealedRevisionId)
        .run(),
    ).rejects.toThrow("IMMUTABLE_FIX_REVISION_SEAL");

    const account = await env
      .DB!.prepare(
        `SELECT balance, evaluation_total AS evaluationTotal,
              typeof(balance) AS balanceType, typeof(evaluation_total) AS evaluationTotalType
       FROM point_account WHERE points_user_id = ? AND evaluation_criterion_id = ?`,
      )
      .bind(recipient.id, criterionId)
      .first<{
        balance: number;
        balanceType: string;
        evaluationTotal: number;
        evaluationTotalType: string;
      }>();
    expect(account).toEqual({
      balance: -30000,
      balanceType: "integer",
      evaluationTotal: -30000,
      evaluationTotalType: "integer",
    });
    const deltas = await env
      .DB!.prepare(
        "SELECT delta_amount_scaled AS delta FROM point_ledger_entry WHERE points_user_id = ? ORDER BY created_at, id",
      )
      .bind(recipient.id)
      .all<{ delta: number }>();
    expect(deltas.results.map(({ delta }) => delta).sort((a, b) => b - a)).toEqual([
      100000, -130000,
    ]);
    await expect(
      env
        .DB!.prepare("UPDATE fix_revision SET reason = 'changed' WHERE fix_result_id = ?")
        .bind(fixResultId)
        .run(),
    ).rejects.toThrow("IMMUTABLE_FIX_REVISION");

    const overflowRevisionIds = [`overflow-rev-a-${suffix}`, `overflow-rev-b-${suffix}`];
    for (const [index, fixRevisionId] of overflowRevisionIds.entries()) {
      const overflowResultId = `overflow-result-${index}-${suffix}`;
      await env.DB!.batch([
        env
          .DB!.prepare(
            "INSERT INTO fix_result (id, current_revision_id, current_revision, created_at) VALUES (?, ?, 1, ?)",
          )
          .bind(overflowResultId, fixRevisionId, now),
        env
          .DB!.prepare(
            `INSERT INTO fix_revision
               (id, fix_result_id, revision, file_hash, validation_hash, content_hash,
                actor_points_user_id, reason, created_at)
             VALUES (?, ?, 1, ?, ?, ?, ?, 'overflow test', ?)`,
          )
          .bind(
            fixRevisionId,
            overflowResultId,
            "a".repeat(64),
            "b".repeat(64),
            "c".repeat(64),
            owner.id,
            now,
          ),
      ]);
    }
    const overflowBatch = env.DB!.batch([
      env
        .DB!.prepare(
          `INSERT INTO point_ledger_entry
           (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
            delta_amount_scaled, affects_evaluation_total, source_type, source_fix_revision_id, created_at)
         VALUES (?, ?, ?, ?, 9007199254740991, 1, 'FIX', ?, ?)`,
        )
        .bind(
          `overflow-a-${suffix}`,
          owner.id,
          criterionId,
          `ecr_${criterionId}_1`,
          overflowRevisionIds[0],
          now,
        ),
      env
        .DB!.prepare(
          `INSERT INTO point_ledger_entry
           (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
            delta_amount_scaled, affects_evaluation_total, source_type, source_fix_revision_id, created_at)
         VALUES (?, ?, ?, ?, 1, 1, 'FIX', ?, ?)`,
        )
        .bind(
          `overflow-b-${suffix}`,
          owner.id,
          criterionId,
          `ecr_${criterionId}_1`,
          overflowRevisionIds[1],
          now,
        ),
    ]);
    await expect(overflowBatch).rejects.toThrow("SAFE_INTEGER_OVERFLOW");
    const rolledBack = await env
      .DB!.prepare("SELECT count(*) AS count FROM point_ledger_entry WHERE points_user_id = ?")
      .bind(owner.id)
      .first<{ count: number }>();
    expect(rolledBack?.count).toBe(0);
  });
});
