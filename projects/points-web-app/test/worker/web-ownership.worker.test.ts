import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { lapseWebOwnership } from "../../src/backend/usecases/lapse-web-ownership";
import { runDueWebRevalidations } from "../../src/backend/usecases/run-due-web-revalidations";
import { verifyWebOwnership } from "../../src/backend/usecases/verify-web-ownership";

async function createUser(suffix: string) {
  const authUserId = `web-auth-${suffix}`;
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
      .bind(`google-${suffix}`, `google-${suffix}`, authUserId, now, now),
    env
      .DB!.prepare("INSERT INTO points_user (id, auth_user_id) VALUES (?, ?)")
      .bind(`pusr_${suffix}`, authUserId),
  ]);
  return { authUserId, pointsUserId: `pusr_${suffix}` };
}

async function lapseForTest(ownershipId: string, epochId: string, now: number) {
  await env
    .DB!.prepare("UPDATE identity_ownership SET status = 'REVERIFYING' WHERE id = ?")
    .bind(ownershipId)
    .run();
  expect(await lapseWebOwnership(env.DB!, ownershipId, epochId, now)).toBe(true);
}

async function seedUnclaimedWebFix(input: {
  actorPointsUserId: string;
  evaluationAt: string;
  normalizedUrl: string;
  suffix: string;
}) {
  const criterionId = `criterion_${input.suffix}`;
  await importEvaluationCriteria(env.DB!, {
    actorPointsUserId: input.actorPointsUserId,
    items: [
      {
        balanceVisibleByDefault: false,
        buyNowEnabled: true,
        description: "Web ownership preview",
        evaluationCriterionId: criterionId,
        exchangeEnabled: true,
        expectedRevision: null,
        minimumUnit: "0.0001",
        name: `Web ${input.suffix.slice(-12)}`,
        relatedUrls: [],
        status: "ACTIVE",
        transferEnabled: true,
      },
    ],
    reason: "Web ownership preview",
  });
  const now = Date.now();
  const revisionId = `fixrev_${input.suffix}`;
  await env.DB!.batch([
    env
      .DB!.prepare(
        "INSERT INTO fix_result (id, current_revision_id, current_revision, created_at) VALUES (?, ?, 1, ?)",
      )
      .bind(`fix_${input.suffix}`, revisionId, now),
    env
      .DB!.prepare(
        `INSERT INTO fix_revision
         (id, fix_result_id, revision, file_hash, validation_hash, content_hash,
          actor_points_user_id, reason, created_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, 'test', ?)`,
      )
      .bind(
        revisionId,
        `fix_${input.suffix}`,
        "a".repeat(64),
        "b".repeat(64),
        "c".repeat(64),
        input.actorPointsUserId,
        now,
      ),
    env
      .DB!.prepare(
        `INSERT INTO fix_revision_entry
         (id, fix_revision_id, recipient_profile_url, evaluation_criterion_id,
          evaluation_criterion_revision_id, amount_scaled, evaluation_at, created_at)
       VALUES (?, ?, ?, ?, ?, 10000, ?, ?)`,
      )
      .bind(
        `fixentry_${input.suffix}`,
        revisionId,
        input.normalizedUrl,
        criterionId,
        `ecr_${criterionId}_1`,
        input.evaluationAt,
        now,
      ),
    env
      .DB!.prepare(
        `INSERT INTO unclaimed_fix_entry
         (id, source_fix_revision_id, recipient_profile_url, evaluation_criterion_id,
          evaluation_criterion_revision_id, delta_amount_scaled, evaluation_at, created_at)
       VALUES (?, ?, ?, ?, ?, 10000, ?, ?)`,
      )
      .bind(
        `unclaimed_${input.suffix}`,
        revisionId,
        input.normalizedUrl,
        criterionId,
        `ecr_${criterionId}_1`,
        input.evaluationAt,
        now,
      ),
    env
      .DB!.prepare("INSERT INTO fix_revision_seal (fix_revision_id, sealed_at) VALUES (?, ?)")
      .bind(revisionId, now),
  ]);
}

function appFor(authUserId: string, webOwnershipFetch: typeof fetch) {
  return createPointsBackendApp({
    getSession: async () => ({
      session: { createdAt: new Date(), userId: authUserId },
      user: { id: authUserId },
    }),
    webOwnershipFetch,
  });
}

function verificationRequest(url: string, idempotencyKey: string = crypto.randomUUID()) {
  return new Request("https://points.freeism.app/api/ownership/web/verify", {
    body: JSON.stringify({ url }),
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    method: "POST",
  });
}

