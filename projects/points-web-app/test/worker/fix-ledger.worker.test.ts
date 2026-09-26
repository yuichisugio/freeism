import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import {
  generateAccountsSigningKey,
  toAccountsPublicJwks,
} from "../../src/backend/accounts/accounts-key-vault";
import { createPointsBackendApp } from "../../src/backend/app";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import {
  importTestKek,
  seedActiveAccountsConnection,
  seedPointsUser,
} from "../support/accounts-worker-setup";
import {
  createFakeAccounts,
  type FakeAccounts,
  type FakeResolveResult,
} from "../support/fake-accounts";

const db = env.DB!;

const FIX_HEADER =
  "fixResultId,expectedRevision,recipientProfileUrl,recipientAccountsUserId,evaluationCriterionId,amount,evaluationAt,managementId,memo";

// --------------------------------------------------
// 準備
// --------------------------------------------------

type ValidationBody = {
  data: {
    accountsConnectionId: string;
    accountsOrigin: string | null;
    accountsResolution:
      | { status: "COMPLETE" }
      | { status: "UNAVAILABLE"; code: string; retryAfter: string | null };
    rowCount: number;
    rows: { recipientLinked: boolean; resolution: string; row: number }[];
    validationHash: string | null;
  };
};

type CommitBody = {
  data: { results: { fixResultId: string; fixRevisionId: string; revision: number }[] };
};

async function createCriterion(actorPointsUserId: string) {
  const criterionId = `criterion_${crypto.randomUUID()}`;
  await importEvaluationCriteria(db, {
    actorPointsUserId,
    items: [
      {
        balanceVisibleByDefault: false,
        buyNowEnabled: true,
        description: "FIX test criterion",
        evaluationCriterionId: criterionId,
        exchangeEnabled: true,
        expectedRevision: null,
        minimumUnit: "0.0001",
        name: `FIX ${criterionId.slice(-12)}`,
        relatedUrls: [],
        status: "ACTIVE",
        transferEnabled: true,
      },
    ],
    reason: "FIX test",
  });
  return criterionId;
}

/**
 * ADMIN、評価軸、ACTIVE の接続先、テスト用 Accounts を作り、FIX CSV の要求関数を返す。
 */
async function setUp() {
  const accounts = await createFakeAccounts({
    origin: `https://accounts-${crypto.randomUUID().slice(0, 8)}.test`,
  });
  const kek = await importTestKek(env);
  const admin = await seedPointsUser(db, { admin: true });
  const { connectionId, clientId } = await seedActiveAccountsConnection(db, {
    kek,
    accounts,
    actorPointsUserId: admin.pointsUserId,
  });
  const criterionId = await createCriterion(admin.pointsUserId);
  const app = createPointsBackendApp({
    accountsFetch: accounts.fetch,
    getSession: async () => ({
      session: { createdAt: new Date(), id: admin.sessionId, userId: admin.authUserId },
      user: { id: admin.authUserId },
    }),
  });

  const requestCsv = (
    path: "validate" | "commit",
    csv: string,
    headers: Record<string, string> = {},
  ) =>
    app.fetch(
      new Request(`https://points.test/api/admin/fixes/csv/${path}`, {
        body: csv,
        headers: {
          "Content-Type": "text/csv",
          "X-Accounts-Connection-Id": connectionId,
          ...headers,
        },
        method: "POST",
      }),
      env,
    );

  /** validate の応答を読む。 */
  const validate = async (csv: string) => {
    const response = await requestCsv("validate", csv);
    expect(response.status).toBe(200);
    return ((await response.json()) as ValidationBody).data;
  };

  /** 検証した hash で commit する。 */
  const commit = (csv: string, validationHash: string, idempotencyKey = crypto.randomUUID()) =>
    requestCsv("commit", csv, {
      "Idempotency-Key": idempotencyKey,
      "X-Reason": "FIX test",
      "X-Validation-Hash": validationHash,
    });

  /** validate してから commit し、確定結果を返す。 */
  const validateAndCommit = async (csv: string) => {
    const { validationHash } = await validate(csv);
    const response = await commit(csv, validationHash!);
    expect(response.status).toBe(201);
    return ((await response.json()) as CommitBody).data.results;
  };

  return {
    accounts,
    admin,
    clientId,
    commit,
    connectionId,
    criterionId,
    requestCsv,
    validate,
    validateAndCommit,
  };
}

