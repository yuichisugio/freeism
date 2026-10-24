import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { seedPointsProvider, testPointsProviderId } from "../fixtures/points-provider";

import {
  commitAuctionImport,
  type CommitAuctionImportDependencies,
} from "../../src/backend/auction/import/commit-auction-import";
import {
  calculateAuctionCommandIdentity,
  type AuctionImportPreview,
} from "../../src/backend/auction/import/validate-auction-import";
import { D1AuctionRepository } from "../../src/backend/db/d1-auction-repository";
import type { MarketsActor } from "../../src/backend/http/context";

const authUserId = `auth-commit-${crypto.randomUUID()}`;
const marketsUserId = `musr_commit_${crypto.randomUUID()}`;
const actor: MarketsActor = {
  accountId: `google-${authUserId}`,
  marketsUserId,
  providerId: "google",
};
const now = new Date("2030-01-01T00:00:00.000Z");
const hash = `sha256:${"a".repeat(64)}`;

const snapshot = {
  pointPackageId: "pp_1",
  pointPackageRevisionId: "ppr_1",
  status: "ACTIVE" as const,
  name: "Package one",
  description: null,
  relatedUrl: null,
  totalWeight: 1,
  packageTick: 1,
  contentHash: hash,
  components: [
    {
      evaluationCriterionId: "criterion_1",
      evaluationCriterionRevisionId: "criterion_revision_1",
      name: "Criterion one",
      displayOrder: 0,
      weight: 1,
      minimumUnitScaled: 1,
      buyNowEnabled: true,
    },
  ],
};

async function preview(title = "Auction one"): Promise<AuctionImportPreview> {
  const result: AuctionImportPreview = {
    providerId: testPointsProviderId,
    fileHash: `sha256:${"b".repeat(64)}`,
    auctionCommandId: "",
    auctionCommandHash: "",
    rows: [
      {
        clientRowId: "row-1",
        title,
        description: "Description",
        externalUrl: "https://example.test/item",
        pointPackageId: "pp_1",
        pointPackageRevisionId: "ppr_1",
        quantity: 1,
        startsAt: "2030-01-02T00:00:00.000Z",
        endsAt: "2030-01-03T00:00:00.000Z",
        buyNowPriceTickCount: 10,
        extensionThresholdSeconds: null,
        extensionDurationSeconds: null,
        maxExtensions: null,
        eligible: true,
        packageEligibilityVersion: 1,
        packageSnapshot: snapshot,
      },
    ],
  };
  const {
    eligible: _eligible,
    packageEligibilityVersion: _version,
    ...commandRow
  } = result.rows[0]!;
  return {
    ...result,
    ...(await calculateAuctionCommandIdentity([commandRow], testPointsProviderId)),
  };
}

function dependencies(
  overrides: Partial<CommitAuctionImportDependencies> = {},
): CommitAuctionImportDependencies {
  return {
    repository: new D1AuctionRepository(env.DB!),
    pointsIssuer: "https://points.example.test/api/auth",
    now: () => now,
    refreshPackage: async () => snapshot,
    checkEligibility: async (request) => ({
      data: {
        pointPackageAuctionEligibilityReceiptId: "receipt_1",
        auctionCommandId: request.auctionCommandId,
        auctionCommandHash: request.auctionCommandHash,
        items: request.items.map((item) => ({ ...item, packageEligibilityVersion: 2 })),
        checkedAt: now.toISOString(),
        validUntil: new Date(now.getTime() + 60_000).toISOString(),
      },
    }),
    scheduleAuction: vi.fn(async () => undefined),
    ...overrides,
  };
}

beforeAll(async () => {
  await seedPointsProvider(env.DB!);
  await env.DB!.batch([
    env
      .DB!.prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)")
      .bind(authUserId, "Commit user", `${authUserId}@example.test`),
    env
      .DB!.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)")
      .bind(marketsUserId, authUserId),
    env
      .DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, 'google', ?, 1)",
      )
      .bind(`account-${authUserId}`, actor.accountId, authUserId),
  ]);
});

