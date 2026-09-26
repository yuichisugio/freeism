import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import type {
  CreateAccountsRecipientResolver,
  RecipientResolution,
} from "../../src/backend/identity/accounts-recipient-resolver";
import { claimUnclaimedFixes } from "../../src/backend/usecases/claim-unclaimed-fixes";
import { commitFixCsv } from "../../src/backend/usecases/commit-fix-csv";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { previewUnclaimedFixes } from "../../src/backend/usecases/preview-unclaimed-fixes";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";
import { validateFixCsv } from "../../src/backend/usecases/validate-fix-csv";
import {
  createFakeAccountsNetwork,
  importTestKek,
  seedActiveAccountsConnection,
  seedPointsUser,
  type TestPointsUser,
} from "../support/accounts-worker-setup";
import { createFakeAccounts, type FakeAccounts } from "../support/fake-accounts";

const FIX_HEADER =
  "fixResultId,expectedRevision,recipientProfileUrl,recipientAccountsUserId,evaluationCriterionId,amount,evaluationAt,managementId,memo";

// --------------------------------------------------
// fixtures
// --------------------------------------------------

/** URL ごとの照合結果を返す fake の接続先。未登録の URL は no_match にする。 */
function fakeAccounts(
  accountsOrigin: string,
  results: Record<string, RecipientResolution>,
): CreateAccountsRecipientResolver {
  return () => async (identifiers) => ({
    accountsOrigin,
    results: identifiers.map(({ value }) => results[value] ?? { status: "no_match" }),
  });
}

async function createUser(suffix: string) {
  const authUserId = `claim-auth-${suffix}`;
  const now = Date.now();
  await env
    .DB!.prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(authUserId, authUserId, `${authUserId}@example.invalid`, now, now)
    .run();
  return provisionPointsUser(env.DB!, authUserId, () => `pusr_${suffix}`);
}

async function createCriterion(actorPointsUserId: string, suffix: string) {
  const id = `criterion_${suffix}`;
  await importEvaluationCriteria(env.DB!, {
    actorPointsUserId,
    items: [
      {
        balanceVisibleByDefault: false,
        buyNowEnabled: true,
        description: "Unclaimed claim test",
        evaluationCriterionId: id,
        exchangeEnabled: true,
        expectedRevision: null,
        minimumUnit: "0.0001",
        name: `Claim ${suffix.slice(-12)}`,
        relatedUrls: [],
        status: "ACTIVE",
        transferEnabled: true,
      },
    ],
    reason: "Unclaimed claim test",
  });
  return id;
}

/** 誰にも照合されない状態で FIX を取り込み、未受領エントリーを作る。 */
async function commitUnclaimed(actorPointsUserId: string, accountsOrigin: string, csv: string) {
  return commitFix(actorPointsUserId, fakeAccounts(accountsOrigin, {}), csv);
}

/** 指定した照合結果で FIX を検証して取り込む。 */
async function commitFix(
  actorPointsUserId: string,
  createResolver: CreateAccountsRecipientResolver,
  csv: string,
) {
  const bytes = new TextEncoder().encode(csv);
  const accountsConnectionId = "acon_unused";
  const validated = await validateFixCsv(env.DB!, bytes, { accountsConnectionId, createResolver });
  if (validated.status !== "VALID") throw new Error(`FIX CSV is ${validated.status}`);
  return commitFixCsv(env.DB!, bytes, {
    accountsConnectionId,
    actorPointsUserId,
    createResolver,
    expectedValidationHash: validated.validationHash,
    idempotencyKey: `fix-${crypto.randomUUID()}`,
    reason: "unclaimed FIX",
  });
}