/**
 * 照合の入力（URL または Accounts ユーザー ID）ごとの結果を返す。
 * 登録していない入力は `no_match` にする。
 */
function resolveBy(results: Record<string, FakeResolveResult>) {
  return (identifier: unknown): FakeResolveResult => {
    const { url, accountsUserId } = identifier as { accountsUserId?: string; url?: string };
    return results[url ?? accountsUserId ?? ""] ?? { status: "no_match" };
  };
}

/** Accounts が受け取った照合要求の識別子。 */
function resolveRequests(accounts: FakeAccounts): unknown[][] {
  return accounts.requests
    .filter(({ url }) => url.endsWith("/api/v1/identities/resolve"))
    .map(({ body }) => (JSON.parse(body) as { identifiers: unknown[] }).identifiers);
}

/** Points ユーザーを作り、接続先の Accounts ユーザーと連携させる。 */
async function seedLinkedPointsUser(
  accounts: FakeAccounts,
  connectionId: string,
  accountsUserId: string,
) {
  const { pointsUserId } = await seedPointsUser(db);
  await db
    .prepare(
      `INSERT INTO accounts_links
         (id, points_user_id, accounts_connection_id, accounts_origin, accounts_user_id, linked_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      `alnk_${crypto.randomUUID()}`,
      pointsUserId,
      connectionId,
      accounts.origin,
      accountsUserId,
      Date.now(),
    )
    .run();
  return pointsUserId;
}

async function countFixRevisionsByReason(reason: string) {
  const row = await db
    .prepare("SELECT count(*) AS count FROM fix_revision WHERE reason = ?")
    .bind(reason)
    .first<{ count: number }>();
  return row!.count;
}

// --------------------------------------------------
// 接続先と CSV 列
// --------------------------------------------------

describe("FIX CSV の接続先と識別子列", () => {
  it("接続先の指定が無い場合と ACTIVE でない場合は照合しない", async () => {
    const { accounts, criterionId, requestCsv } = await setUp();
    const csv = `${FIX_HEADER}\n,,https://example.com/alice,,${criterionId},1,2026-07,,`;

    const withoutConnection = await requestCsv("validate", csv, {
      "X-Accounts-Connection-Id": "",
    });
    expect(withoutConnection.status).toBe(422);
    await expect(withoutConnection.json()).resolves.toMatchObject({
      code: "ACCOUNTS_CONNECTION_REQUIRED",
    });

    const inactive = await requestCsv("validate", csv, {
      "X-Accounts-Connection-Id": "acon_missing",
    });
    expect(inactive.status).toBe(409);
    await expect(inactive.json()).resolves.toMatchObject({
      code: "ACCOUNTS_CONNECTION_NOT_ACTIVE",
    });
    expect(resolveRequests(accounts)).toEqual([]);
  });

  it("識別子列はちょうど一方を必須とし、行エラーがあれば Accounts へ問い合わせない", async () => {
    const { accounts, criterionId, requestCsv } = await setUp();

    const response = await requestCsv(
      "validate",
      [
        FIX_HEADER,
        `,,,,${criterionId},1,2026-07,,`,
        `,,https://example.com/alice,ausr_alice,${criterionId},1,2026-07,,`,
      ].join("\n"),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "CSV_VALIDATION_FAILED",
      errors: [
        { code: "RECIPIENT_IDENTIFIER_REQUIRED", column: null, row: 2 },
        { code: "RECIPIENT_IDENTIFIER_AMBIGUOUS", column: null, row: 3 },
      ],
    });
    expect(resolveRequests(accounts)).toEqual([]);
  });

  it("Accounts が invalid_input を返した識別子は、その識別子の列の行エラーにする", async () => {
    const { accounts, criterionId, requestCsv } = await setUp();
    const invalid: FakeResolveResult = {
      status: "invalid_input",
      errors: [{ code: "INVALID_VALUE", message: "invalid", path: ["identifiers", 0] }],
    };
    accounts.setResolve(resolveBy({ "not-a-url": invalid, ausr_broken: invalid }));

    const response = await requestCsv(
      "validate",
      [
        FIX_HEADER,
        `,,https://example.com/alice,,${criterionId},1,2026-07,,`,
        `,,not-a-url,,${criterionId},1,2026-07,,`,
        `,,,ausr_broken,${criterionId},1,2026-07,,`,
      ].join("\n"),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      errors: [
        { code: "RECIPIENT_IDENTIFIER_INVALID", column: "recipientProfileUrl", row: 3 },
        { code: "RECIPIENT_IDENTIFIER_INVALID", column: "recipientAccountsUserId", row: 4 },
      ],
    });
  });
});

