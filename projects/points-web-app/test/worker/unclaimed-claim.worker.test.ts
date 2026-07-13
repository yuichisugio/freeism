import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";

async function createUser(suffix: string, google = true) {
  const authUserId = `ownership-auth-${suffix}`;
  const now = Date.now();
  await env
    .DB!.prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(authUserId, authUserId, `${authUserId}@example.invalid`, now, now)
    .run();
  if (google) {
    await env
      .DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'google', ?, ?, ?)",
      )
      .bind(`google-${suffix}`, `google-${suffix}`, authUserId, now, now)
      .run();
  }
  const pointsUser = await provisionPointsUser(env.DB!, authUserId, () => `pusr_${suffix}`);
  return { authUserId, pointsUser };
}

async function createCriterion(actorPointsUserId: string, suffix: string) {
  const id = `criterion_${suffix}`;
  await importEvaluationCriteria(env.DB!, {
    actorPointsUserId,
    items: [
      {
        balanceVisibleByDefault: false,
        buyNowEnabled: true,
        description: "Ownership claim test",
        evaluationCriterionId: id,
        exchangeEnabled: true,
        expectedRevision: null,
        minimumUnit: "0.0001",
        name: `Ownership ${suffix.slice(-12)}`,
        relatedUrls: [],
        status: "ACTIVE",
        transferEnabled: true,
      },
    ],
    reason: "Ownership claim test",
  });
  return { id, revisionId: `ecr_${id}_1` };
}

async function seedOwnership(input: {
  effectiveAt: number;
  normalizedUrl: string;
  ownershipId: string;
  ownerPointsUserId: string;
  epochId: string;
}) {
  await env.DB!.batch([
    env
      .DB!.prepare(
        `INSERT INTO identity_ownership
           (id, identity_type, normalized_identity_key, points_user_id, status,
            current_ownership_epoch_id, verified_at, permanent_correspondence)
         VALUES (?, 'WEB_URL', ?, ?, 'ACTIVE', ?, ?, 0)`,
      )
      .bind(
        input.ownershipId,
        input.normalizedUrl,
        input.ownerPointsUserId,
        input.epochId,
        input.effectiveAt,
      ),
    env
      .DB!.prepare(
        `INSERT INTO ownership_epoch
           (id, identity_ownership_id, owner_points_user_id, effective_at,
            verification_method, evidence_hash, success_count, request_id, created_at)
         VALUES (?, ?, ?, ?, 'WEB_LINK', ?, 1, ?, ?)`,
      )
      .bind(
        input.epochId,
        input.ownershipId,
        input.ownerPointsUserId,
        input.effectiveAt,
        "a".repeat(64),
        `req-${input.epochId}`,
        input.effectiveAt,
      ),
  ]);
}

