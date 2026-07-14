import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { createPointReservation } from "../../src/backend/usecases/create-point-reservation";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { importPointPackages } from "../../src/backend/usecases/import-point-packages";

const db = env.DB!;

async function seedAccount(suffix: string, options: { admin?: boolean } = {}) {
  const now = Date.now();
  const authUserId = `account-auth-${suffix}`;
  const pointsUserId = `pusr_account_${suffix}`;
  const googleAccountId = `google-${suffix}`;
  const githubAccountId = `github-${suffix}`;
  const currentSessionId = `session-current-${suffix}`;
  await db.batch([
    db
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(authUserId, `Account ${suffix}`, `${authUserId}@example.invalid`, now, now),
    db
      .prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'google', ?, ?, ?)",
      )
      .bind(`google-account-${suffix}`, googleAccountId, authUserId, now, now),
    db
      .prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'github', ?, ?, ?)",
      )
      .bind(`github-account-${suffix}`, githubAccountId, authUserId, now, now),
    db
      .prepare(
        "INSERT INTO points_user (id, auth_user_id, account_status, created_at) VALUES (?, ?, 'ACTIVE', ?)",
      )
      .bind(pointsUserId, authUserId, now),
    db
      .prepare(
        `INSERT INTO profiles
           (points_user_id, display_name, description, external_urls, visibility, created_at, updated_at)
         VALUES (?, 'Visible name', 'Visible description', '["https://example.test/me"]', 'PUBLIC', ?, ?)`,
      )
      .bind(pointsUserId, now, now),
    db
      .prepare(
        "INSERT INTO permanent_oauth_subject (id, provider_id, account_id, points_user_id, created_at) VALUES (?, 'google', ?, ?, ?)",
      )
      .bind(`pos-google-${suffix}`, googleAccountId, pointsUserId, now),
    db
      .prepare(
        "INSERT INTO permanent_oauth_subject (id, provider_id, account_id, points_user_id, created_at) VALUES (?, 'github', ?, ?, ?)",
      )
      .bind(`pos-github-${suffix}`, githubAccountId, pointsUserId, now),
    db
      .prepare(
        `INSERT INTO session
           (id, expires_at, token, created_at, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(currentSessionId, now + 3_600_000, `token-current-${suffix}`, now, now, authUserId),
    db
      .prepare(
        `INSERT INTO session
           (id, expires_at, token, created_at, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `session-other-${suffix}`,
        now + 3_600_000,
        `token-other-${suffix}`,
        now,
        now,
        authUserId,
      ),
    db
      .prepare(
        `INSERT INTO oauth_client
           (id, client_id, client_secret, redirect_uris, created_at, updated_at)
         VALUES (?, ?, 'test-secret', '[]', ?, ?)`,
      )
      .bind(`oauth-client-row-${suffix}`, `oauth-client-${suffix}`, now, now),
    db
      .prepare(
        `INSERT INTO oauth_refresh_token
           (id, token, client_id, user_id, expires_at, created_at, scopes)
         VALUES (?, ?, ?, ?, ?, ?, '[]')`,
      )
      .bind(
        `oauth-refresh-${suffix}`,
        `refresh-token-${suffix}`,
        `oauth-client-${suffix}`,
        authUserId,
        now + 3_600_000,
        now,
      ),
    db
      .prepare(
        `INSERT INTO oauth_access_token
           (id, token, client_id, user_id, refresh_id, expires_at, created_at, scopes)
         VALUES (?, ?, ?, ?, ?, ?, ?, '[]')`,
      )
      .bind(
        `oauth-access-${suffix}`,
        `access-token-${suffix}`,
        `oauth-client-${suffix}`,
        authUserId,
        `oauth-refresh-${suffix}`,
        now + 3_600_000,
        now,
      ),
    db
      .prepare(
        `INSERT INTO oauth_consent
           (id, client_id, user_id, scopes, created_at, updated_at)
         VALUES (?, ?, ?, '[]', ?, ?)`,
      )
      .bind(`oauth-consent-${suffix}`, `oauth-client-${suffix}`, authUserId, now, now),
  ]);
  if (options.admin) {
    await db
      .prepare("INSERT INTO admin_membership (id, points_user_id, role) VALUES (?, ?, 'ADMIN')")
      .bind(`admin-${suffix}`, pointsUserId)
      .run();
  }
  return {
    authUserId,
    currentSessionId,
    githubAccountId,
    googleAccountId,
    now,
    pointsUserId,
  };
}