// --------------------------------------------------
// 照合結果の反映
// --------------------------------------------------

describe("FIX CSV の Accounts 照合", () => {
  it("同じ識別子の行はまとめて1回の要求で照合する", async () => {
    const { accounts, criterionId, validate } = await setUp();

    await validate(
      [
        FIX_HEADER,
        `,,https://example.com/alice,,${criterionId},1,2026-07,,a`,
        `,,https://example.com/alice,,${criterionId},2,2026-07,,b`,
        `,,,ausr_alice,${criterionId},3,2026-07,,c`,
        `,,,ausr_alice,${criterionId},4,2026-07,,d`,
      ].join("\n"),
    );

    expect(resolveRequests(accounts)).toEqual([
      [
        { type: "url", url: "https://example.com/alice" },
        { type: "accounts_user", accountsUserId: "ausr_alice" },
      ],
    ]);
  });

  it("連携済みの matched だけを台帳へ反映し、連携の無い matched と no_match は未受領にする", async () => {
    const { accounts, admin, connectionId, criterionId, validate, commit } = await setUp();
    const linkedPointsUserId = await seedLinkedPointsUser(accounts, connectionId, "ausr_linked");
    accounts.setResolve(
      resolveBy({
        "https://example.com/linked": { status: "matched", accountsUserId: "ausr_linked" },
        ausr_linked: { status: "matched", accountsUserId: "ausr_linked" },
        "https://example.com/unlinked": { status: "matched", accountsUserId: "ausr_unlinked" },
      }),
    );
    const csv = [
      FIX_HEADER,
      `,,https://example.com/linked,,${criterionId},1,2026-07,,`,
      `,,,ausr_linked,${criterionId},2,2026-07,,`,
      `,,https://example.com/unlinked,,${criterionId},3,2026-07,,`,
      `,,https://example.com/nobody,,${criterionId},4,2026-07,,`,
    ].join("\n");

    const validation = await validate(csv);
    expect(validation).toMatchObject({
      accountsConnectionId: connectionId,
      accountsOrigin: accounts.origin,
      accountsResolution: { status: "COMPLETE" },
      rowCount: 4,
      rows: [
        { recipientLinked: true, resolution: "MATCHED", row: 2 },
        { recipientLinked: true, resolution: "MATCHED", row: 3 },
        { recipientLinked: false, resolution: "MATCHED", row: 4 },
        { recipientLinked: false, resolution: "NO_MATCH", row: 5 },
      ],
    });
    const response = await commit(csv, validation.validationHash!);
    expect(response.status).toBe(201);

    const entries = await db
      .prepare(
        `SELECT entry.recipient_identifier_type AS type, entry.recipient_identifier_value AS value,
                entry.accounts_origin AS accountsOrigin,
                entry.resolved_accounts_user_id AS resolvedAccountsUserId,
                entry.points_user_id AS pointsUserId, entry.accounts_resolved_at AS resolvedAt
         FROM fix_revision_entry entry
         JOIN fix_revision revision ON revision.id = entry.fix_revision_id
         WHERE revision.validation_hash = ? ORDER BY entry.amount_scaled`,
      )
      .bind(validation.validationHash)
      .all();
    expect(entries.results).toEqual([
      {
        type: "url",
        value: "https://example.com/linked",
        accountsOrigin: accounts.origin,
        resolvedAccountsUserId: "ausr_linked",
        pointsUserId: linkedPointsUserId,
        resolvedAt: expect.any(Number),
      },
      {
        type: "accounts_user",
        value: "ausr_linked",
        accountsOrigin: accounts.origin,
        resolvedAccountsUserId: "ausr_linked",
        pointsUserId: linkedPointsUserId,
        resolvedAt: expect.any(Number),
      },
      {
        type: "url",
        value: "https://example.com/unlinked",
        accountsOrigin: accounts.origin,
        resolvedAccountsUserId: "ausr_unlinked",
        pointsUserId: null,
        resolvedAt: expect.any(Number),
      },
      {
        type: "url",
        value: "https://example.com/nobody",
        accountsOrigin: accounts.origin,
        resolvedAccountsUserId: null,
        pointsUserId: null,
        resolvedAt: expect.any(Number),
      },
    ]);

    const unclaimed = await db
      .prepare(
        `SELECT recipient_identifier_value AS value,
                resolved_accounts_user_id AS resolvedAccountsUserId,
                delta_amount_scaled AS delta
         FROM unclaimed_fix_entry entry
         JOIN fix_revision revision ON revision.id = entry.source_fix_revision_id
         WHERE revision.validation_hash = ? ORDER BY delta`,
      )
      .bind(validation.validationHash)
      .all();
    expect(unclaimed.results).toEqual([
      {
        value: "https://example.com/unlinked",
        resolvedAccountsUserId: "ausr_unlinked",
        delta: 30_000,
      },
      { value: "https://example.com/nobody", resolvedAccountsUserId: null, delta: 40_000 },
    ]);
    const balance = await db
      .prepare(
        "SELECT balance FROM point_account WHERE points_user_id = ? AND evaluation_criterion_id = ?",
      )
      .bind(linkedPointsUserId, criterionId)
      .first<{ balance: number }>();
    expect(balance?.balance).toBe(30_000);

    const audit = await db
      .prepare(
        `SELECT target FROM audit_event
         WHERE action = 'FIX_ACCOUNTS_RESOLVED' AND actor_points_user_id = ?`,
      )
      .bind(admin.pointsUserId)
      .all<{ target: string }>();
    expect(audit.results).toEqual([{ target: connectionId }]);
  });

  it("1,000行を1回の要求で照合して確定できる", async () => {
    const { accounts, criterionId, validateAndCommit } = await setUp();
    const rows = Array.from(
      { length: 1000 },
      (_, index) => `,,https://example.com/member-${index},,${criterionId},1,2026-07,,`,
    );

    const results = await validateAndCommit([FIX_HEADER, ...rows].join("\n"));

    expect(results).toHaveLength(1000);
    expect(resolveRequests(accounts).map((identifiers) => identifiers.length)).toEqual([
      1000, 1000,
    ]);
  });

  it("validate と commit の間に照合結果が変わると409で全件を止める", async () => {
    const { accounts, criterionId, validate, commit } = await setUp();
    const csv = `${FIX_HEADER}\n,,https://example.com/alice,,${criterionId},1,2026-07,,`;
    const { validationHash } = await validate(csv);
    accounts.setResolve(
      resolveBy({ "https://example.com/alice": { status: "matched", accountsUserId: "ausr_a" } }),
    );

    const response = await commit(csv, validationHash!);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_CHANGED" });
  });

  it("validate と commit の間に Points 内の連携が変わると409で全件を止める", async () => {
    const { accounts, connectionId, criterionId, validate, commit } = await setUp();
    accounts.setResolve(
      resolveBy({ "https://example.com/bob": { status: "matched", accountsUserId: "ausr_bob" } }),
    );
    const csv = `${FIX_HEADER}\n,,https://example.com/bob,,${criterionId},1,2026-07,,`;
    const { validationHash } = await validate(csv);
    await seedLinkedPointsUser(accounts, connectionId, "ausr_bob");

    const response = await commit(csv, validationHash!);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_CHANGED" });
  });
});