async function seedAccountsLink(pointsUserId: string, accountsOrigin: string, suffix: string) {
  const now = Date.now();
  const accountsLinkId = `alnk_${suffix}`;
  await env.DB!.batch([
    env
      .DB!.prepare(
        `INSERT INTO accounts_connections
           (id, accounts_origin, display_name, client_id, status, client_key_id,
            client_public_jwk, client_private_jwk_ciphertext, dpop_private_jwk_ciphertext,
            created_by_points_user_id, created_at, activated_at)
         VALUES (?, ?, 'Accounts', 'client', 'ACTIVE', 'kid', '{}', 'v1.a.b', 'v1.c.d', ?, ?, ?)`,
      )
      .bind(`acon_${suffix}`, accountsOrigin, pointsUserId, now, now),
    env
      .DB!.prepare(
        `INSERT INTO accounts_links
           (id, points_user_id, accounts_connection_id, accounts_origin, accounts_user_id, linked_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(accountsLinkId, pointsUserId, `acon_${suffix}`, accountsOrigin, `ausr_${suffix}`, now),
  ]);
  return { accountsLinkId, accountsUserId: `ausr_${suffix}` };
}

async function readBalance(pointsUserId: string, evaluationCriterionId: string) {
  const account = await env
    .DB!.prepare(
      "SELECT balance FROM point_account WHERE points_user_id = ? AND evaluation_criterion_id = ?",
    )
    .bind(pointsUserId, evaluationCriterionId)
    .first<{ balance: number }>();
  return account?.balance ?? 0;
}

/** 連携の未受領 FIX を preview し、そのまま一括受領する。 */
async function claimAll(
  pointsUserId: string,
  accountsLinkId: string,
  createResolver: CreateAccountsRecipientResolver,
) {
  const preview = await previewUnclaimedFixes(env.DB!, {
    accountsLinkId,
    createResolver,
    pointsUserId,
  });
  await claimUnclaimedFixes(env.DB!, {
    accountsLinkId,
    claimSetHash: preview.claimSetHash,
    createResolver,
    idempotencyKey: `claim-${crypto.randomUUID()}`,
    now: new Date(),
    pointsUserId,
    requestId: `req_${crypto.randomUUID()}`,
  });
  return preview;
}

async function setup() {
  const suffix = crypto.randomUUID();
  const accountsOrigin = `https://accounts-${suffix.slice(0, 8)}.test`;
  const pointsUser = await createUser(suffix);
  const criterionId = await createCriterion(pointsUser.id, suffix);
  const aliceUrl = `https://example.com/alice-${suffix}`;
  const bobUrl = `https://example.com/bob-${suffix}`;
  await commitUnclaimed(
    pointsUser.id,
    accountsOrigin,
    [
      FIX_HEADER,
      `,,${aliceUrl},,${criterionId},3,2026-07,,alice-positive`,
      `,,${bobUrl},,${criterionId},5,2026-07,,bob`,
    ].join("\n"),
  );
  const link = await seedAccountsLink(pointsUser.id, accountsOrigin, suffix);
  return { accountsOrigin, aliceUrl, bobUrl, criterionId, link, pointsUser, suffix };
}

// --------------------------------------------------
// tests
// --------------------------------------------------

describe("unclaimed FIX claim", () => {
  it("claims only entries that Accounts currently resolves to the linked Accounts user", async () => {
    const { accountsOrigin, aliceUrl, bobUrl, criterionId, link, pointsUser } = await setup();
    const createResolver = fakeAccounts(accountsOrigin, {
      [aliceUrl]: { accountsUserId: link.accountsUserId, status: "matched" },
      [bobUrl]: { accountsUserId: "ausr_someone_else", status: "matched" },
    });

    const preview = await previewUnclaimedFixes(env.DB!, {
      accountsLinkId: link.accountsLinkId,
      createResolver,
      pointsUserId: pointsUser.id,
    });
    expect(preview).toMatchObject({
      accountsLinkId: link.accountsLinkId,
      aggregates: [
        { evaluationCriterionId: criterionId, netAmountScaled: 30_000, positiveCount: 1 },
      ],
      totalCount: 1,
    });

    const input = {
      accountsLinkId: link.accountsLinkId,
      claimSetHash: preview.claimSetHash,
      createResolver,
      idempotencyKey: `claim-${crypto.randomUUID()}`,
      now: new Date(),
      pointsUserId: pointsUser.id,
      requestId: `req_${crypto.randomUUID()}`,
    };
    const claimed = await claimUnclaimedFixes(env.DB!, input);
    expect(claimed).toMatchObject({ responseBody: { data: { claimedCount: 1 } }, status: 201 });
    await expect(claimUnclaimedFixes(env.DB!, input)).resolves.toEqual(claimed);

    const account = await env
      .DB!.prepare(
        "SELECT balance FROM point_account WHERE points_user_id = ? AND evaluation_criterion_id = ?",
      )
      .bind(pointsUser.id, criterionId)
      .first<{ balance: number }>();
    expect(account?.balance).toBe(30_000);
    const claim = await env
      .DB!.prepare(
        `SELECT accounts_origin AS accountsOrigin, accounts_user_id AS accountsUserId
         FROM fix_claim WHERE points_user_id = ?`,
      )
      .bind(pointsUser.id)
      .first();
    expect(claim).toEqual({ accountsOrigin, accountsUserId: link.accountsUserId });
    const audit = await env
      .DB!.prepare(
        `SELECT target, reason FROM audit_event
         WHERE actor_points_user_id = ? AND action = 'UNCLAIMED_FIX_CLAIM'`,
      )
      .bind(pointsUser.id)
      .all();
    expect(audit.results).toEqual([{ reason: "claimedCount=1", target: link.accountsLinkId }]);
    await expect(
      previewUnclaimedFixes(env.DB!, {
        accountsLinkId: link.accountsLinkId,
        createResolver,
        pointsUserId: pointsUser.id,
      }),
    ).resolves.toMatchObject({ totalCount: 0 });
  });

  it("rejects confirm when the current Accounts resolution differs from the preview", async () => {
    const { accountsOrigin, aliceUrl, link, pointsUser } = await setup();
    const preview = await previewUnclaimedFixes(env.DB!, {
      accountsLinkId: link.accountsLinkId,
      createResolver: fakeAccounts(accountsOrigin, {
        [aliceUrl]: { accountsUserId: link.accountsUserId, status: "matched" },
      }),
      pointsUserId: pointsUser.id,
    });

    await expect(
      claimUnclaimedFixes(env.DB!, {
        accountsLinkId: link.accountsLinkId,
        claimSetHash: preview.claimSetHash,
        createResolver: fakeAccounts(accountsOrigin, {}),
        idempotencyKey: `claim-${crypto.randomUUID()}`,
        now: new Date(),
        pointsUserId: pointsUser.id,
        requestId: `req_${crypto.randomUUID()}`,
      }),
    ).rejects.toThrow("CLAIM_SET_CHANGED");
  });

  it("does not let another Points user claim through someone else's link", async () => {
    const { accountsOrigin, link, suffix } = await setup();
    const other = await createUser(`${suffix}-other`);

    await expect(
      previewUnclaimedFixes(env.DB!, {
        accountsLinkId: link.accountsLinkId,
        createResolver: fakeAccounts(accountsOrigin, {}),
        pointsUserId: other.id,
      }),
    ).rejects.toThrow("ACCOUNTS_LINK_NOT_FOUND");
  });
});

// --------------------------------------------------
// 経路（テスト用 Accounts）
// --------------------------------------------------

const network = createFakeAccountsNetwork();

/**
 * テスト用 Accounts と ACTIVE の接続先、未受領 FIX、受領者の連携を作る。
 * alice の URL は受領者の Accounts ユーザーに、bob の URL は別の Accounts ユーザーに照合される。
 */
async function setupWithAccounts() {
  const suffix = crypto.randomUUID();
  const accounts: FakeAccounts = network.add(
    await createFakeAccounts({ origin: `https://accounts-${suffix.slice(0, 8)}.test` }),
  );
  const admin = await seedPointsUser(env.DB!, { admin: true });
  const { connectionId } = await seedActiveAccountsConnection(env.DB!, {
    kek: await importTestKek(env),
    accounts,
    actorPointsUserId: admin.pointsUserId,
  });
  const criterionId = await createCriterion(admin.pointsUserId, suffix);
  const aliceUrl = `https://example.com/alice-${suffix}`;
  const bobUrl = `https://example.com/bob-${suffix}`;
  await commitUnclaimed(
    admin.pointsUserId,
    accounts.origin,
    [
      FIX_HEADER,
      `,,${aliceUrl},,${criterionId},3,2026-07,,alice`,
      `,,${aliceUrl},,${criterionId},-1,2026-08,,alice-negative`,
      `,,${bobUrl},,${criterionId},5,2026-07,,bob`,
    ].join("\n"),
  );
  const claimant = await seedPointsUser(env.DB!);
  const accountsUserId = `ausr_${suffix}`;
  const accountsLinkId = `alnk_${suffix}`;
  await env
    .DB!.prepare(
      `INSERT INTO accounts_links
         (id, points_user_id, accounts_connection_id, accounts_origin, accounts_user_id, linked_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      accountsLinkId,
      claimant.pointsUserId,
      connectionId,
      accounts.origin,
      accountsUserId,
      Date.now(),
    )
    .run();
  accounts.setResolve((identifier) => {
    const { url } = identifier as { url?: string };
    if (url === aliceUrl) return { status: "matched", accountsUserId };
    if (url === bobUrl) return { status: "matched", accountsUserId: "ausr_someone_else" };
    return { status: "no_match" };
  });
  return { accounts, accountsLinkId, claimant, criterionId };
}

/** 受領者の session で要求を送る。 */
function createClaimantClient(user: TestPointsUser) {
  const app = createPointsBackendApp({
    accountsFetch: network.fetch,
    getSession: async () => ({
      session: { createdAt: new Date(), id: user.sessionId, userId: user.authUserId },
      user: { id: user.authUserId },
    }),
  });
  return (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    app.fetch(
      new Request(`https://points.test${path}`, {
        method,
        headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
}

function countResolveRequests(accounts: FakeAccounts): number {
  return accounts.requests.filter(
    (request) => new URL(request.url).pathname === "/api/v1/identities/resolve",
  ).length;
}

async function countClaims(pointsUserId: string): Promise<number> {
  const row = await env
    .DB!.prepare("SELECT count(*) AS count FROM fix_claim WHERE points_user_id = ?")
    .bind(pointsUserId)
    .first<{ count: number }>();
  return row!.count;
}

describe("unclaimed FIX claim routes", () => {
  it("previews and claims the entries Accounts currently resolves to the link", async () => {
    const { accounts, accountsLinkId, claimant, criterionId } = await setupWithAccounts();
    const request = createClaimantClient(claimant);

    const previewResponse = await request(
      "GET",
      `/api/unclaimed-fixes/claim-preview?accountsLinkId=${encodeURIComponent(accountsLinkId)}`,
    );
    expect(previewResponse.status).toBe(200);
    const { data: preview } = (await previewResponse.json()) as {
      data: { claimSetHash: string; totalCount: number };
    };
    expect(preview).toMatchObject({
      accountsLinkId,
      aggregates: [
        {
          evaluationCriterionId: criterionId,
          negativeCount: 1,
          netAmountScaled: 20_000,
          positiveCount: 1,
          totalCount: 2,
        },
      ],
      totalCount: 2,
    });
    expect(countResolveRequests(accounts)).toBe(1);

    const claimed = await request(
      "POST",
      "/api/unclaimed-fixes/claims",
      { accountsLinkId, claimSetHash: preview.claimSetHash },
      { "Idempotency-Key": `claim-${crypto.randomUUID()}` },
    );
    expect(claimed.status).toBe(201);
    await expect(claimed.json()).resolves.toMatchObject({
      data: { claimedCount: 2, claimSetHash: preview.claimSetHash },
    });
    expect(countResolveRequests(accounts)).toBe(2);
    expect(await countClaims(claimant.pointsUserId)).toBe(1);
  });

  it("returns the latest preview with 409 when the resolution changed after preview", async () => {
    const { accounts, accountsLinkId, claimant } = await setupWithAccounts();
    const request = createClaimantClient(claimant);
    const previewResponse = await request(
      "GET",
      `/api/unclaimed-fixes/claim-preview?accountsLinkId=${encodeURIComponent(accountsLinkId)}`,
    );
    const { data: preview } = (await previewResponse.json()) as {
      data: { claimSetHash: string };
    };
    accounts.setResolve(() => ({ status: "no_match" }));

    const claimed = await request(
      "POST",
      "/api/unclaimed-fixes/claims",
      { accountsLinkId, claimSetHash: preview.claimSetHash },
      { "Idempotency-Key": `claim-${crypto.randomUUID()}` },
    );
    expect(claimed.status).toBe(409);
    await expect(claimed.json()).resolves.toMatchObject({
      code: "CLAIM_SET_CHANGED",
      data: { accountsLinkId, aggregates: [], totalCount: 0 },
    });
    expect(await countClaims(claimant.pointsUserId)).toBe(0);
  });

  it("returns 503 ACCOUNTS_UNAVAILABLE with Retry-After and claims nothing when Accounts fails", async () => {
    const { accounts, accountsLinkId, claimant } = await setupWithAccounts();
    const request = createClaimantClient(claimant);
    const previewResponse = await request(
      "GET",
      `/api/unclaimed-fixes/claim-preview?accountsLinkId=${encodeURIComponent(accountsLinkId)}`,
    );
    const { data: preview } = (await previewResponse.json()) as {
      data: { claimSetHash: string };
    };

    accounts.interceptNext(
      "/api/v1/identities/resolve",
      new Response(null, { status: 429, headers: { "Retry-After": "30" } }),
    );
    const limited = await request(
      "GET",
      `/api/unclaimed-fixes/claim-preview?accountsLinkId=${encodeURIComponent(accountsLinkId)}`,
    );
    expect(limited.status).toBe(503);
    expect(limited.headers.get("Retry-After")).toBe("30");
    await expect(limited.json()).resolves.toMatchObject({ code: "ACCOUNTS_UNAVAILABLE" });

    accounts.interceptNext("/api/v1/identities/resolve", "network");
    const claimed = await request(
      "POST",
      "/api/unclaimed-fixes/claims",
      { accountsLinkId, claimSetHash: preview.claimSetHash },
      { "Idempotency-Key": `claim-${crypto.randomUUID()}` },
    );
    expect(claimed.status).toBe(503);
    expect(claimed.headers.get("Retry-After")).toBeNull();
    await expect(claimed.json()).resolves.toMatchObject({ code: "ACCOUNTS_UNAVAILABLE" });
    expect(await countClaims(claimant.pointsUserId)).toBe(0);
  });

  it("claims once when two confirms with different Idempotency-Keys run concurrently", async () => {
    const { accountsLinkId, claimant } = await setupWithAccounts();
    const request = createClaimantClient(claimant);
    const previewResponse = await request(
      "GET",
      `/api/unclaimed-fixes/claim-preview?accountsLinkId=${encodeURIComponent(accountsLinkId)}`,
    );
    const { data: preview } = (await previewResponse.json()) as {
      data: { claimSetHash: string };
    };

    const confirm = () =>
      request(
        "POST",
        "/api/unclaimed-fixes/claims",
        { accountsLinkId, claimSetHash: preview.claimSetHash },
        { "Idempotency-Key": `claim-${crypto.randomUUID()}` },
      );
    const responses = await Promise.all([confirm(), confirm()]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const conflict = responses.find(({ status }) => status === 409)!;
    await expect(conflict.json()).resolves.toMatchObject({
      code: "CLAIM_SET_CHANGED",
      data: { totalCount: 0 },
    });
    expect(await countClaims(claimant.pointsUserId)).toBe(1);
  });

  it("rejects a link owned by another Points user and an invalid claim body", async () => {
    const { accountsLinkId } = await setupWithAccounts();
    const request = createClaimantClient(await seedPointsUser(env.DB!));

    const preview = await request(
      "GET",
      `/api/unclaimed-fixes/claim-preview?accountsLinkId=${encodeURIComponent(accountsLinkId)}`,
    );
    expect(preview.status).toBe(404);
    await expect(preview.json()).resolves.toMatchObject({ code: "ACCOUNTS_LINK_NOT_FOUND" });

    const invalid = await request(
      "POST",
      "/api/unclaimed-fixes/claims",
      { accountsLinkId, claimSetHash: "not-a-hash" },
      { "Idempotency-Key": `claim-${crypto.randomUUID()}` },
    );
    expect(invalid.status).toBe(422);
    await expect(invalid.json()).resolves.toMatchObject({ code: "CLAIM_BODY_INVALID" });
  });

  it("previews an empty reopen set without asking Accounts after close released every link", async () => {
    const { accounts, claimant } = await setupWithAccounts();
    const request = createClaimantClient(claimant);
    const closed = await request("POST", "/api/account/close", undefined, {
      "Idempotency-Key": `close-${crypto.randomUUID()}`,
    });
    expect(closed.status).toBe(200);

    const preview = await request("GET", "/api/account/reopen-preview");
    expect(preview.status).toBe(200);
    await expect(preview.json()).resolves.toMatchObject({
      data: { aggregates: [], totalCount: 0 },
    });
    expect(countResolveRequests(accounts)).toBe(0);
  });

  it("returns 503 on reopen preview when Accounts fails for a remaining link", async () => {
    const { accounts, claimant } = await setupWithAccounts();
    await env
      .DB!.prepare("UPDATE points_user SET account_status = 'CLOSED' WHERE id = ?")
      .bind(claimant.pointsUserId)
      .run();
    accounts.interceptNext(
      "/api/v1/identities/resolve",
      new Response(null, { status: 429, headers: { "Retry-After": "12" } }),
    );

    const preview = await createClaimantClient(claimant)("GET", "/api/account/reopen-preview");
    expect(preview.status).toBe(503);
    expect(preview.headers.get("Retry-After")).toBe("12");
    await expect(preview.json()).resolves.toMatchObject({ code: "ACCOUNTS_UNAVAILABLE" });
  });
});

// --------------------------------------------------
// 接続先ごとの未受領エントリー
// --------------------------------------------------

describe("unclaimed FIX entries per Accounts origin", () => {
  it("keeps both entries when a correction moves an Accounts user ID to another Accounts origin", async () => {
    const suffix = crypto.randomUUID();
    const actor = await createUser(suffix);
    const criterionId = await createCriterion(actor.id, suffix);
    const originA = `https://accounts-a-${suffix.slice(0, 8)}.test`;
    const originB = `https://accounts-b-${suffix.slice(0, 8)}.test`;
    const accountsUserId = `ausr_shared_${suffix}`;
    const first = await commitUnclaimed(
      actor.id,
      originA,
      [FIX_HEADER, `,,,${accountsUserId},${criterionId},3,2026-07,,first`].join("\n"),
    );
    const { fixResultId } = first.results[0]!;

    const corrected = await commitUnclaimed(
      actor.id,
      originB,
      [FIX_HEADER, `${fixResultId},1,,${accountsUserId},${criterionId},5,2026-07,,moved`].join(
        "\n",
      ),
    );

    const entries = await env
      .DB!.prepare(
        `SELECT accounts_origin AS accountsOrigin, delta_amount_scaled AS deltaAmountScaled
         FROM unclaimed_fix_entry WHERE source_fix_revision_id = ?
         ORDER BY accounts_origin`,
      )
      .bind(corrected.results[0]!.fixRevisionId)
      .all();
    expect(entries.results).toEqual([
      { accountsOrigin: originA, deltaAmountScaled: -30_000 },
      { accountsOrigin: originB, deltaAmountScaled: 50_000 },
    ]);
  });

  it("sums to the latest revision per origin when a correction moves a profile URL to another Accounts origin", async () => {
    const suffix = crypto.randomUUID();
    const actor = await createUser(suffix);
    const criterionId = await createCriterion(actor.id, suffix);
    const originA = `https://accounts-a-${suffix.slice(0, 8)}.test`;
    const originB = `https://accounts-b-${suffix.slice(0, 8)}.test`;
    const url = `https://example.com/moved-${suffix}`;
    const first = await commitUnclaimed(
      actor.id,
      originA,
      [FIX_HEADER, `,,${url},,${criterionId},10,2026-07,,first`].join("\n"),
    );
    const { fixResultId } = first.results[0]!;

    const corrected = await commitUnclaimed(
      actor.id,
      originB,
      [FIX_HEADER, `${fixResultId},1,${url},,${criterionId},3,2026-07,,moved`].join("\n"),
    );

    const entries = await env
      .DB!.prepare(
        `SELECT accounts_origin AS accountsOrigin, delta_amount_scaled AS deltaAmountScaled
         FROM unclaimed_fix_entry WHERE source_fix_revision_id = ?
         ORDER BY accounts_origin`,
      )
      .bind(corrected.results[0]!.fixRevisionId)
      .all();
    expect(entries.results).toEqual([
      { accountsOrigin: originA, deltaAmountScaled: -100_000 },
      { accountsOrigin: originB, deltaAmountScaled: 30_000 },
    ]);
    const holder = await createUser(`${suffix}-holder`);
    const link = await seedAccountsLink(holder.id, originB, `${suffix}-holder`);
    await claimAll(
      holder.id,
      link.accountsLinkId,
      fakeAccounts(originB, { [url]: { accountsUserId: link.accountsUserId, status: "matched" } }),
    );
    expect(await readBalance(holder.id, criterionId)).toBe(30_000);
  });
});

describe("FIX corrections before the recipient claims", () => {
  it("keeps a correction unclaimed while the earlier revision is still unclaimed", async () => {
    const suffix = crypto.randomUUID();
    const actor = await createUser(suffix);
    const criterionId = await createCriterion(actor.id, suffix);
    const accountsOrigin = `https://accounts-${suffix.slice(0, 8)}.test`;
    const url = `https://example.com/corrected-${suffix}`;
    const first = await commitUnclaimed(
      actor.id,
      accountsOrigin,
      [FIX_HEADER, `,,${url},,${criterionId},10,2026-07,,first`].join("\n"),
    );
    const { fixResultId } = first.results[0]!;
    const holder = await createUser(`${suffix}-holder`);
    const link = await seedAccountsLink(holder.id, accountsOrigin, `${suffix}-holder`);
    const createResolver = fakeAccounts(accountsOrigin, {
      [url]: { accountsUserId: link.accountsUserId, status: "matched" },
    });

    await commitFix(
      actor.id,
      createResolver,
      [FIX_HEADER, `${fixResultId},1,${url},,${criterionId},3,2026-07,,decreased`].join("\n"),
    );
    expect(await readBalance(holder.id, criterionId)).toBe(0);

    const preview = await claimAll(holder.id, link.accountsLinkId, createResolver);
    expect(preview.aggregates).toMatchObject([
      { evaluationCriterionId: criterionId, netAmountScaled: 30_000 },
    ]);
    expect(await readBalance(holder.id, criterionId)).toBe(30_000);

    await commitFix(
      actor.id,
      createResolver,
      [FIX_HEADER, `${fixResultId},2,${url},,${criterionId},5,2026-07,,increased`].join("\n"),
    );
    expect(await readBalance(holder.id, criterionId)).toBe(50_000);
  });
});
