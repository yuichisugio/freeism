import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { createPointsAuth } from "../../src/backend/auth/create-auth";
import type { Bindings } from "../../src/backend/http/context";
import {
  ensurePermanentOAuthSubject,
  PermanentOAuthSubjectConflictError,
  reconcilePermanentOAuthSubjects,
} from "../../src/backend/infrastructure/db/permanent-oauth-subject-repository";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";

async function createUser(suffix: string, providers: Array<"github" | "google"> = ["google"]) {
  const authUserId = `github-auth-${suffix}`;
  const now = Date.now();
  await env
    .DB!.prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(authUserId, authUserId, `${authUserId}@example.invalid`, now, now)
    .run();
  for (const provider of providers) {
    await env
      .DB!.prepare(
        `INSERT INTO account
           (id, account_id, provider_id, user_id, access_token, refresh_token, id_token,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `${provider}-${suffix}`,
        `${provider}-subject-${suffix}`,
        provider,
        authUserId,
        `${provider}-encrypted-access-${suffix}`,
        `${provider}-encrypted-refresh-${suffix}`,
        `${provider}-encrypted-id-${suffix}`,
        now,
        now,
      )
      .run();
  }
  const pointsUser = await provisionPointsUser(env.DB!, authUserId, () => `pusr_${suffix}`);
  return { authUserId, pointsUser };
}

function appFor(
  authUserId: string,
  dependencies: {
    getGitHubAccessToken?: () => Promise<string | null>;
    githubRevokeFetch?: typeof fetch;
  } = {},
) {
  return createPointsBackendApp({
    getSession: async () => ({
      session: { createdAt: new Date(), userId: authUserId },
      user: { id: authUserId },
    }),
    ...dependencies,
  });
}

async function seedGitHubUnclaimed(input: {
  accountId: string;
  actorPointsUserId: string;
  amountScaled: number;
  suffix: string;
}) {
  const criterionId = `criterion_${input.suffix}`;
  await importEvaluationCriteria(env.DB!, {
    actorPointsUserId: input.actorPointsUserId,
    items: [
      {
        balanceVisibleByDefault: false,
        buyNowEnabled: true,
        description: "GitHub ownership test",
        evaluationCriterionId: criterionId,
        exchangeEnabled: true,
        expectedRevision: null,
        minimumUnit: "0.0001",
        name: `GitHub ${input.suffix.slice(-16)}`,
        relatedUrls: [],
        status: "ACTIVE",
        transferEnabled: true,
      },
    ],
    reason: "GitHub ownership test",
  });
  const revisionId = `fixrev_${input.suffix}`;
  const resultId = `fix_${input.suffix}`;
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
        "a".repeat(64),
        "b".repeat(64),
        "c".repeat(64),
        input.actorPointsUserId,
        now,
      ),
    env
      .DB!.prepare(
        `INSERT INTO fix_revision_entry
           (id, fix_revision_id, recipient_provider_id, recipient_account_id,
            recipient_profile_url, identity_resolved_at, evaluation_criterion_id,
            evaluation_criterion_revision_id, amount_scaled, evaluation_at, created_at)
         VALUES (?, ?, 'github', ?, ?, ?, ?, ?, ?, '2026-07', ?)`,
      )
      .bind(
        `fixentry_${input.suffix}`,
        revisionId,
        input.accountId,
        `https://github.com/${input.suffix}`,
        now,
        criterionId,
        `ecr_${criterionId}_1`,
        input.amountScaled,
        now,
      ),
    env
      .DB!.prepare(
        `INSERT INTO unclaimed_fix_entry
           (id, source_fix_revision_id, recipient_provider_id, recipient_account_id,
            recipient_profile_url, evaluation_criterion_id, evaluation_criterion_revision_id,
            delta_amount_scaled, evaluation_at, created_at)
         VALUES (?, ?, 'github', ?, ?, ?, ?, ?, '2026-07', ?)`,
      )
      .bind(
        `unclaimed_${input.suffix}`,
        revisionId,
        input.accountId,
        `https://github.com/${input.suffix}`,
        criterionId,
        `ecr_${criterionId}_1`,
        input.amountScaled,
        now,
      ),
    env
      .DB!.prepare("INSERT INTO fix_revision_seal (fix_revision_id, sealed_at) VALUES (?, ?)")
      .bind(revisionId, now),
  ]);
}