// --------------------------------------------------
// 照合できなかった場合
// --------------------------------------------------

describe("FIX CSV の照合失敗", () => {
  it("通信失敗の validate は全行を未照合として返し、確定に使う hash を返さない", async () => {
    const { accounts, connectionId, criterionId, validate } = await setUp();
    accounts.interceptNext("/api/v1/identities/resolve", "network");

    const validation = await validate(
      [
        FIX_HEADER,
        `,,https://example.com/alice,,${criterionId},1,2026-07,,`,
        `,,,ausr_bob,${criterionId},1,2026-07,,`,
      ].join("\n"),
    );

    expect(validation).toEqual({
      accountsConnectionId: connectionId,
      accountsOrigin: null,
      accountsResolution: {
        code: "ACCOUNTS_RESOLVE_UNAVAILABLE",
        retryAfter: null,
        status: "UNAVAILABLE",
      },
      fileHash: expect.any(String),
      rowCount: 2,
      rows: [
        { recipientLinked: false, resolution: "UNRESOLVED", row: 2 },
        { recipientLinked: false, resolution: "UNRESOLVED", row: 3 },
      ],
      validationHash: null,
    });
  });

  it("制限超過は Retry-After を返す", async () => {
    const { accounts, criterionId, validate } = await setUp();
    accounts.interceptNext(
      "/api/v1/identities/resolve",
      new Response(null, { status: 429, headers: { "Retry-After": "30" } }),
    );

    const { accountsResolution } = await validate(
      `${FIX_HEADER}\n,,https://example.com/alice,,${criterionId},1,2026-07,,`,
    );

    expect(accountsResolution).toEqual({
      code: "ACCOUNTS_RESOLVE_UNAVAILABLE",
      retryAfter: "30",
      status: "UNAVAILABLE",
    });
  });

  it("トークンを取り直しても認証を拒否された場合は ACCOUNTS_CLIENT_UNAUTHORIZED を返す", async () => {
    const { accounts, clientId, criterionId, validate } = await setUp();
    const csv = `${FIX_HEADER}\n,,https://example.com/alice,,${criterionId},1,2026-07,,`;
    await validate(csv);
    const otherKey = await generateAccountsSigningKey();
    accounts.registerClient(clientId, toAccountsPublicJwks(otherKey.publicJwk));
    accounts.revokeAccessTokens();

    const { accountsResolution } = await validate(csv);

    expect(accountsResolution).toEqual({
      code: "ACCOUNTS_CLIENT_UNAUTHORIZED",
      retryAfter: null,
      status: "UNAVAILABLE",
    });
  });

  it("commit で照合できなかった場合は409で全件を0件反映にする", async () => {
    const { accounts, criterionId, validate, commit } = await setUp();
    const reason = "FIX test";
    const before = await countFixRevisionsByReason(reason);
    const csv = `${FIX_HEADER}\n,,https://example.com/alice,,${criterionId},1,2026-07,,`;
    const { validationHash } = await validate(csv);
    accounts.interceptNext("/api/v1/identities/resolve", new Response(null, { status: 500 }));

    const response = await commit(csv, validationHash!);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_CHANGED" });
    expect(await countFixRevisionsByReason(reason)).toBe(before);
  });
});