function authenticatedApp(
  account: Awaited<ReturnType<typeof seedAccount>>,
  createdAt = new Date(),
) {
  return createPointsBackendApp({
    getSession: async () => ({
      session: { createdAt, id: account.currentSessionId, userId: account.authUserId },
      user: { id: account.authUserId },
    }),
  });
}

async function seedOwnerships(account: Awaited<ReturnType<typeof seedAccount>>) {
  const activeId = `own-close-active-${crypto.randomUUID()}`;
  const activeEpochId = `epoch-close-active-${crypto.randomUUID()}`;
  const inactiveId = `own-close-inactive-${crypto.randomUUID()}`;
  const inactiveEpochId = `epoch-close-inactive-${crypto.randomUUID()}`;
  const webId = `own-close-web-${crypto.randomUUID()}`;
  const webEpochId = `epoch-close-web-${crypto.randomUUID()}`;
  await db.batch([
    db
      .prepare(
        `INSERT INTO identity_ownership
           (id, identity_type, normalized_identity_key, points_user_id, status,
            current_ownership_epoch_id, verified_at, permanent_correspondence)
         VALUES (?, 'GITHUB_OAUTH', ?, ?, 'ACTIVE', ?, ?, 1)`,
      )
      .bind(
        activeId,
        `github:${account.githubAccountId}`,
        account.pointsUserId,
        activeEpochId,
        account.now,
      ),
    db
      .prepare(
        `INSERT INTO ownership_epoch
           (id, identity_ownership_id, owner_points_user_id, effective_at, verification_method,
            evidence_hash, success_count, request_id, created_at)
         VALUES (?, ?, ?, ?, 'GITHUB_OAUTH', ?, 1, ?, ?)`,
      )
      .bind(
        activeEpochId,
        activeId,
        account.pointsUserId,
        account.now,
        "a".repeat(64),
        `req-${activeId}`,
        account.now,
      ),
    db
      .prepare(
        `INSERT INTO identity_ownership
           (id, identity_type, normalized_identity_key, points_user_id, status,
            current_ownership_epoch_id, verified_at, permanent_correspondence)
         VALUES (?, 'GITHUB_OAUTH', ?, ?, 'INACTIVE', ?, ?, 1)`,
      )
      .bind(
        inactiveId,
        `github:inactive-${account.githubAccountId}`,
        account.pointsUserId,
        inactiveEpochId,
        account.now,
      ),
    db
      .prepare(
        `INSERT INTO ownership_epoch
           (id, identity_ownership_id, owner_points_user_id, effective_at, verification_method,
            evidence_hash, success_count, request_id, created_at)
         VALUES (?, ?, ?, ?, 'GITHUB_OAUTH', ?, 1, ?, ?)`,
      )
      .bind(
        inactiveEpochId,
        inactiveId,
        account.pointsUserId,
        account.now,
        "b".repeat(64),
        `req-${inactiveId}`,
        account.now,
      ),
    db
      .prepare(
        `INSERT INTO identity_ownership
           (id, identity_type, normalized_identity_key, points_user_id, status,
            current_ownership_epoch_id, verified_at, permanent_correspondence)
         VALUES (?, 'WEB_URL', ?, ?, 'ACTIVE', ?, ?, 0)`,
      )
      .bind(
        webId,
        `https://example.test/${account.pointsUserId}`,
        account.pointsUserId,
        webEpochId,
        account.now,
      ),
    db
      .prepare(
        `INSERT INTO ownership_epoch
           (id, identity_ownership_id, owner_points_user_id, effective_at, verification_method,
            evidence_hash, success_count, request_id, created_at)
         VALUES (?, ?, ?, ?, 'REL_ME', ?, 1, ?, ?)`,
      )
      .bind(
        webEpochId,
        webId,
        account.pointsUserId,
        account.now,
        "c".repeat(64),
        `req-${webId}`,
        account.now,
      ),
  ]);
  return { activeId, inactiveId, webEpochId, webId };
}

