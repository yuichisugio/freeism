import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { closePointsAccount } from "./close-points-account";
import { deactivatePointsConnection } from "./deactivate-points-connection";
import { reopenPointsAccount } from "./reopen-points-account";

vi.mock("./preview-points-account-reopen", () => ({
  loadPointsAccountReopenPreview: vi.fn(async () => ({
    aggregates: [],
    entries: [],
    reopenSetHash: "reopen-set",
    totalCount: 0,
  })),
  PointsAccountReopenError: class extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
}));

/** batchが確定した後に行う読み取りだけが失敗するD1。 */
function committedDatabase() {
  let committed = false;
  const postCommitRead = vi.fn(() => {
    throw new Error("POST_COMMIT_READ_UNAVAILABLE");
  });
  const db = {
    prepare(sql: string) {
      const statement = {
        bind: () => statement,
        first: async () => {
          if (committed) return postCommitRead();
          if (sql.includes("SELECT account_status")) return { accountStatus: "ACTIVE" };
          if (sql.includes("m2m_client_id AS m2mClientId")) {
            return {
              id: "connection",
              pointsUserId: "points-user",
              m2mClientId: "markets",
              status: "ACTIVE",
              grantVersion: 1,
            };
          }
          return null;
        },
      };
      return statement;
    },
    batch: vi.fn(async (statements: unknown[]) => {
      committed = true;
      return statements.map(() => ({ success: true, results: [], meta: { changes: 1 } }));
    }),
  };
  return { db: db as unknown as D1Database, postCommitRead };
}

afterEach(() => vi.restoreAllMocks());

describe("account command audit after commit", () => {
  it.each(["close", "reopen", "deactivate"] as const)(
    "reports %s as successful even when subsequent reads are unavailable",
    async (operation) => {
      const { db, postCommitRead } = committedDatabase();
      const logs = vi.spyOn(console, "log").mockImplementation(() => {});
      const common = {
        environment: "test",
        idempotencyKey: "key",
        pointsUserId: "points-user",
        requestId: "request",
        authUserId: "auth-user",
      };
      if (operation === "close") {
        await expect(closePointsAccount(db, common)).resolves.toMatchObject({
          status: 200,
          responseBody: { data: { status: "CLOSED" } },
        });
      } else if (operation === "reopen") {
        await expect(
          reopenPointsAccount(db, {
            ...common,
            reopenSetHash: "reopen-set",
            createResolver: () => async () => ({
              accountsOrigin: "https://accounts.test",
              results: [],
            }),
          }),
        ).resolves.toMatchObject({
          status: 200,
          responseBody: { data: { status: "ACTIVE", claimedCount: 0 } },
        });
      } else {
        await expect(
          deactivatePointsConnection(db, {
            ...common,
            pointsConnectionId: "connection",
            pointsSubject: "subject",
            issuer: "https://points.test",
            reason: "unlink",
            userClientId: "client",
          }),
        ).resolves.toMatchObject({ status: "UNLINKED", grantVersion: 2 });
      }
      expect(postCommitRead).not.toHaveBeenCalled();
      const expectedAction =
        operation === "close"
          ? "ACCOUNT_CLOSE"
          : operation === "reopen"
            ? "ACCOUNT_REOPEN"
            : "POINTS_CONNECTION_DEACTIVATE";
      expect(logs).toHaveBeenCalledWith(
        expect.objectContaining({ operation: expectedAction, outcome: "SUCCESS" }),
      );
      expect(logs.mock.calls.some(([log]) => log.outcome === "REJECTED")).toBe(false);
    },
  );
});