describe("Auction import commit", () => {
  it("creates the scheduled auction, immutable revision and snapshots in one commit", async () => {
    const deps = dependencies();

    const result = await commitAuctionImport(
      {
        actor,
        providerId: testPointsProviderId,
        idempotencyKey: `commit-${crypto.randomUUID()}`,
        preview: await preview(),
        sellerIdentitySnapshot: actor,
      },
      deps,
    );

    expect(result.auctions).toHaveLength(1);
    const auction = await env
      .DB!.prepare(
        "SELECT status, version, current_revision_id AS currentRevisionId FROM auctions WHERE id = ?",
      )
      .bind(result.auctions[0]!.auctionId)
      .first<{ status: string; version: number; currentRevisionId: string }>();
    expect(auction).toMatchObject({ status: "SCHEDULED", version: 1 });
    expect(auction?.currentRevisionId).toBe(result.auctions[0]!.revisionId);
    expect(
      await env
        .DB!.prepare("SELECT COUNT(*) AS count FROM auction_revisions WHERE auction_id = ?")
        .bind(result.auctions[0]!.auctionId)
        .first<{ count: number }>("count"),
    ).toBe(1);
    expect(
      await env
        .DB!.prepare("SELECT COUNT(*) AS count FROM point_package_snapshot_components")
        .first<number>("count"),
    ).toBeGreaterThanOrEqual(1);
    expect(deps.scheduleAuction).toHaveBeenCalledWith(
      result.auctions[0]!.auctionId,
      result.auctions[0]!.revisionId,
      "2030-01-02T00:00:00.000Z",
    );
  });

  it("replays the same key and rejects a changed payload", async () => {
    const checkEligibility = vi.fn(dependencies().checkEligibility);
    const deps = dependencies({ checkEligibility });
    const idempotencyKey = `replay-${crypto.randomUUID()}`;
    const input = {
      actor,
      providerId: testPointsProviderId,
      idempotencyKey,
      preview: await preview(),
      sellerIdentitySnapshot: actor,
    };

    const first = await commitAuctionImport(input, deps);
    const replay = await commitAuctionImport(input, deps);

    expect(replay).toEqual(first);
    expect(checkEligibility).toHaveBeenCalledTimes(1);
    await expect(
      commitAuctionImport({ ...input, preview: await preview("Changed") }, deps),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("writes nothing when the package changed or the receipt is expired", async () => {
    const changed = dependencies({
      refreshPackage: async () => ({ ...snapshot, contentHash: `sha256:${"d".repeat(64)}` }),
    });
    const before = await env
      .DB!.prepare("SELECT COUNT(*) AS count FROM auctions")
      .first<number>("count");
    await expect(
      commitAuctionImport(
        {
          actor,
          providerId: testPointsProviderId,
          idempotencyKey: `changed-${crypto.randomUUID()}`,
          preview: await preview(),
          sellerIdentitySnapshot: actor,
        },
        changed,
      ),
    ).rejects.toMatchObject({ code: "POINT_PACKAGE_REVISION_CHANGED" });

    const expiredBase = dependencies();
    const expired = dependencies({
      checkEligibility: async (request) => ({
        data: {
          ...(await expiredBase.checkEligibility(request, "expired")).data,
          validUntil: now.toISOString(),
        },
      }),
    });
    await expect(
      commitAuctionImport(
        {
          actor,
          providerId: testPointsProviderId,
          idempotencyKey: `expired-${crypto.randomUUID()}`,
          preview: await preview(),
          sellerIdentitySnapshot: actor,
        },
        expired,
      ),
    ).rejects.toMatchObject({ code: "POINTS_ELIGIBILITY_RECEIPT_EXPIRED" });
    expect(
      await env.DB!.prepare("SELECT COUNT(*) AS count FROM auctions").first<number>("count"),
    ).toBe(before);
  });

  it.each([
    ["empty title", { title: "" }],
    ["http URL", { externalUrl: "http://example.test/item" }],
    ["reversed dates", { endsAt: "2030-01-01T00:00:00.000Z" }],
  ])("revalidates client preview fields: %s", async (_label, mutation) => {
    const original = await preview();
    const candidate = { ...original, rows: [{ ...original.rows[0]!, ...mutation }] };
    const checkEligibility = vi.fn(dependencies().checkEligibility);

    await expect(
      commitAuctionImport(
        {
          actor,
          providerId: testPointsProviderId,
          idempotencyKey: `invalid-${crypto.randomUUID()}`,
          preview: candidate,
          sellerIdentitySnapshot: actor,
        },
        dependencies({ checkEligibility }),
      ),
    ).rejects.toMatchObject({ code: "AUCTION_IMPORT_VALIDATION_FAILED" });
    expect(checkEligibility).not.toHaveBeenCalled();
  });

  it("rejects a valid field replacement when the preview command identity is unchanged", async () => {
    const original = await preview();
    const candidate = {
      ...original,
      rows: [{ ...original.rows[0]!, title: "A different valid auction title" }],
    };
    const checkEligibility = vi.fn(dependencies().checkEligibility);
    const before = await env
      .DB!.prepare("SELECT COUNT(*) AS count FROM auctions")
      .first<number>("count");

    await expect(
      commitAuctionImport(
        {
          actor,
          providerId: testPointsProviderId,
          idempotencyKey: `command-changed-${crypto.randomUUID()}`,
          preview: candidate,
          sellerIdentitySnapshot: actor,
        },
        dependencies({ checkEligibility }),
      ),
    ).rejects.toMatchObject({ code: "AUCTION_COMMAND_CHANGED" });
    expect(checkEligibility).not.toHaveBeenCalled();
    expect(
      await env.DB!.prepare("SELECT COUNT(*) AS count FROM auctions").first<number>("count"),
    ).toBe(before);
  });
});