describe("Web ownership verification", () => {
  it("verifies an editable HTTPS page without forwarding request headers", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const fetcher = vi.fn<typeof fetch>(async (request) => {
      const outbound = request instanceof Request ? request : new Request(request);
      expect(outbound.redirect).toBe("manual");
      expect(outbound.cache).toBe("no-store");
      expect([...outbound.headers]).toEqual([]);
      return new Response(
        `<a rel="me" href="https://points.freeism.app/profiles/${user.pointsUserId}">me</a>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    });

    const response = await appFor(user.authUserId, fetcher).fetch(
      verificationRequest(`https://profiles.example.net:443/${suffix}`),
      env,
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: { status: string } }).data.status).toBe("ACTIVE");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    "http://profiles.example.net/alice",
    "https://user:secret@profiles.example.net/alice",
    "https://127.0.0.1/alice",
    "https://localhost/alice",
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://profiles.example.net:444/alice",
  ])("rejects unsafe URLs before fetch", async (url) => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const fetcher = vi.fn<typeof fetch>();
    const response = await appFor(user.authUserId, fetcher).fetch(verificationRequest(url), env);
    expect(response.status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("revalidates every redirect hop and allows at most three redirects", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const urls = [
      "https://one.example.net/a",
      "https://two.example.net/a",
      "https://three.example.net/a",
      "https://four.example.net/a",
    ];
    let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async () => {
      const current = calls++;
      if (current < 3) return Response.redirect(urls[current + 1]!, 302);
      return new Response(
        `<link rel="me" href="https://points.freeism.app/profiles/${user.pointsUserId}">`,
        { headers: { "Content-Type": "text/html" } },
      );
    });
    const ok = await appFor(user.authUserId, fetcher).fetch(verificationRequest(urls[0]!), env);
    expect(ok.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(4);

    const privateRedirect = vi.fn<typeof fetch>(async () =>
      Response.redirect("https://localhost/secret", 302),
    );
    const blocked = await appFor(user.authUserId, privateRedirect).fetch(
      verificationRequest(`https://redirect.example.net/${suffix}`),
      env,
    );
    expect(blocked.status).toBe(422);
    expect(privateRedirect).toHaveBeenCalledTimes(1);

    const tooManyRedirects = vi.fn<typeof fetch>(async (request) => {
      const current = new URL(request instanceof Request ? request.url : request.toString());
      current.pathname += "/next";
      return Response.redirect(current, 302);
    });
    const rejected = await appFor(user.authUserId, tooManyRedirects).fetch(
      verificationRequest(`https://redirect-limit.example.net/${suffix}`),
      env,
    );
    expect(rejected.status).toBe(422);
    expect(tooManyRedirects).toHaveBeenCalledTimes(4);
  });

  it.each([
    ["text/html", "1", "<a href='https://points.freeism.app/profiles/unused'>x</a>"],
    ["application/json", null, "{}"],
    ["text/html", null, "x".repeat(1024 * 1024 + 1)],
  ])("rejects cached, unsupported, and oversized responses", async (contentType, age, body) => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const headers = new Headers({ "Content-Type": contentType });
    if (age) headers.set("Age", age);
    const response = await appFor(
      user.authUserId,
      async () => new Response(body, { headers }),
    ).fetch(verificationRequest(`https://profiles.example.net/${suffix}`), env);
    expect(response.status).toBe(422);
  });

  it.each(["HIT", "STALE", "UPDATING", "REVALIDATED", "EXPIRED"])(
    "rejects CF cache status %s as ownership evidence",
    async (cacheStatus) => {
      const suffix = crypto.randomUUID();
      const user = await createUser(suffix);
      const response = await appFor(
        user.authUserId,
        async () =>
          new Response(
            `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
            { headers: { "CF-Cache-Status": cacheStatus, "Content-Type": "text/html" } },
          ),
      ).fetch(verificationRequest(`https://profiles.example.net/${suffix}`), env);
      expect(response.status).toBe(422);
    },
  );

  it("uses only the HTTP Link header for text/plain", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const profile = `https://points.freeism.app/profiles/${user.pointsUserId}`;
    const app = appFor(user.authUserId, async (request) => {
      const url = new URL(request instanceof Request ? request.url : request.toString());
      const headers = new Headers({ "Content-Type": "text/plain" });
      if (url.pathname.endsWith("/header")) headers.set("Link", `<${profile}>; rel="me"`);
      return new Response(`<a href="${profile}">not HTML</a>`, { headers });
    });
    expect(
      (await app.fetch(verificationRequest(`https://plain.example.net/${suffix}/body`), env))
        .status,
    ).toBe(422);
    expect(
      (await app.fetch(verificationRequest(`https://plain.example.net/${suffix}/header`), env))
        .status,
    ).toBe(200);
  });

  it("does not use code markup as HTMLRewriter evidence", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const response = await appFor(
      user.authUserId,
      async () =>
        new Response(
          `<code><a href="https://points.freeism.app/profiles/${user.pointsUserId}">sample</a></code>`,
          { headers: { "Content-Type": "text/html" } },
        ),
    ).fetch(verificationRequest(`https://code.example.net/${suffix}`), env);
    expect(response.status).toBe(422);
  });

  it("uses one five-second abort deadline for the page fetch", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const fetcher: typeof fetch = async (request) =>
      new Promise((_resolve, reject) => {
        const signal = request instanceof Request ? request.signal : undefined;
        signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    const startedAt = Date.now();
    const response = await appFor(user.authUserId, fetcher).fetch(
      verificationRequest(`https://timeout.example.net/${suffix}`),
      env,
    );
    expect(response.status).toBe(422);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(4_900);
    expect(Date.now() - startedAt).toBeLessThan(6_000);
  }, 7_000);

  it("audits a failed Web verification without storing the fetched page body", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const requestId = `req-${suffix}-failed-audit`;
    const secretBody = `PRIVATE_PAGE_BODY_${suffix}`;
    await expect(
      verifyWebOwnership(
        { DB: env.DB! },
        {
          fetchImpl: async () =>
            new Response(`<p>${secretBody}</p>`, {
              headers: { "Content-Type": "text/html" },
            }),
          pointsUserId: user.pointsUserId,
          requestId,
          url: `https://failed-audit.example.net/${suffix}`,
        },
      ),
    ).rejects.toMatchObject({ code: "WEB_PROFILE_LINK_NOT_FOUND" });

    const audits = await env
      .DB!.prepare(
        `SELECT action, reason, result FROM audit_event
         WHERE request_id = ? ORDER BY rowid`,
      )
      .bind(requestId)
      .all<{ action: string; reason: string | null; result: string }>();
    expect(audits.results.map(({ action }) => action)).toEqual([
      "WEB_OWNERSHIP_VERIFICATION_STARTED",
      "WEB_OWNERSHIP_VERIFICATION_FAILED",
    ]);
    expect(JSON.stringify(audits.results)).not.toContain(secretBody);
  });

  it("replays the same key and rejects a different payload without verifying twice", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
          { headers: { "Content-Type": "text/html" } },
        ),
    );
    const app = appFor(user.authUserId, fetcher);
    const key = `verify-${suffix}`;
    const url = `https://profiles.example.net/${suffix}`;
    const first = await app.fetch(verificationRequest(url, key), env);
    const replay = await app.fetch(
      verificationRequest(`https://profiles.example.net:443/${suffix}`, key),
      env,
    );
    const conflict = await app.fetch(
      verificationRequest(`https://profiles.example.net/${suffix}-other`, key),
      env,
    );
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    expect(conflict.status).toBe(409);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not increment reownership successCount on an idempotent retry", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const url = `https://idempotent-reownership.example.net/${suffix}`;
    const fetcher: typeof fetch = async () =>
      new Response(
        `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
        { headers: { "Content-Type": "text/html" } },
      );
    const initial = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: Date.now() - 40 * 86_400_000,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-initial`,
        url,
      },
    );
    await lapseForTest(
      initial.identityOwnershipId,
      initial.ownershipEpochId!,
      Date.now() - 10 * 86_400_000,
    );
    const firstAt = Date.now() - 6 * 86_400_000;
    await env
      .DB!.prepare(
        `INSERT INTO web_reownership_candidate
         (identity_ownership_id, candidate_points_user_id, first_success_at,
          last_success_at, next_eligible_at, success_count, evidence_hash, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        initial.identityOwnershipId,
        user.pointsUserId,
        firstAt,
        firstAt,
        firstAt + 5 * 86_400_000,
        "d".repeat(64),
        firstAt,
      )
      .run();
    const app = appFor(user.authUserId, fetcher);
    const key = `reownership-${suffix}`;
    const first = await app.fetch(verificationRequest(url, key), env);
    const replay = await app.fetch(verificationRequest(url, key), env);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    const candidate = await env
      .DB!.prepare(
        "SELECT success_count AS successCount FROM web_reownership_candidate WHERE identity_ownership_id = ?",
      )
      .bind(initial.identityOwnershipId)
      .first<{ successCount: number }>();
    expect(candidate?.successCount).toBe(2);
  });
});

describe("Web ownership lifecycle", () => {
  it("keeps the epoch on a successful 30-day revalidation and never claims", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const now = Date.parse("2026-07-13T00:00:00Z");
    const app = appFor(
      user.authUserId,
      async () =>
        new Response(
          `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
          { headers: { "Content-Type": "text/html" } },
        ),
    );
    const verified = await app.fetch(
      verificationRequest(`https://profiles.example.net/${suffix}`),
      env,
    );
    expect(verified.status).toBe(200);
    const data = ((await verified.json()) as { data: unknown }).data as {
      identityOwnershipId: string;
      ownershipEpochId: string;
    };
    await env
      .DB!.prepare(
        "UPDATE ownership_revalidation_job SET due_at = ? WHERE identity_ownership_id = ?",
      )
      .bind(now, data.identityOwnershipId)
      .run();

    const result = await runDueWebRevalidations(
      env.DB!,
      now,
      async () =>
        new Response(
          `<a rel="me" href="https://points.freeism.app/profiles/${user.pointsUserId}">me</a>`,
          { headers: { "Content-Type": "text/html" } },
        ),
    );
    expect(result).toEqual({ leased: 1, succeeded: 1, failed: 0, lapsed: 0 });
    const ownership = await env
      .DB!.prepare(
        "SELECT status, current_ownership_epoch_id AS epochId FROM identity_ownership WHERE id = ?",
      )
      .bind(data.identityOwnershipId)
      .first<{ status: string; epochId: string }>();
    expect(ownership).toEqual({ status: "ACTIVE", epochId: data.ownershipEpochId });
    const successAudit = await env
      .DB!.prepare(
        `SELECT reason, result FROM audit_event
         WHERE action = 'WEB_OWNERSHIP_CRON_SUCCEEDED' AND target = ?`,
      )
      .bind(data.identityOwnershipId)
      .first<{ reason: string; result: string }>();
    expect(successAudit?.result).toBe("ACTIVE");
    expect(JSON.parse(successAudit!.reason)).toMatchObject({
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      finalUrl: `https://profiles.example.net/${suffix}`,
      method: "WEB_LINK",
    });
    expect(
      (await env.DB!.prepare("SELECT count(*) AS count FROM fix_claim").first<{ count: number }>())!
        .count,
    ).toBe(0);

    const nextJob = await env
      .DB!.prepare(
        "SELECT due_at AS dueAt FROM ownership_revalidation_job WHERE identity_ownership_id = ? AND status = 'PENDING'",
      )
      .bind(data.identityOwnershipId)
      .first<{ dueAt: number }>();
    const secondCycle = await runDueWebRevalidations(
      env.DB!,
      nextJob!.dueAt,
      async () =>
        new Response(
          `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
          { headers: { "Content-Type": "text/html" } },
        ),
    );
    expect(secondCycle.succeeded).toBe(1);
    const cycles = await env
      .DB!.prepare(
        "SELECT count(DISTINCT verification_cycle_id) AS count FROM ownership_revalidation_job WHERE identity_ownership_id = ?",
      )
      .bind(data.identityOwnershipId)
      .first<{ count: number }>();
    expect(cycles?.count).toBe(3);
  });

  it("retries at +3d and +7d, then lapses the old epoch", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const first = Date.parse("2026-07-13T00:00:00Z");
    const response = await appFor(
      user.authUserId,
      async () =>
        new Response(
          `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
          { headers: { "Content-Type": "text/html" } },
        ),
    ).fetch(verificationRequest(`https://profiles.example.net/${suffix}`), env);
    const data = ((await response.json()) as { data: unknown }).data as {
      identityOwnershipId: string;
    };
    await env
      .DB!.prepare(
        "UPDATE ownership_revalidation_job SET due_at = ? WHERE identity_ownership_id = ?",
      )
      .bind(first, data.identityOwnershipId)
      .run();
    const failingFetch: typeof fetch = async () => {
      throw new Error("offline");
    };
    expect(await runDueWebRevalidations(env.DB!, first, failingFetch)).toMatchObject({ failed: 1 });
    expect(
      await runDueWebRevalidations(env.DB!, first + 3 * 86_400_000, failingFetch),
    ).toMatchObject({ failed: 1 });
    expect(
      await runDueWebRevalidations(env.DB!, first + 7 * 86_400_000, failingFetch),
    ).toMatchObject({ failed: 1, lapsed: 1 });
    const ownership = await env
      .DB!.prepare("SELECT status FROM identity_ownership WHERE id = ?")
      .bind(data.identityOwnershipId)
      .first<{ status: string }>();
    expect(ownership?.status).toBe("LAPSED");
    const cronAudits = await env
      .DB!.prepare(
        `SELECT action FROM audit_event
         WHERE target = ? AND action IN ('WEB_OWNERSHIP_CRON_FAILED', 'WEB_OWNERSHIP_LAPSED')
         ORDER BY created_at, id`,
      )
      .bind(data.identityOwnershipId)
      .all<{ action: string }>();
    expect(
      cronAudits.results.filter(({ action }) => action === "WEB_OWNERSHIP_CRON_FAILED"),
    ).toHaveLength(3);
    expect(
      cronAudits.results.filter(({ action }) => action === "WEB_OWNERSHIP_LAPSED"),
    ).toHaveLength(1);
  });

  it("lapses when verification succeeds after the seven-day retry window", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const firstFailureAt = Date.parse("2026-07-13T00:00:00Z");
    const url = `https://expired-revalidation.example.net/${suffix}`;
    const proof = () =>
      new Response(
        `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
        { headers: { "Content-Type": "text/html" } },
      );
    const initial = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: async () => proof(),
        now: firstFailureAt - 30 * 86_400_000,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-initial`,
        url,
      },
    );
    await env
      .DB!.prepare(
        `UPDATE ownership_revalidation_job
         SET attempt = 2, cycle_started_at = ?, due_at = ?
         WHERE identity_ownership_id = ? AND status = 'PENDING'`,
      )
      .bind(firstFailureAt, firstFailureAt + 3 * 86_400_000, initial.identityOwnershipId)
      .run();

    const result = await runDueWebRevalidations(
      env.DB!,
      firstFailureAt + 8 * 86_400_000,
      async () => proof(),
    );
    expect(result).toMatchObject({ failed: 1, lapsed: 1, succeeded: 0 });
    const ownership = await env
      .DB!.prepare("SELECT status FROM identity_ownership WHERE id = ?")
      .bind(initial.identityOwnershipId)
      .first<{ status: string }>();
    expect(ownership?.status).toBe("LAPSED");
  });

  it("resolves a lag alert after a delayed failed attempt schedules its retry", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const due = Date.parse("2026-07-13T00:00:00Z");
    const response = await appFor(
      user.authUserId,
      async () =>
        new Response(
          `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
          { headers: { "Content-Type": "text/html" } },
        ),
    ).fetch(verificationRequest(`https://lag.example.net/${suffix}`), env);
    const data = ((await response.json()) as { data: { identityOwnershipId: string } }).data;
    await env
      .DB!.prepare(
        "UPDATE ownership_revalidation_job SET due_at = ? WHERE identity_ownership_id = ?",
      )
      .bind(due, data.identityOwnershipId)
      .run();
    await runDueWebRevalidations(env.DB!, due + 15 * 60_000 + 1, async () => {
      throw new Error("offline");
    });
    expect(
      (
        await env
          .DB!.prepare(
            "SELECT status FROM ops_alert WHERE type = 'OWNERSHIP_SCHEDULER_LAG' AND resource_id_hash IS NOT NULL ORDER BY last_observed_at DESC LIMIT 1",
          )
          .first<{ status: string }>()
      )?.status,
    ).toBe("RESOLVED");
    await runDueWebRevalidations(
      env.DB!,
      due + 15 * 60_000 + 1 + 3 * 86_400_000,
      async () =>
        new Response(
          `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
          { headers: { "Content-Type": "text/html" } },
        ),
    );
    expect(
      (
        await env
          .DB!.prepare(
            "SELECT status FROM ops_alert WHERE type = 'OWNERSHIP_SCHEDULER_LAG' ORDER BY last_observed_at DESC LIMIT 1",
          )
          .first<{ status: string }>()
      )?.status,
    ).toBe("RESOLVED");
  });

  it("counts reownership successes five days apart and uses the third success as effectiveAt", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const start = Date.parse("2026-07-01T00:00:00Z");
    const url = `https://reowned.example.net/${suffix}`;
    const fetcher: typeof fetch = async () =>
      new Response(
        `<a rel="me" href="https://points.freeism.app/profiles/${user.pointsUserId}">me</a>`,
        { headers: { "Content-Type": "text/html" } },
      );
    const initial = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: start,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-0`,
        url,
      },
    );
    await lapseForTest(
      initial.identityOwnershipId,
      initial.ownershipEpochId!,
      start + 30 * 86_400_000,
    );
    const firstAt = start + 31 * 86_400_000;
    const first = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: firstAt,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-1`,
        url,
      },
    );
    const early = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: firstAt + 4 * 86_400_000,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-early`,
        url,
      },
    );
    const second = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: firstAt + 5 * 86_400_000,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-2`,
        url,
      },
    );
    const thirdAt = firstAt + 10 * 86_400_000;
    await seedUnclaimedWebFix({
      actorPointsUserId: user.pointsUserId,
      evaluationAt: new Date(thirdAt).toISOString(),
      normalizedUrl: url,
      suffix: `${suffix}_preview`,
    });
    const third = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: thirdAt,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-3`,
        url,
      },
    );
    expect([first.successCount, early.successCount, second.successCount]).toEqual([1, 1, 2]);
    expect(third).toMatchObject({ effectiveAt: thirdAt, status: "ACTIVE", successCount: 3 });
    expect(third.claimPreview).toMatchObject({ totalCount: 1 });
    expect(third.claimPreview?.claimSetHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      (
        await env
          .DB!.prepare("SELECT count(*) AS count FROM point_ledger_entry")
          .first<{ count: number }>()
      )?.count,
    ).toBe(0);
    const epoch = await env
      .DB!.prepare("SELECT effective_at AS effectiveAt FROM ownership_epoch WHERE id = ?")
      .bind(third.ownershipEpochId)
      .first<{ effectiveAt: number }>();
    expect(epoch?.effectiveAt).toBe(thirdAt);
  });

  it("resets a reownership candidate after the fourteen-day window", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const start = Date.parse("2026-07-01T00:00:00Z");
    const url = `https://reownership-window.example.net/${suffix}`;
    const fetcher: typeof fetch = async () =>
      new Response(
        `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
        { headers: { "Content-Type": "text/html" } },
      );
    const initial = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: start,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-0`,
        url,
      },
    );
    await lapseForTest(initial.identityOwnershipId, initial.ownershipEpochId!, start + 86_400_000);
    const firstAt = start + 2 * 86_400_000;
    await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: firstAt,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-1`,
        url,
      },
    );
    const resetAt = firstAt + 14 * 86_400_000 + 1;
    const reset = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: resetAt,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-reset`,
        url,
      },
    );
    expect(reset).toMatchObject({ status: "PENDING_REOWNERSHIP", successCount: 1 });
    const candidate = await env
      .DB!.prepare(
        "SELECT first_success_at AS firstSuccessAt FROM web_reownership_candidate WHERE identity_ownership_id = ?",
      )
      .bind(initial.identityOwnershipId)
      .first<{ firstSuccessAt: number }>();
    expect(candidate?.firstSuccessAt).toBe(resetAt);
  });

  it("audits a pending reownership success with only safe fetch evidence", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const start = Date.parse("2026-07-01T00:00:00Z");
    const url = `https://pending-audit.example.net/${suffix}`;
    const secretBody = `PRIVATE_PENDING_BODY_${suffix}`;
    const fetcher: typeof fetch = async () =>
      new Response(
        `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>${secretBody}`,
        { headers: { "Content-Type": "text/html" } },
      );
    const initial = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: start,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-initial`,
        url,
      },
    );
    await env
      .DB!.prepare("UPDATE identity_ownership SET status = 'REVERIFYING' WHERE id = ?")
      .bind(initial.identityOwnershipId)
      .run();
    expect(
      await lapseWebOwnership(
        env.DB!,
        initial.identityOwnershipId,
        initial.ownershipEpochId!,
        start + 30 * 86_400_000,
      ),
    ).toBe(true);
    const requestId = `req-${suffix}-pending`;
    const pending = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: fetcher,
        now: start + 31 * 86_400_000,
        pointsUserId: user.pointsUserId,
        requestId,
        url,
      },
    );
    expect(pending.status).toBe("PENDING_REOWNERSHIP");

    const audit = await env
      .DB!.prepare(
        `SELECT action, reason, result FROM audit_event
         WHERE request_id = ? AND action = 'WEB_OWNERSHIP_REOWNERSHIP_PENDING'`,
      )
      .bind(requestId)
      .first<{ action: string; reason: string; result: string }>();
    expect(audit?.result).toBe("PENDING_REOWNERSHIP");
    expect(JSON.parse(audit!.reason)).toMatchObject({
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      finalUrl: url,
      method: "WEB_LINK",
    });
    expect(audit?.reason).not.toContain(secretBody);
  });

  it("leases at most fifty due ownerships per scheduler run", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const due = Date.parse("2026-07-13T00:00:00Z");
    for (let index = 0; index < 51; index += 1) {
      const ownershipId = `ownership_bulk_${suffix}_${index}`;
      const epochId = `epoch_bulk_${suffix}_${index}`;
      await env.DB!.batch([
        env
          .DB!.prepare(
            `INSERT INTO identity_ownership
             (id, identity_type, normalized_identity_key, points_user_id, status,
              current_ownership_epoch_id, verified_at, next_verification_at, permanent_correspondence)
           VALUES (?, 'WEB_URL', ?, ?, 'ACTIVE', ?, ?, ?, 0)`,
          )
          .bind(
            ownershipId,
            `https://bulk-${index}.example.net/${suffix}`,
            user.pointsUserId,
            epochId,
            due - 30 * 86_400_000,
            due,
          ),
        env
          .DB!.prepare(
            `INSERT INTO ownership_epoch
             (id, identity_ownership_id, owner_points_user_id, effective_at,
              verification_method, evidence_hash, success_count, request_id, created_at)
           VALUES (?, ?, ?, ?, 'WEB_LINK', ?, 1, ?, ?)`,
          )
          .bind(
            epochId,
            ownershipId,
            user.pointsUserId,
            due - 30 * 86_400_000,
            "e".repeat(64),
            `req-${suffix}-${index}`,
            due - 30 * 86_400_000,
          ),
        env
          .DB!.prepare(
            `INSERT INTO ownership_revalidation_job
             (id, identity_ownership_id, ownership_epoch_id, verification_cycle_id,
              attempt, due_at, status)
           VALUES (?, ?, ?, ?, 1, ?, 'PENDING')`,
          )
          .bind(
            `job_bulk_${suffix}_${index}`,
            ownershipId,
            epochId,
            `cycle_bulk_${suffix}_${index}`,
            due,
          ),
      ]);
    }
    const fetcher: typeof fetch = async () =>
      new Response(
        `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
        { headers: { "Content-Type": "text/html" } },
      );
    const first = await runDueWebRevalidations(env.DB!, due, fetcher);
    const second = await runDueWebRevalidations(env.DB!, due, fetcher);
    expect(first.leased).toBe(50);
    expect(second.leased).toBe(1);
  });

  it("leases one due job only once across concurrent schedulers", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const due = Date.parse("2026-07-13T00:00:00Z");
    const response = await appFor(
      user.authUserId,
      async () =>
        new Response(
          `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
          { headers: { "Content-Type": "text/html" } },
        ),
    ).fetch(verificationRequest(`https://lease.example.net/${suffix}`), env);
    const data = ((await response.json()) as { data: { identityOwnershipId: string } }).data;
    await env
      .DB!.prepare(
        "UPDATE ownership_revalidation_job SET due_at = ? WHERE identity_ownership_id = ?",
      )
      .bind(due, data.identityOwnershipId)
      .run();
    const fetcher: typeof fetch = async () =>
      new Response(
        `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
        { headers: { "Content-Type": "text/html" } },
      );
    const results = await Promise.all([
      runDueWebRevalidations(env.DB!, due, fetcher),
      runDueWebRevalidations(env.DB!, due, fetcher),
    ]);
    expect(results[0]!.leased + results[1]!.leased).toBe(1);
  });

  it("does not lapse an ownership after a leased job was superseded by manual revalidation", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const due = Date.parse("2026-07-13T00:00:00Z");
    const url = `https://superseded-lease.example.net/${suffix}`;
    const proof = () =>
      new Response(
        `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
        { headers: { "Content-Type": "text/html" } },
      );
    const initial = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: async () => proof(),
        now: due - 30 * 86_400_000,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-initial`,
        url,
      },
    );
    await env
      .DB!.prepare(
        `UPDATE ownership_revalidation_job
         SET attempt = 3, cycle_started_at = ?, due_at = ?
         WHERE identity_ownership_id = ? AND status = 'PENDING'`,
      )
      .bind(due - 7 * 86_400_000, due, initial.identityOwnershipId)
      .run();

    await runDueWebRevalidations(env.DB!, due, async () => {
      await verifyWebOwnership(
        { DB: env.DB! },
        {
          fetchImpl: async () => proof(),
          now: due + 1,
          pointsUserId: user.pointsUserId,
          requestId: `req-${suffix}-manual`,
          url,
        },
      );
      throw new Error("stale cron result");
    });

    const ownership = await env
      .DB!.prepare(
        `SELECT ownership.status, epoch.ended_at AS endedAt
         FROM identity_ownership ownership
         JOIN ownership_epoch epoch ON epoch.id = ownership.current_ownership_epoch_id
         WHERE ownership.id = ?`,
      )
      .bind(initial.identityOwnershipId)
      .first<{ endedAt: number | null; status: string }>();
    expect(ownership).toEqual({ endedAt: null, status: "ACTIVE" });
  });

  it("does not reactivate a lapsed epoch when ownership changes after the manual revalidation read", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const now = Date.parse("2026-07-13T00:00:00Z");
    const url = `https://manual-cas.example.net/${suffix}`;
    const proof = () =>
      new Response(
        `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
        { headers: { "Content-Type": "text/html" } },
      );
    const initial = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: async () => proof(),
        now: now - 30 * 86_400_000,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-initial`,
        url,
      },
    );
    let changedAfterRead = false;
    const wrapStatement = (
      statement: D1PreparedStatement,
      interceptFirst: boolean,
    ): D1PreparedStatement =>
      new Proxy(statement, {
        get(target, property) {
          if (property === "bind") {
            return (...values: unknown[]) => wrapStatement(target.bind(...values), interceptFirst);
          }
          if (property === "first" && interceptFirst) {
            return async <T>() => {
              const row = await target.first<T>();
              if (!changedAfterRead) {
                changedAfterRead = true;
                await env.DB!.batch([
                  env
                    .DB!.prepare(
                      "UPDATE identity_ownership SET status = 'REVERIFYING' WHERE id = ?",
                    )
                    .bind(initial.identityOwnershipId),
                  env
                    .DB!.prepare(
                      "UPDATE ownership_epoch SET ended_at = ? WHERE id = ? AND ended_at IS NULL",
                    )
                    .bind(now, initial.ownershipEpochId),
                  env
                    .DB!.prepare(
                      "UPDATE identity_ownership SET status = 'LAPSED', next_verification_at = NULL WHERE id = ?",
                    )
                    .bind(initial.identityOwnershipId),
                ]);
              }
              return row;
            };
          }
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    const racingDb = new Proxy(env.DB!, {
      get(target, property) {
        if (property === "prepare") {
          return (query: string) =>
            wrapStatement(
              target.prepare(query),
              query.includes("FROM identity_ownership") &&
                query.includes("normalized_identity_key = ?"),
            );
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    await expect(
      verifyWebOwnership(
        { DB: racingDb },
        {
          fetchImpl: async () => proof(),
          now: now + 1,
          pointsUserId: user.pointsUserId,
          requestId: `req-${suffix}-manual`,
          url,
        },
      ),
    ).rejects.toMatchObject({ code: "WEB_OWNERSHIP_CHANGED" });
    const ownership = await env
      .DB!.prepare("SELECT status FROM identity_ownership WHERE id = ?")
      .bind(initial.identityOwnershipId)
      .first<{ status: string }>();
    expect(ownership?.status).toBe("LAPSED");
  });

  it("does not report success when ownership lapses between manual activation and job superseding", async () => {
    const suffix = crypto.randomUUID();
    const user = await createUser(suffix);
    const now = Date.parse("2026-07-13T00:00:00Z");
    const url = `https://manual-batch-cas.example.net/${suffix}`;
    const proof = () =>
      new Response(
        `<a href="https://points.freeism.app/profiles/${user.pointsUserId}">profile</a>`,
        { headers: { "Content-Type": "text/html" } },
      );
    const initial = await verifyWebOwnership(
      { DB: env.DB! },
      {
        fetchImpl: async () => proof(),
        now: now - 30 * 86_400_000,
        pointsUserId: user.pointsUserId,
        requestId: `req-${suffix}-initial`,
        url,
      },
    );
    let raced = false;
    const racingDb = new Proxy(env.DB!, {
      get(target, property) {
        if (property === "batch") {
          return async (statements: D1PreparedStatement[]) => {
            if (!raced) {
              raced = true;
              await env
                .DB!.prepare("UPDATE identity_ownership SET status = 'REVERIFYING' WHERE id = ?")
                .bind(initial.identityOwnershipId)
                .run();
              expect(
                await lapseWebOwnership(
                  env.DB!,
                  initial.identityOwnershipId,
                  initial.ownershipEpochId!,
                  now,
                ),
              ).toBe(true);
            }
            return target.batch(statements);
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    await expect(
      verifyWebOwnership(
        { DB: racingDb },
        {
          fetchImpl: async () => proof(),
          now: now + 1,
          pointsUserId: user.pointsUserId,
          requestId: `req-${suffix}-manual`,
          url,
        },
      ),
    ).rejects.toMatchObject({ code: "WEB_OWNERSHIP_CHANGED" });
    const ownership = await env
      .DB!.prepare("SELECT status FROM identity_ownership WHERE id = ?")
      .bind(initial.identityOwnershipId)
      .first<{ status: string }>();
    expect(ownership?.status).toBe("LAPSED");
  });
});
