import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

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
  const bytes = new TextEncoder().encode(csv);
  const createResolver = fakeAccounts(accountsOrigin, {});
  const accountsConnectionId = "acon_unused";
  const validated = await validateFixCsv(env.DB!, bytes, { accountsConnectionId, createResolver });
  if (validated.status !== "VALID") throw new Error(`FIX CSV is ${validated.status}`);
  await commitFixCsv(env.DB!, bytes, {
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