async function seedUnclaimed(input: {
  actorPointsUserId: string;
  amountScaled: number;
  criterionId: string;
  criterionRevisionId: string;
  evaluationAt: string;
  normalizedUrl: string;
  suffix: string;
}) {
  const resultId = `fix_${input.suffix}`;
  const revisionId = `fixrev_${input.suffix}`;
  const entryId = `fixentry_${input.suffix}`;
  const unclaimedId = `unclaimed_${input.suffix}`;
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
         VALUES (?, ?, 1, ?, ?, ?, ?, 'test', ?)`,
      )
      .bind(
        revisionId,
        resultId,
        "b".repeat(64),
        "c".repeat(64),
        "d".repeat(64),
        input.actorPointsUserId,
        now,
      ),
    env
      .DB!.prepare(
        `INSERT INTO fix_revision_entry
           (id, fix_revision_id, recipient_profile_url, evaluation_criterion_id,
            evaluation_criterion_revision_id, amount_scaled, evaluation_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entryId,
        revisionId,
        input.normalizedUrl,
        input.criterionId,
        input.criterionRevisionId,
        input.amountScaled,
        input.evaluationAt,
        now,
      ),
    env
      .DB!.prepare(
        `INSERT INTO unclaimed_fix_entry
           (id, source_fix_revision_id, recipient_profile_url, evaluation_criterion_id,
            evaluation_criterion_revision_id, delta_amount_scaled, evaluation_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        unclaimedId,
        revisionId,
        input.normalizedUrl,
        input.criterionId,
        input.criterionRevisionId,
        input.amountScaled,
        input.evaluationAt,
        now,
      ),
    env
      .DB!.prepare("INSERT INTO fix_revision_seal (fix_revision_id, sealed_at) VALUES (?, ?)")
      .bind(revisionId, now),
  ]);
  return unclaimedId;
}

function appFor(authUserId: string, sessionCreatedAt = new Date()) {
  return createPointsBackendApp({
    getSession: async () => ({
      session: { createdAt: sessionCreatedAt, userId: authUserId },
      user: { id: authUserId },
    }),
  });
}

describe("unclaimed FIX claim", () => {
  it("previews the first Web epoch as an unselectable aggregate including older positive and negative FIXes", async () => {
    const suffix = crypto.randomUUID();
    const { authUserId, pointsUser } = await createUser(suffix);
    const first = await createCriterion(pointsUser.id, `${suffix}_first`);
    const second = await createCriterion(pointsUser.id, `${suffix}_second`);
    const normalizedUrl = `https://profiles.example.com/${suffix}`;
    const ownershipId = `ownership_${suffix}`;
    await seedOwnership({
      effectiveAt: Date.parse("2026-07-01T00:00:00Z"),
      normalizedUrl,
      ownerPointsUserId: pointsUser.id,
      ownershipId,
      epochId: `epoch_${suffix}`,
    });
    await seedUnclaimed({
      actorPointsUserId: pointsUser.id,
      amountScaled: 12_000,
      criterionId: first.id,
      criterionRevisionId: first.revisionId,
      evaluationAt: "2026-01",
      normalizedUrl,
      suffix: `${suffix}_positive`,
    });
    await seedUnclaimed({
      actorPointsUserId: pointsUser.id,
      amountScaled: -5_000,
      criterionId: first.id,
      criterionRevisionId: first.revisionId,
      evaluationAt: "2026-02",
      normalizedUrl,
      suffix: `${suffix}_negative`,
    });
    await seedUnclaimed({
      actorPointsUserId: pointsUser.id,
      amountScaled: 3_000,
      criterionId: second.id,
      criterionRevisionId: second.revisionId,
      evaluationAt: "2026-03",
      normalizedUrl,
      suffix: `${suffix}_second`,
    });

    const response = await appFor(authUserId).fetch(
      new Request(`https://points.test/api/ownership/${ownershipId}/claim-preview`),
      env,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Record<string, unknown> & {
        aggregates: Array<Record<string, unknown>>;
        claimSetHash: string;
        totalCount: number;
      };
    };
    expect(body.data.totalCount).toBe(3);
    expect(body.data.claimSetHash).toMatch(/^[a-f0-9]{64}$/);
    expect(body.data.aggregates).toEqual([
      {
        evaluationCriterionId: first.id,
        negativeCount: 1,
        netAmountScaled: 7_000,
        positiveCount: 1,
        totalCount: 2,
      },
      {
        evaluationCriterionId: second.id,
        negativeCount: 0,
        netAmountScaled: 3_000,
        positiveCount: 1,
        totalCount: 1,
      },
    ]);
    expect(body.data).not.toHaveProperty("entries");
    expect(body.data).not.toHaveProperty("selectedIds");

    const app = appFor(authUserId);
    const partial = await app.fetch(
      new Request(`https://points.test/api/ownership/${ownershipId}/claim`, {
        body: JSON.stringify({ claimSetHash: body.data.claimSetHash, selectedIds: ["positive"] }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": `partial-${suffix}` },
        method: "POST",
      }),
      env,
    );
    expect(partial.status).toBe(422);
    await expect(partial.json()).resolves.toMatchObject({ code: "CLAIM_BODY_INVALID" });

    await seedUnclaimed({
      actorPointsUserId: pointsUser.id,
      amountScaled: -1_000,
      criterionId: second.id,
      criterionRevisionId: second.revisionId,
      evaluationAt: "2025-12",
      normalizedUrl,
      suffix: `${suffix}_late`,
    });
    const stale = await app.fetch(
      new Request(`https://points.test/api/ownership/${ownershipId}/claim`, {
        body: JSON.stringify({ claimSetHash: body.data.claimSetHash }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": `stale-${suffix}` },
        method: "POST",
      }),
      env,
    );
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      code: "CLAIM_SET_CHANGED",
      data: { totalCount: 4 },
    });
    expect(
      await env.DB!.prepare("SELECT count(*) AS count FROM fix_claim").first<{ count: number }>(),
    ).toMatchObject({ count: 0 });

    const refreshed = await app.fetch(
      new Request(`https://points.test/api/ownership/${ownershipId}/claim-preview`),
      env,
    );
    const refreshedBody = (await refreshed.json()) as {
      data: { claimSetHash: string; totalCount: number };
    };
    expect(refreshedBody.data.totalCount).toBe(4);
    const claimRequest = () =>
      app.fetch(
        new Request(`https://points.test/api/ownership/${ownershipId}/claim`, {
          body: JSON.stringify({ claimSetHash: refreshedBody.data.claimSetHash }),
          headers: { "Content-Type": "application/json", "Idempotency-Key": `claim-${suffix}` },
          method: "POST",
        }),
        env,
      );
    const claim = await claimRequest();
    expect(claim.status).toBe(201);
    const claimBody = await claim.json();
    expect(claimBody).toMatchObject({
      data: { claimedCount: 4, claimSetHash: refreshedBody.data.claimSetHash },
    });
    const replay = await claimRequest();
    expect(replay.status).toBe(201);
    await expect(replay.json()).resolves.toEqual(claimBody);

    const counts = await env
      .DB!.prepare(
        `SELECT
           (SELECT count(*) FROM unclaimed_fix_entry) AS unclaimedCount,
           (SELECT count(*) FROM fix_claim_item) AS claimItemCount,
           (SELECT count(*) FROM point_ledger_entry WHERE source_unclaimed_fix_entry_id IS NOT NULL)
             AS claimLedgerCount`,
      )
      .first<{ claimItemCount: number; claimLedgerCount: number; unclaimedCount: number }>();
    expect(counts).toEqual({ claimItemCount: 4, claimLedgerCount: 4, unclaimedCount: 4 });
    await expect(
      env
        .DB!.prepare(
          `SELECT evaluation_criterion_id AS criterionId, balance, evaluation_total AS evaluationTotal
           FROM point_account WHERE points_user_id = ? ORDER BY evaluation_criterion_id`,
        )
        .bind(pointsUser.id)
        .all(),
    ).resolves.toMatchObject({
      results: [
        { balance: 7_000, criterionId: first.id, evaluationTotal: 7_000 },
        { balance: 2_000, criterionId: second.id, evaluationTotal: 2_000 },
      ],
    });
  });

  it("keeps claimed rows with the old epoch and limits a later Web epoch to effectiveAt or later", async () => {
    const suffix = crypto.randomUUID();
    const { authUserId, pointsUser } = await createUser(suffix);
    const criterion = await createCriterion(pointsUser.id, `${suffix}_epoch`);
    const normalizedUrl = `https://profiles.example.com/reowned-${suffix}`;
    const ownershipId = `ownership_reowned_${suffix}`;
    const firstEpochId = `epoch_first_${suffix}`;
    await seedOwnership({
      effectiveAt: Date.parse("2026-07-01T00:00:00Z"),
      normalizedUrl,
      ownerPointsUserId: pointsUser.id,
      ownershipId,
      epochId: firstEpochId,
    });
    await seedUnclaimed({
      actorPointsUserId: pointsUser.id,
      amountScaled: 1_000,
      criterionId: criterion.id,
      criterionRevisionId: criterion.revisionId,
      evaluationAt: "2026-06",
      normalizedUrl,
      suffix: `${suffix}_old_claimed`,
    });
    const app = appFor(authUserId);
    const firstPreview = await app.fetch(
      new Request(`https://points.test/api/ownership/${ownershipId}/claim-preview`),
      env,
    );
    const firstPreviewBody = (await firstPreview.json()) as { data: { claimSetHash: string } };
    const firstClaim = await app.fetch(
      new Request(`https://points.test/api/ownership/${ownershipId}/claim`, {
        body: JSON.stringify({ claimSetHash: firstPreviewBody.data.claimSetHash }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": `first-${suffix}` },
        method: "POST",
      }),
      env,
    );
    expect(firstClaim.status).toBe(201);

    const secondEpochId = `epoch_second_${suffix}`;
    const effectiveAt = Date.parse("2026-08-01T00:00:00Z");
    await env.DB!.batch([
      env
        .DB!.prepare(
          `INSERT INTO ownership_epoch
             (id, identity_ownership_id, owner_points_user_id, effective_at,
              verification_method, evidence_hash, success_count, request_id, created_at)
           VALUES (?, ?, ?, ?, 'WEB_LINK', ?, 3, ?, ?)`,
        )
        .bind(
          secondEpochId,
          ownershipId,
          pointsUser.id,
          effectiveAt,
          "e".repeat(64),
          `req-${secondEpochId}`,
          effectiveAt,
        ),
      env
        .DB!.prepare("UPDATE ownership_epoch SET ended_at = ? WHERE id = ?")
        .bind(effectiveAt - 1, firstEpochId),
      env
        .DB!.prepare(
          "UPDATE identity_ownership SET current_ownership_epoch_id = ?, verified_at = ? WHERE id = ?",
        )
        .bind(secondEpochId, effectiveAt, ownershipId),
    ]);
    for (const [label, evaluationAt] of [
      ["before", "2026-07-31T23:59:59Z"],
      ["equal", "2026-08-01T00:00:00Z"],
    ] as const) {
      await seedUnclaimed({
        actorPointsUserId: pointsUser.id,
        amountScaled: 1_000,
        criterionId: criterion.id,
        criterionRevisionId: criterion.revisionId,
        evaluationAt,
        normalizedUrl,
        suffix: `${suffix}_${label}`,
      });
    }
    const secondPreview = await app.fetch(
      new Request(`https://points.test/api/ownership/${ownershipId}/claim-preview`),
      env,
    );
    const secondPreviewBody = (await secondPreview.json()) as {
      data: { claimSetHash: string; totalCount: number };
    };
    expect(secondPreviewBody.data.totalCount).toBe(1);

    const thirdEpochId = `epoch_third_${suffix}`;
    await env.DB!.batch([
      env
        .DB!.prepare(
          `INSERT INTO ownership_epoch
             (id, identity_ownership_id, owner_points_user_id, effective_at,
              verification_method, evidence_hash, success_count, request_id, created_at)
           VALUES (?, ?, ?, ?, 'WEB_LINK', ?, 3, ?, ?)`,
        )
        .bind(
          thirdEpochId,
          ownershipId,
          pointsUser.id,
          effectiveAt,
          "f".repeat(64),
          `req-${thirdEpochId}`,
          effectiveAt,
        ),
      env
        .DB!.prepare("UPDATE identity_ownership SET current_ownership_epoch_id = ? WHERE id = ?")
        .bind(thirdEpochId, ownershipId),
    ]);
    const staleEpochClaim = await app.fetch(
      new Request(`https://points.test/api/ownership/${ownershipId}/claim`, {
        body: JSON.stringify({ claimSetHash: secondPreviewBody.data.claimSetHash }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": `epoch-${suffix}` },
        method: "POST",
      }),
      env,
    );
    expect(staleEpochClaim.status).toBe(409);
    await expect(staleEpochClaim.json()).resolves.toMatchObject({ code: "CLAIM_SET_CHANGED" });
    expect(
      await env
        .DB!.prepare(
          `SELECT count(*) AS count FROM fix_claim claim
           JOIN fix_claim_command command ON command.id = claim.command_id
           WHERE command.identity_ownership_id = ?`,
        )
        .bind(ownershipId)
        .first<{ count: number }>(),
    ).toMatchObject({ count: 1 });
  });

  it("requires a linked Google account and a session newer than 901 seconds for claim confirm", async () => {
    const suffix = crypto.randomUUID();
    const linked = await createUser(`${suffix}_linked`);
    const unlinked = await createUser(`${suffix}_unlinked`, false);
    const request = (app: ReturnType<typeof appFor>, key: string) =>
      app.fetch(
        new Request(`https://points.test/api/ownership/missing/claim`, {
          body: JSON.stringify({ claimSetHash: "0".repeat(64) }),
          headers: { "Content-Type": "application/json", "Idempotency-Key": key },
          method: "POST",
        }),
        env,
      );
    const acceptedFresh = await request(
      appFor(linked.authUserId, new Date(Date.now() - 899_000)),
      `fresh-${suffix}`,
    );
    expect(acceptedFresh.status).toBe(404);
    const stale = await request(
      appFor(linked.authUserId, new Date(Date.now() - 901_000)),
      `stale-${suffix}`,
    );
    expect(stale.status).toBe(401);
    await expect(stale.json()).resolves.toMatchObject({ code: "FRESH_GOOGLE_AUTH_REQUIRED" });
    const noGoogle = await request(appFor(unlinked.authUserId), `unlinked-${suffix}`);
    expect(noGoogle.status).toBe(401);
    await expect(noGoogle.json()).resolves.toMatchObject({ code: "FRESH_GOOGLE_AUTH_REQUIRED" });
  });

  it("rolls back claim, ledger, idempotency, and audit when projection exceeds the safe integer", async () => {
    const suffix = crypto.randomUUID();
    const { authUserId, pointsUser } = await createUser(suffix);
    const criterion = await createCriterion(pointsUser.id, `${suffix}_overflow`);
    const normalizedUrl = `https://profiles.example.com/overflow-${suffix}`;
    const ownershipId = `ownership_overflow_${suffix}`;
    await seedOwnership({
      effectiveAt: Date.now(),
      normalizedUrl,
      ownerPointsUserId: pointsUser.id,
      ownershipId,
      epochId: `epoch_overflow_${suffix}`,
    });
    await seedUnclaimed({
      actorPointsUserId: pointsUser.id,
      amountScaled: 1,
      criterionId: criterion.id,
      criterionRevisionId: criterion.revisionId,
      evaluationAt: "2026-01",
      normalizedUrl,
      suffix: `${suffix}_overflow`,
    });
    await env
      .DB!.prepare(
        `INSERT INTO point_account
           (points_user_id, evaluation_criterion_id, balance, evaluation_total, updated_at)
         VALUES (?, ?, 9007199254740991, 9007199254740991, ?)`,
      )
      .bind(pointsUser.id, criterion.id, Date.now())
      .run();
    const app = appFor(authUserId);
    const preview = await app.fetch(
      new Request(`https://points.test/api/ownership/${ownershipId}/claim-preview`),
      env,
    );
    const previewBody = (await preview.json()) as { data: { claimSetHash: string } };
    const claim = await app.fetch(
      new Request(`https://points.test/api/ownership/${ownershipId}/claim`, {
        body: JSON.stringify({ claimSetHash: previewBody.data.claimSetHash }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": `overflow-${suffix}` },
        method: "POST",
      }),
      env,
    );
    expect(claim.status).toBe(409);
    await expect(claim.json()).resolves.toMatchObject({ code: "SAFE_INTEGER_OVERFLOW" });
    const counts = await env
      .DB!.prepare(
        `SELECT
           (SELECT count(*) FROM fix_claim claim JOIN fix_claim_command command
             ON command.id = claim.command_id WHERE command.identity_ownership_id = ?) AS claimCount,
           (SELECT count(*) FROM fix_claim_item item JOIN fix_claim claim
             ON claim.id = item.fix_claim_id JOIN fix_claim_command command
             ON command.id = claim.command_id WHERE command.identity_ownership_id = ?) AS itemCount,
           (SELECT count(*) FROM point_ledger_entry WHERE points_user_id = ?
             AND source_unclaimed_fix_entry_id IS NOT NULL) AS ledgerCount,
           (SELECT count(*) FROM idempotency_results WHERE actor_points_user_id = ?
             AND operation = 'UNCLAIMED_FIX_CLAIM') AS idempotencyCount,
           (SELECT count(*) FROM audit_event WHERE actor_points_user_id = ?
             AND action = 'UNCLAIMED_FIX_CLAIM') AS auditCount`,
      )
      .bind(ownershipId, ownershipId, pointsUser.id, pointsUser.id, pointsUser.id)
      .first<{
        auditCount: number;
        claimCount: number;
        idempotencyCount: number;
        itemCount: number;
        ledgerCount: number;
      }>();
    expect(counts).toEqual({
      auditCount: 0,
      claimCount: 0,
      idempotencyCount: 0,
      itemCount: 0,
      ledgerCount: 0,
    });
    expect(
      await env
        .DB!.prepare(
          "SELECT balance, evaluation_total AS evaluationTotal FROM point_account WHERE points_user_id = ? AND evaluation_criterion_id = ?",
        )
        .bind(pointsUser.id, criterion.id)
        .first(),
    ).toEqual({ balance: Number.MAX_SAFE_INTEGER, evaluationTotal: Number.MAX_SAFE_INTEGER });
  });
});