async function close(app: ReturnType<typeof authenticatedApp>, idempotencyKey: string) {
  return app.fetch(
    new Request("https://points.test/api/account/close", {
      body: "{}",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      method: "POST",
    }),
    env,
  );
}

async function seedPointsConnection(account: Awaited<ReturnType<typeof seedAccount>>) {
  const linkAttemptId = `pla-close-${crypto.randomUUID()}`;
  const connectionId = `pconn-close-${crypto.randomUUID()}`;
  const userClientId = `user-client-close-${crypto.randomUUID()}`;
  const m2mClientId = `m2m-client-close-${crypto.randomUUID()}`;
  await db.batch([
    db
      .prepare(
        `INSERT INTO points_oauth_link_attempt
           (id, idempotency_key, payload_hash, state_hash, user_client_id, m2m_client_id,
            markets_user_id, points_user_id, requested_scopes, status, issuer,
            points_subject, markets_points_connection_id, finalize_idempotency_key,
            created_at, expires_at, finalized_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        linkAttemptId,
        `link-close-${account.pointsUserId}`,
        "a".repeat(64),
        "b".repeat(64),
        userClientId,
        m2mClientId,
        `markets-user-${account.pointsUserId}`,
        account.pointsUserId,
        '["points.balance.read"]',
        "https://points.test/api/auth",
        `subject-${account.pointsUserId}`,
        `markets-connection-${account.pointsUserId}`,
        `finalize-close-${account.pointsUserId}`,
        account.now - 1_000,
        account.now + 1_000,
        account.now,
      ),
    db
      .prepare(
        `INSERT INTO points_oauth_connection
           (id, link_attempt_id, markets_points_connection_id, user_client_id, m2m_client_id,
            markets_user_id, points_user_id, issuer, points_subject, granted_scopes,
            status, grant_version, linked_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)`,
      )
      .bind(
        connectionId,
        linkAttemptId,
        `markets-connection-${account.pointsUserId}`,
        userClientId,
        m2mClientId,
        `markets-user-${account.pointsUserId}`,
        account.pointsUserId,
        "https://points.test/api/auth",
        `subject-${account.pointsUserId}`,
        '["points.balance.read"]',
        account.now,
        account.now,
      ),
  ]);
  return connectionId;
}

async function seedUnclaimedFixes(
  account: Awaited<ReturnType<typeof seedAccount>>,
  suffix: string,
) {
  const criterionId = `crit-reopen-${suffix}`;
  const [{ evaluationCriterionRevisionId }] = await importEvaluationCriteria(db, {
    actorPointsUserId: account.pointsUserId,
    items: [
      {
        balanceVisibleByDefault: true,
        buyNowEnabled: true,
        description: "Reopen criterion",
        evaluationCriterionId: criterionId,
        exchangeEnabled: true,
        expectedRevision: null,
        minimumUnit: "0.0001",
        name: `Reopen ${suffix.slice(0, 8)}`,
        relatedUrls: [],
        status: "ACTIVE",
        transferEnabled: true,
      },
    ],
    reason: "account reopen test",
  });
  const amounts = [5, -8];
  await db.batch(
    amounts.flatMap((amount, index) => {
      const fixResultId = `fix-result-reopen-${suffix}-${index}`;
      const revisionId = `fixrev-reopen-${suffix}-${index}`;
      return [
        db
          .prepare(
            "INSERT INTO fix_result (id, current_revision_id, current_revision, created_at) VALUES (?, ?, 1, ?)",
          )
          .bind(fixResultId, revisionId, account.now),
        db
          .prepare(
            `INSERT INTO fix_revision
               (id, fix_result_id, revision, file_hash, validation_hash, content_hash,
                actor_points_user_id, reason, created_at)
             VALUES (?, ?, 1, ?, ?, ?, ?, 'account reopen test', ?)`,
          )
          .bind(
            revisionId,
            fixResultId,
            `${index}`.repeat(64),
            `${index + 2}`.repeat(64),
            `${index + 4}`.repeat(64),
            account.pointsUserId,
            account.now,
          ),
        db
          .prepare(
            `INSERT INTO unclaimed_fix_entry
             (id, source_fix_revision_id, recipient_provider_id, recipient_account_id,
              recipient_profile_url, evaluation_criterion_id, evaluation_criterion_revision_id,
              delta_amount_scaled, evaluation_at, created_at)
             VALUES (?, ?, 'github', ?, ?, ?, ?, ?, '2026-07-01', ?)`,
          )
          .bind(
            `unclaimed-reopen-${suffix}-${index}`,
            revisionId,
            account.githubAccountId,
            `https://github.com/${account.githubAccountId}`,
            criterionId,
            evaluationCriterionRevisionId,
            amount,
            account.now + index,
          ),
      ];
    }),
  );
  return { criterionId };
}