describe("GitHub permanent ownership", () => {
  it("creates immutable provider subjects idempotently and never merges by email", async () => {
    const suffix = crypto.randomUUID();
    const first = await createUser(`${suffix}-first`, ["google", "github"]);
    const second = await createUser(`${suffix}-second`, ["google"]);
    await reconcilePermanentOAuthSubjects(env.DB!, first.authUserId, first.pointsUser.id);
    await reconcilePermanentOAuthSubjects(env.DB!, first.authUserId, first.pointsUser.id);

    const subjects = await env
      .DB!.prepare(
        `SELECT provider_id AS providerId, account_id AS accountId,
                points_user_id AS pointsUserId
         FROM permanent_oauth_subject WHERE points_user_id = ? ORDER BY provider_id`,
      )
      .bind(first.pointsUser.id)
      .all();
    expect(subjects.results).toEqual([
      {
        accountId: `github-subject-${suffix}-first`,
        pointsUserId: first.pointsUser.id,
        providerId: "github",
      },
      {
        accountId: `google-subject-${suffix}-first`,
        pointsUserId: first.pointsUser.id,
        providerId: "google",
      },
    ]);

    await expect(
      ensurePermanentOAuthSubject(env.DB!, {
        accountId: `github-subject-${suffix}-first`,
        pointsUserId: second.pointsUser.id,
        providerId: "github",
      }),
    ).rejects.toBeInstanceOf(PermanentOAuthSubjectConflictError);
    expect(
      await env
        .DB!.prepare(
          "SELECT points_user_id AS pointsUserId FROM permanent_oauth_subject WHERE provider_id = 'github' AND account_id = ?",
        )
        .bind(`github-subject-${suffix}-first`)
        .first(),
    ).toEqual({ pointsUserId: first.pointsUser.id });
  });

  it("enforces the provider/account uniqueness on Better Auth accounts", async () => {
    const suffix = crypto.randomUUID();
    const first = await createUser(`${suffix}-first`, ["github"]);
    const second = await createUser(`${suffix}-second`);
    await expect(
      env
        .DB!.prepare(
          `INSERT INTO account
             (id, account_id, provider_id, user_id, created_at, updated_at)
           VALUES (?, ?, 'github', ?, ?, ?)`,
        )
        .bind(
          `duplicate-${suffix}`,
          `github-subject-${suffix}-first`,
          second.authUserId,
          Date.now(),
          Date.now(),
        )
        .run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    expect(first.pointsUser.id).not.toBe(second.pointsUser.id);
  });

  it("rejects updates and deletes of a permanent subject at the database boundary", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix, ["github"]);
    await reconcilePermanentOAuthSubjects(env.DB!, user.authUserId, user.pointsUser.id);
    await expect(
      env
        .DB!.prepare(
          `UPDATE permanent_oauth_subject SET account_id = ?
           WHERE provider_id = 'github' AND account_id = ?`,
        )
        .bind(`moved-${suffix}`, `github-subject-${suffix}`)
        .run(),
    ).rejects.toThrow(/IMMUTABLE_PERMANENT_OAUTH_SUBJECT/);
    await expect(
      env
        .DB!.prepare(
          `DELETE FROM permanent_oauth_subject
           WHERE provider_id = 'github' AND account_id = ?`,
        )
        .bind(`github-subject-${suffix}`)
        .run(),
    ).rejects.toThrow(/IMMUTABLE_PERMANENT_OAUTH_SUBJECT/);
  });

  it("rejects Better Auth physical unlink before the wildcard handler", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix, ["google", "github"]);
    const response = await appFor(user.authUserId).fetch(
      new Request("https://points.test/api/auth/unlink-account", {
        body: JSON.stringify({ providerId: "github" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "ACCOUNT_UNLINK_DISABLED" });
    expect(
      await env
        .DB!.prepare("SELECT count(*) AS count FROM account WHERE user_id = ?")
        .bind(user.authUserId)
        .first(),
    ).toEqual({ count: 2 });
  });

  it("revokes the provider token, clears token ciphertexts, and preserves identity rows", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix, ["google", "github"]);
    const accountId = `github-subject-${suffix}`;
    await reconcilePermanentOAuthSubjects(env.DB!, user.authUserId, user.pointsUser.id);
    let revokeRequest: Request | undefined;
    const response = await appFor(user.authUserId, {
      getGitHubAccessToken: async () => `plain-token-${suffix}`,
      githubRevokeFetch: async (request) => {
        revokeRequest = request instanceof Request ? request : new Request(request);
        return new Response(null, { status: 204 });
      },
    }).fetch(
      new Request("https://points.test/api/ownership/github/deactivate", {
        body: JSON.stringify({ accountId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { accountId, status: "INACTIVE" },
    });
    expect(revokeRequest?.method).toBe("DELETE");
    expect(new URL(revokeRequest!.url).pathname).toBe(
      `/applications/${env.GITHUB_CLIENT_ID}/token`,
    );
    expect(
      await env
        .DB!.prepare(
          `SELECT access_token AS accessToken, refresh_token AS refreshToken, id_token AS idToken
           FROM account WHERE user_id = ? AND provider_id = 'github' AND account_id = ?`,
        )
        .bind(user.authUserId, accountId)
        .first(),
    ).toEqual({ accessToken: null, idToken: null, refreshToken: null });
    expect(
      await env
        .DB!.prepare(
          `SELECT ownership.status, ownership.permanent_correspondence AS permanentCorrespondence,
                  subject.points_user_id AS pointsUserId
           FROM identity_ownership ownership
           JOIN permanent_oauth_subject subject
             ON subject.provider_id = 'github'
            AND 'github:' || subject.account_id = ownership.normalized_identity_key
           WHERE subject.account_id = ?`,
        )
        .bind(accountId)
        .first(),
    ).toEqual({
      permanentCorrespondence: 1,
      pointsUserId: user.pointsUser.id,
      status: "INACTIVE",
    });
  });

  it("does not change ownership or tokens when provider revoke fails", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix, ["google", "github"]);
    const accountId = `github-subject-${suffix}`;
    await reconcilePermanentOAuthSubjects(env.DB!, user.authUserId, user.pointsUser.id);
    const response = await appFor(user.authUserId, {
      getGitHubAccessToken: async () => `plain-token-${suffix}`,
      githubRevokeFetch: async () => new Response(null, { status: 503 }),
    }).fetch(
      new Request("https://points.test/api/ownership/github/deactivate", {
        body: JSON.stringify({ accountId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: "GITHUB_TOKEN_REVOKE_FAILED" });
    expect(
      await env
        .DB!.prepare("SELECT status FROM identity_ownership WHERE normalized_identity_key = ?")
        .bind(`github:${accountId}`)
        .first(),
    ).toEqual({ status: "ACTIVE" });
    expect(
      await env
        .DB!.prepare(
          "SELECT access_token AS accessToken FROM account WHERE user_id = ? AND provider_id = 'github'",
        )
        .bind(user.authUserId)
        .first(),
    ).toEqual({ accessToken: `github-encrypted-access-${suffix}` });
  });

  it("does not mistake token access failure for an already-revoked token", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix, ["google", "github"]);
    const accountId = `github-subject-${suffix}`;
    await reconcilePermanentOAuthSubjects(env.DB!, user.authUserId, user.pointsUser.id);
    const response = await appFor(user.authUserId, {
      getGitHubAccessToken: async () => {
        throw new Error("decrypt failed");
      },
    }).fetch(
      new Request("https://points.test/api/ownership/github/deactivate", {
        body: JSON.stringify({ accountId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: "GITHUB_TOKEN_ACCESS_FAILED" });
    expect(
      await env
        .DB!.prepare(
          `SELECT ownership.status, account.access_token AS accessToken
           FROM identity_ownership ownership
           JOIN account ON account.account_id = ? AND account.provider_id = 'github'
           WHERE ownership.normalized_identity_key = ?`,
        )
        .bind(accountId, `github:${accountId}`)
        .first(),
    ).toEqual({ accessToken: `github-encrypted-access-${suffix}`, status: "ACTIVE" });
  });

  it("converges deactivation without another revoke only when all stored tokens are already null", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix, ["google", "github"]);
    const accountId = `github-subject-${suffix}`;
    await reconcilePermanentOAuthSubjects(env.DB!, user.authUserId, user.pointsUser.id);
    await env
      .DB!.prepare(
        `UPDATE account SET access_token = NULL, refresh_token = NULL, id_token = NULL
         WHERE user_id = ? AND provider_id = 'github' AND account_id = ?`,
      )
      .bind(user.authUserId, accountId)
      .run();
    let tokenRead = false;
    const response = await appFor(user.authUserId, {
      getGitHubAccessToken: async () => {
        tokenRead = true;
        throw new Error("must not read an absent token");
      },
    }).fetch(
      new Request("https://points.test/api/ownership/github/deactivate", {
        body: JSON.stringify({ accountId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(tokenRead).toBe(false);
    expect(
      await env
        .DB!.prepare("SELECT status FROM identity_ownership WHERE normalized_identity_key = ?")
        .bind(`github:${accountId}`)
        .first(),
    ).toEqual({ status: "INACTIVE" });
  });

  it("creates the permanent subject through the Better Auth hook and never reactivates it on token update", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const accountId = `github-subject-${suffix}`;
    const adapter = (await createPointsAuth(env as Bindings).$context).internalAdapter;
    const account = await adapter.createAccount({
      accessToken: `encrypted-${suffix}`,
      accountId,
      providerId: "github",
      userId: user.authUserId,
    });
    expect(
      await env
        .DB!.prepare(
          `SELECT points_user_id AS pointsUserId FROM permanent_oauth_subject
           WHERE provider_id = 'github' AND account_id = ?`,
        )
        .bind(accountId)
        .first(),
    ).toEqual({ pointsUserId: user.pointsUser.id });
    await env
      .DB!.prepare(
        "UPDATE identity_ownership SET status = 'INACTIVE' WHERE normalized_identity_key = ?",
      )
      .bind(`github:${accountId}`)
      .run();
    await adapter.updateAccount(account.id, { accessToken: `new-encrypted-${suffix}` });
    expect(
      await env
        .DB!.prepare("SELECT status FROM identity_ownership WHERE normalized_identity_key = ?")
        .bind(`github:${accountId}`)
        .first(),
    ).toEqual({ status: "INACTIVE" });
  });

  it("reactivates only explicitly and returns a positive/negative preview before confirm", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix, ["google", "github"]);
    const accountId = `github-subject-${suffix}`;
    await reconcilePermanentOAuthSubjects(env.DB!, user.authUserId, user.pointsUser.id);
    await env
      .DB!.prepare(
        "UPDATE identity_ownership SET status = 'INACTIVE' WHERE normalized_identity_key = ?",
      )
      .bind(`github:${accountId}`)
      .run();
    await seedGitHubUnclaimed({
      accountId,
      actorPointsUserId: user.pointsUser.id,
      amountScaled: 2_000,
      suffix: `${suffix}_positive`,
    });
    await seedGitHubUnclaimed({
      accountId,
      actorPointsUserId: user.pointsUser.id,
      amountScaled: -500,
      suffix: `${suffix}_negative`,
    });
    const app = appFor(user.authUserId, {
      getGitHubAccessToken: async () => `new-plain-token-${suffix}`,
    });
    const reactivate = await app.fetch(
      new Request("https://points.test/api/ownership/github/reactivate", {
        body: JSON.stringify({ accountId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(reactivate.status).toBe(200);
    const body = (await reactivate.json()) as {
      data: {
        claimPreview: { claimSetHash: string; totalCount: number };
        identityOwnershipId: string;
        status: string;
      };
    };
    expect(body.data).toMatchObject({
      claimPreview: { totalCount: 2 },
      status: "ACTIVE",
    });
    expect(
      await env
        .DB!.prepare("SELECT count(*) AS count FROM point_ledger_entry WHERE points_user_id = ?")
        .bind(user.pointsUser.id)
        .first(),
    ).toEqual({ count: 0 });

    const claim = await app.fetch(
      new Request(`https://points.test/api/ownership/${body.data.identityOwnershipId}/claim`, {
        body: JSON.stringify({ claimSetHash: body.data.claimPreview.claimSetHash }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": `claim-${suffix}` },
        method: "POST",
      }),
      env,
    );
    expect(claim.status).toBe(201);
    await expect(claim.json()).resolves.toMatchObject({ data: { claimedCount: 2 } });
  });
});