// --------------------------------------------------
// 不変 revision と差分台帳
// --------------------------------------------------

describe("immutable FIX revision and delta ledger", () => {
  it("commits an initial FIX, appends only correction deltas, and permits a negative balance", async () => {
    const { accounts, admin, connectionId, criterionId, requestCsv, validate, commit } =
      await setUp();
    const suffix = crypto.randomUUID();
    const recipientPointsUserId = await seedLinkedPointsUser(accounts, connectionId, "ausr_alice");
    accounts.setResolve(
      resolveBy({
        "https://github.com/alice": { status: "matched", accountsUserId: "ausr_alice" },
      }),
    );
    const now = Date.now();

    const initialCsv = `${FIX_HEADER}\n,,https://github.com/alice,,${criterionId},10,2026-07,,initial`;
    const initial = await commit(
      initialCsv,
      (await validate(initialCsv)).validationHash!,
      `initial-${suffix}`,
    );
    expect(initial.status).toBe(201);
    const fixResultId = ((await initial.json()) as CommitBody).data.results[0]!.fixResultId;

    const correctionCsv = `${FIX_HEADER}\n${fixResultId},1,https://github.com/alice,,${criterionId},-3,2026-07,,correction`;
    const correctionHash = (await validate(correctionCsv)).validationHash!;
    const correction = await commit(correctionCsv, correctionHash, `correction-${suffix}`);
    expect(correction.status).toBe(201);
    const retry = await commit(correctionCsv, correctionHash, `correction-${suffix}`);
    expect(retry.status).toBe(201);
    await expect(retry.json()).resolves.toEqual(await correction.json());

    const sameCsv = `${FIX_HEADER}\n${fixResultId},2,https://github.com/alice,,${criterionId},-3,2026-07,,same`;
    const same = await commit(sameCsv, (await validate(sameCsv)).validationHash!, `same-${suffix}`);
    expect(same.status).toBe(201);
    const sealedRevisionId = ((await same.json()) as CommitBody).data.results[0]!.fixRevisionId;

    const duplicateCorrection = await requestCsv(
      "validate",
      `${FIX_HEADER}\n${fixResultId},3,https://github.com/alice,,${criterionId},1,2026-07,,duplicate-a\n${fixResultId},3,https://github.com/alice,,${criterionId},2,2026-07,,duplicate-b`,
    );
    expect(duplicateCorrection.status).toBe(422);
    await expect(duplicateCorrection.json()).resolves.toMatchObject({
      code: "CSV_VALIDATION_FAILED",
      errors: [
        { code: "CSV_DUPLICATE_BUSINESS_KEY", column: "recipientProfileUrl", row: 2 },
        { code: "CSV_DUPLICATE_BUSINESS_KEY", column: "recipientProfileUrl", row: 3 },
      ],
    });

    await validate(
      `${FIX_HEADER}\n,,https://github.com/alice,,${criterionId},1,2026-07,,new-a\n,,https://github.com/alice,,${criterionId},2,2026-07,,new-b`,
    );

    await expect(
      db
        .prepare(
          `INSERT INTO fix_revision_entry
             (id, fix_revision_id, recipient_identifier_type, recipient_identifier_value,
              accounts_origin, accounts_resolved_at, evaluation_criterion_id,
              evaluation_criterion_revision_id, amount_scaled, evaluation_at, created_at)
           VALUES (?, ?, 'url', 'https://freeism.app/late', ?, ?, ?, ?, 1, '2026-07', ?)`,
        )
        .bind(
          `late-entry-${suffix}`,
          sealedRevisionId,
          accounts.origin,
          now,
          criterionId,
          `ecr_${criterionId}_1`,
          now,
        )
        .run(),
    ).rejects.toThrow("SEALED_FIX_REVISION");
    await expect(
      db
        .prepare(
          `INSERT INTO unclaimed_fix_entry
             (id, source_fix_revision_id, recipient_identifier_type, recipient_identifier_value,
              accounts_origin, accounts_resolved_at, evaluation_criterion_id,
              evaluation_criterion_revision_id, delta_amount_scaled, evaluation_at, created_at)
           VALUES (?, ?, 'url', 'https://freeism.app/late', ?, ?, ?, ?, 1, '2026-07', ?)`,
        )
        .bind(
          `late-unclaimed-${suffix}`,
          sealedRevisionId,
          accounts.origin,
          now,
          criterionId,
          `ecr_${criterionId}_1`,
          now,
        )
        .run(),
    ).rejects.toThrow("SEALED_FIX_REVISION");
    await expect(
      db
        .prepare("UPDATE fix_revision_seal SET sealed_at = ? WHERE fix_revision_id = ?")
        .bind(now + 1, sealedRevisionId)
        .run(),
    ).rejects.toThrow("IMMUTABLE_FIX_REVISION_SEAL");
    await expect(
      db
        .prepare("DELETE FROM fix_revision_seal WHERE fix_revision_id = ?")
        .bind(sealedRevisionId)
        .run(),
    ).rejects.toThrow("IMMUTABLE_FIX_REVISION_SEAL");

    const account = await db
      .prepare(
        `SELECT balance, evaluation_total AS evaluationTotal,
              typeof(balance) AS balanceType, typeof(evaluation_total) AS evaluationTotalType
       FROM point_account WHERE points_user_id = ? AND evaluation_criterion_id = ?`,
      )
      .bind(recipientPointsUserId, criterionId)
      .first();
    expect(account).toEqual({
      balance: -30000,
      balanceType: "integer",
      evaluationTotal: -30000,
      evaluationTotalType: "integer",
    });
    const deltas = await db
      .prepare(
        "SELECT delta_amount_scaled AS delta FROM point_ledger_entry WHERE points_user_id = ? ORDER BY created_at, id",
      )
      .bind(recipientPointsUserId)
      .all<{ delta: number }>();
    expect(deltas.results.map(({ delta }) => delta).sort((a, b) => b - a)).toEqual([
      100000, -130000,
    ]);
    await expect(
      db
        .prepare("UPDATE fix_revision SET reason = 'changed' WHERE fix_result_id = ?")
        .bind(fixResultId)
        .run(),
    ).rejects.toThrow("IMMUTABLE_FIX_REVISION");

    const overflowRevisionIds = [`overflow-rev-a-${suffix}`, `overflow-rev-b-${suffix}`];
    for (const [index, fixRevisionId] of overflowRevisionIds.entries()) {
      const overflowResultId = `overflow-result-${index}-${suffix}`;
      await db.batch([
        db
          .prepare(
            "INSERT INTO fix_result (id, current_revision_id, current_revision, created_at) VALUES (?, ?, 1, ?)",
          )
          .bind(overflowResultId, fixRevisionId, now),
        db
          .prepare(
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
            admin.pointsUserId,
            now,
          ),
      ]);
    }
    const overflowBatch = db.batch([
      db
        .prepare(
          `INSERT INTO point_ledger_entry
           (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
            delta_amount_scaled, affects_evaluation_total, source_type, source_fix_revision_id, created_at)
         VALUES (?, ?, ?, ?, 9007199254740991, 1, 'FIX', ?, ?)`,
        )
        .bind(
          `overflow-a-${suffix}`,
          admin.pointsUserId,
          criterionId,
          `ecr_${criterionId}_1`,
          overflowRevisionIds[0],
          now,
        ),
      db
        .prepare(
          `INSERT INTO point_ledger_entry
           (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
            delta_amount_scaled, affects_evaluation_total, source_type, source_fix_revision_id, created_at)
         VALUES (?, ?, ?, ?, 1, 1, 'FIX', ?, ?)`,
        )
        .bind(
          `overflow-b-${suffix}`,
          admin.pointsUserId,
          criterionId,
          `ecr_${criterionId}_1`,
          overflowRevisionIds[1],
          now,
        ),
    ]);
    await expect(overflowBatch).rejects.toThrow("SAFE_INTEGER_OVERFLOW");
    const rolledBack = await db
      .prepare("SELECT count(*) AS count FROM point_ledger_entry WHERE points_user_id = ?")
      .bind(admin.pointsUserId)
      .first<{ count: number }>();
    expect(rolledBack?.count).toBe(0);
  });

  it("keeps the recipient of an Accounts user identifier scoped to the correction target", async () => {
    const { accounts, connectionId, criterionId, validateAndCommit } = await setUp();
    const pointsUserId = await seedLinkedPointsUser(accounts, connectionId, "ausr_carol");
    accounts.setResolve(
      resolveBy({ ausr_carol: { status: "matched", accountsUserId: "ausr_carol" } }),
    );
    const [initial] = await validateAndCommit(
      `${FIX_HEADER}\n,,,ausr_carol,${criterionId},5,2026-07,,`,
    );

    await validateAndCommit(
      `${FIX_HEADER}\n${initial!.fixResultId},1,,ausr_carol,${criterionId},7,2026-07,,`,
    );

    const deltas = await db
      .prepare(
        "SELECT delta_amount_scaled AS delta FROM point_ledger_entry WHERE points_user_id = ? ORDER BY delta",
      )
      .bind(pointsUserId)
      .all<{ delta: number }>();
    expect(deltas.results.map(({ delta }) => delta)).toEqual([20_000, 50_000]);
  });
});