describe("Points account close and reopen", () => {
  it("closes the account while retaining economic and permanent subject records", async () => {
    const suffix = crypto.randomUUID();
    const account = await seedAccount(suffix);
    const ownerships = await seedOwnerships(account);
    const connectionId = await seedPointsConnection(account);
    const app = authenticatedApp(account);

    const response = await close(app, `close-${suffix}`);

    expect(response.status).toBe(200);
    const state = await db
      .prepare(
        `SELECT user.account_status AS accountStatus, profile.display_name AS displayName,
                profile.description, profile.external_urls AS externalUrls,
                profile.visibility,
                (SELECT count(*) FROM session WHERE user_id = user.auth_user_id) AS sessionCount,
                (SELECT count(*) FROM permanent_oauth_subject WHERE points_user_id = user.id) AS subjectCount,
                (SELECT count(*) FROM account WHERE user_id = user.auth_user_id) AS accountCount,
                (SELECT count(*) FROM oauth_consent WHERE user_id = user.auth_user_id) AS consentCount,
                (SELECT count(*) FROM oauth_access_token
                  WHERE user_id = user.auth_user_id AND revoked IS NOT NULL) AS revokedAccessCount,
                (SELECT count(*) FROM oauth_refresh_token
                  WHERE user_id = user.auth_user_id AND revoked IS NOT NULL) AS revokedRefreshCount,
                (SELECT count(*) FROM audit_event WHERE actor_points_user_id = user.id
                  AND action = 'ACCOUNT_CLOSE') AS auditCount
         FROM points_user user JOIN profiles profile ON profile.points_user_id = user.id
         WHERE user.id = ?`,
      )
      .bind(account.pointsUserId)
      .first<Record<string, unknown>>();
    expect(state).toMatchObject({
      accountStatus: "CLOSED",
      accountCount: 2,
      auditCount: 1,
      consentCount: 0,
      description: "",
      displayName: "Closed account",
      externalUrls: "[]",
      revokedAccessCount: 1,
      revokedRefreshCount: 1,
      sessionCount: 1,
      subjectCount: 2,
      visibility: "PRIVATE",
    });
    await expect(
      db
        .prepare("SELECT status FROM identity_ownership WHERE id = ?")
        .bind(ownerships.activeId)
        .first(),
    ).resolves.toMatchObject({ status: "INACTIVE" });
    await expect(
      db
        .prepare("SELECT status FROM identity_ownership WHERE id = ?")
        .bind(ownerships.inactiveId)
        .first(),
    ).resolves.toMatchObject({ status: "INACTIVE" });
    await expect(
      db
        .prepare("SELECT status FROM identity_ownership WHERE id = ?")
        .bind(ownerships.webId)
        .first(),
    ).resolves.toMatchObject({ status: "INACTIVE" });
    await expect(
      db
        .prepare("SELECT ended_at AS endedAt FROM ownership_epoch WHERE id = ?")
        .bind(ownerships.webEpochId)
        .first(),
    ).resolves.toMatchObject({ endedAt: expect.any(Number) });
    await expect(
      db
        .prepare(
          "SELECT status, grant_version AS grantVersion FROM points_oauth_connection WHERE id = ?",
        )
        .bind(connectionId)
        .first(),
    ).resolves.toMatchObject({ grantVersion: 2, status: "UNLINKED" });
    await expect(
      db
        .prepare(
          "SELECT status FROM points_oauth_revocation_outbox WHERE points_connection_id = ? AND action = 'DELETE_CONSENT'",
        )
        .bind(connectionId)
        .first(),
    ).resolves.toMatchObject({ status: "PENDING" });

    const blocked = await app.fetch(new Request("https://points.test/api/profile"), env);
    expect(blocked.status).toBe(403);
    await expect(blocked.json()).resolves.toMatchObject({ code: "ACCOUNT_CLOSED" });
  });

  it("rejects the last ADMIN without changing account or profile state", async () => {
    const suffix = crypto.randomUUID();
    const account = await seedAccount(suffix, { admin: true });
    const app = authenticatedApp(account);

    const response = await close(app, `close-last-admin-${suffix}`);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "ACCOUNT_CLOSE_LAST_ADMIN" });
    await expect(
      db
        .prepare(
          `SELECT user.account_status AS accountStatus, profile.display_name AS displayName,
                  profile.visibility
           FROM points_user user JOIN profiles profile ON profile.points_user_id = user.id
           WHERE user.id = ?`,
        )
        .bind(account.pointsUserId)
        .first(),
    ).resolves.toMatchObject({
      accountStatus: "ACTIVE",
      displayName: "Visible name",
      visibility: "PUBLIC",
    });
  });

  it("removes a closing ADMIN membership when another ADMIN remains", async () => {
    const suffix = crypto.randomUUID();
    const closing = await seedAccount(`${suffix}-closing`, { admin: true });
    const remaining = await seedAccount(`${suffix}-remaining`, { admin: true });

    const response = await close(authenticatedApp(closing), `close-admin-${suffix}`);

    expect(response.status).toBe(200);
    await expect(
      db
        .prepare("SELECT count(*) AS count FROM admin_membership WHERE points_user_id = ?")
        .bind(closing.pointsUserId)
        .first(),
    ).resolves.toMatchObject({ count: 0 });
    await expect(
      db
        .prepare("SELECT count(*) AS count FROM admin_membership WHERE points_user_id = ?")
        .bind(remaining.pointsUserId)
        .first(),
    ).resolves.toMatchObject({ count: 1 });
  });

  it("rejects an ACTIVE reservation without changing account or profile state", async () => {
    const suffix = crypto.randomUUID();
    const account = await seedAccount(suffix);
    const criterionId = `crit-reserve-close-${suffix}`;
    await importEvaluationCriteria(db, {
      actorPointsUserId: account.pointsUserId,
      items: [
        {
          balanceVisibleByDefault: true,
          buyNowEnabled: true,
          description: "Close reservation criterion",
          evaluationCriterionId: criterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.0001",
          name: `Close ${suffix.slice(0, 8)}`,
          relatedUrls: [],
          status: "ACTIVE",
          transferEnabled: true,
        },
      ],
      reason: "account close reservation test",
    });
    const [pointPackage] = await importPointPackages(db, {
      actorPointsUserId: account.pointsUserId,
      items: [
        {
          components: [{ displayOrder: 0, evaluationCriterionId: criterionId, weight: 1 }],
          description: "Reservation Package",
          expectedRevision: null,
          name: `Reserve ${suffix.slice(0, 8)}`,
          pointPackageId: `pkg-reserve-close-${suffix}`,
          relatedUrl: null,
          status: "ACTIVE",
        },
      ],
      reason: "account close reservation test",
    });
    await db
      .prepare(
        `INSERT INTO point_account
           (points_user_id, evaluation_criterion_id, balance, evaluation_total, updated_at)
         VALUES (?, ?, 1000000, 1000000, ?)`,
      )
      .bind(account.pointsUserId, criterionId, account.now)
      .run();
    await createPointReservation(db, {
      auctionId: `auction-${suffix}`,
      idempotencyKey: `reservation-${suffix}`,
      marketsClientId: `markets-${suffix}`,
      marketsUserId: `markets-user-${suffix}`,
      now: new Date(account.now - 900_001),
      planHash: "1".repeat(64),
      pointPackageRevisionId: pointPackage.pointPackageRevisionId,
      pointsUserId: account.pointsUserId,
      priceTicks: 1,
      quantity: 1,
      reservationKey: `reservation-key-${suffix}`,
      settlementId: `settlement-${suffix}`,
    });

    const response = await close(authenticatedApp(account), `close-active-${suffix}`);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "ACCOUNT_CLOSE_ACTIVE_RESERVATION",
    });
    await expect(
      db
        .prepare(
          `SELECT user.account_status AS accountStatus, profile.display_name AS displayName,
                  profile.visibility,
                  (SELECT count(*) FROM session WHERE user_id = user.auth_user_id) AS sessionCount
           FROM points_user user JOIN profiles profile ON profile.points_user_id = user.id
           WHERE user.id = ?`,
        )
        .bind(account.pointsUserId)
        .first(),
    ).resolves.toMatchObject({
      accountStatus: "ACTIVE",
      displayName: "Visible name",
      sessionCount: 2,
      visibility: "PUBLIC",
    });
  });

  it("previews and claims every positive and negative permanent-subject FIX on reopen", async () => {
    const suffix = crypto.randomUUID();
    const account = await seedAccount(suffix);
    const ownerships = await seedOwnerships(account);
    const app = authenticatedApp(account);
    expect((await close(app, `close-for-reopen-${suffix}`)).status).toBe(200);
    const { criterionId } = await seedUnclaimedFixes(account, suffix);

    const previewResponse = await app.fetch(
      new Request("https://points.test/api/account/reopen-preview"),
      env,
    );
    expect(previewResponse.status).toBe(200);
    const preview = (await previewResponse.json()) as {
      data: {
        aggregates: Array<Record<string, unknown>>;
        reopenSetHash: string;
        totalCount: number;
      };
    };
    expect(preview.data).toMatchObject({
      aggregates: [
        {
          evaluationCriterionId: criterionId,
          negativeCount: 1,
          netAmountScaled: -3,
          positiveCount: 1,
          totalCount: 2,
        },
      ],
      reopenSetHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      totalCount: 2,
    });
    expect(JSON.stringify(preview.data)).not.toContain("selected");

    const reopened = await app.fetch(
      new Request("https://points.test/api/account/reopen", {
        body: JSON.stringify({ reopenSetHash: preview.data.reopenSetHash }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `reopen-${suffix}`,
        },
        method: "POST",
      }),
      env,
    );
    expect(reopened.status).toBe(200);
    await expect(reopened.json()).resolves.toMatchObject({
      data: { claimedCount: 2, pointsUserId: account.pointsUserId, status: "ACTIVE" },
    });
    await expect(
      db
        .prepare(
          `SELECT user.account_status AS accountStatus, profile.display_name AS displayName,
                  profile.visibility,
                  (SELECT count(*) FROM point_ledger_entry WHERE points_user_id = user.id
                    AND source_unclaimed_fix_entry_id IS NOT NULL) AS ledgerCount
                  ,(SELECT count(*) FROM fix_claim_item item
                    JOIN fix_claim claim ON claim.id = item.fix_claim_id
                    WHERE claim.points_user_id = user.id) AS claimItemCount
           FROM points_user user JOIN profiles profile ON profile.points_user_id = user.id
           WHERE user.id = ?`,
        )
        .bind(account.pointsUserId)
        .first(),
    ).resolves.toMatchObject({
      accountStatus: "ACTIVE",
      claimItemCount: 2,
      displayName: "Closed account",
      ledgerCount: 2,
      visibility: "PRIVATE",
    });
    await expect(
      db
        .prepare("SELECT status FROM identity_ownership WHERE id = ?")
        .bind(ownerships.activeId)
        .first(),
    ).resolves.toMatchObject({ status: "ACTIVE" });
    await expect(
      db
        .prepare("SELECT status FROM identity_ownership WHERE id = ?")
        .bind(ownerships.inactiveId)
        .first(),
    ).resolves.toMatchObject({ status: "INACTIVE" });
    await expect(
      db
        .prepare("SELECT status FROM identity_ownership WHERE id = ?")
        .bind(ownerships.webId)
        .first(),
    ).resolves.toMatchObject({ status: "INACTIVE" });
  });

  it("rejects reopen when the previewed FIX set changes", async () => {
    const suffix = crypto.randomUUID();
    const account = await seedAccount(suffix);
    await seedOwnerships(account);
    const app = authenticatedApp(account);
    expect((await close(app, `close-changed-${suffix}`)).status).toBe(200);
    await seedUnclaimedFixes(account, suffix);
    const previewResponse = await app.fetch(
      new Request("https://points.test/api/account/reopen-preview"),
      env,
    );
    const preview = (await previewResponse.json()) as { data: { reopenSetHash: string } };
    const extraFixResultId = `fix-result-reopen-extra-${suffix}`;
    const extraRevisionId = `fixrev-reopen-extra-${suffix}`;
    const criterion = await db
      .prepare(
        `SELECT id, current_revision_id AS revisionId FROM evaluation_criterion
         WHERE id = ?`,
      )
      .bind(`crit-reopen-${suffix}`)
      .first<{ id: string; revisionId: string }>();
    await db.batch([
      db
        .prepare(
          "INSERT INTO fix_result (id, current_revision_id, current_revision, created_at) VALUES (?, ?, 1, ?)",
        )
        .bind(extraFixResultId, extraRevisionId, account.now + 10),
      db
        .prepare(
          `INSERT INTO fix_revision
             (id, fix_result_id, revision, file_hash, validation_hash, content_hash,
              actor_points_user_id, reason, created_at)
           VALUES (?, ?, 1, ?, ?, ?, ?, 'set changed test', ?)`,
        )
        .bind(
          extraRevisionId,
          extraFixResultId,
          "6".repeat(64),
          "7".repeat(64),
          "8".repeat(64),
          account.pointsUserId,
          account.now + 10,
        ),
      db
        .prepare(
          `INSERT INTO unclaimed_fix_entry
             (id, source_fix_revision_id, recipient_provider_id, recipient_account_id,
              recipient_profile_url, evaluation_criterion_id, evaluation_criterion_revision_id,
              delta_amount_scaled, evaluation_at, created_at)
           VALUES (?, ?, 'github', ?, ?, ?, ?, 1, '2026-07-02', ?)`,
        )
        .bind(
          `unclaimed-reopen-extra-${suffix}`,
          extraRevisionId,
          account.githubAccountId,
          `https://github.com/${account.githubAccountId}`,
          criterion!.id,
          criterion!.revisionId,
          account.now + 10,
        ),
    ]);

    const response = await app.fetch(
      new Request("https://points.test/api/account/reopen", {
        body: JSON.stringify({ reopenSetHash: preview.data.reopenSetHash }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `reopen-changed-${suffix}`,
        },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "REOPEN_SET_CHANGED" });
    await expect(
      db
        .prepare("SELECT account_status AS accountStatus FROM points_user WHERE id = ?")
        .bind(account.pointsUserId)
        .first(),
    ).resolves.toMatchObject({ accountStatus: "CLOSED" });
  });
});
