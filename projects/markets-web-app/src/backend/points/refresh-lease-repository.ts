import type {
  PointsOAuthAccount,
  PointsOAuthTokenSet,
  PointsTokenStore,
} from "./points-token-store";

export interface RefreshLeaseRepository {
  acquire(input: {
    connectionId: string;
    expectedTokenVersion: number;
    expiresAt: string;
    now: string;
    owner: string;
  }): Promise<boolean>;
  read(connectionId: string): Promise<PointsOAuthAccount & { tokenVersion: number }>;
  replace(input: {
    connectionId: string;
    expectedTokenVersion: number;
    owner: string;
    tokens: PointsOAuthTokenSet;
  }): Promise<void>;
}

interface ConnectionTokenRow {
  accountId: string | null;
  authUserId: string;
  pointsIssuer: string;
  pointsSubject: string;
  status: string;
  tokenVersion: number;
}

export function createRefreshLeaseRepository(
  db: D1Database,
  tokenStore: PointsTokenStore,
): RefreshLeaseRepository {
  async function connection(connectionId: string) {
    const row = await db
      .prepare(
        `SELECT auth_user_id AS authUserId, status, token_version AS tokenVersion,
                better_auth_account_id AS accountId, points_issuer AS pointsIssuer,
                points_subject AS pointsSubject
         FROM points_connection WHERE id = ?`,
      )
      .bind(connectionId)
      .first<ConnectionTokenRow>();
    if (!row || row.status !== "ACTIVE") throw new Error("POINTS_CONNECTION_NOT_ACTIVE");
    return row;
  }

  return {
    async acquire(input) {
      const result = await db
        .prepare(
          `UPDATE points_connection
           SET refresh_lease_owner = ?, refresh_lease_expires_at = ?
           WHERE id = ? AND status = 'ACTIVE' AND token_version = ?
             AND (refresh_lease_owner IS NULL OR refresh_lease_expires_at <= ?)`,
        )
        .bind(
          input.owner,
          new Date(input.expiresAt).getTime(),
          input.connectionId,
          input.expectedTokenVersion,
          new Date(input.now).getTime(),
        )
        .run();
      return result.meta.changes === 1;
    },
    async read(connectionId) {
      const row = await connection(connectionId);
      const accountId = row.accountId ?? `${row.pointsIssuer}|${row.pointsSubject}`;
      return { ...(await tokenStore.read(accountId)), tokenVersion: row.tokenVersion };
    },
    async replace(input) {
      const row = await connection(input.connectionId);
      const accountId = row.accountId ?? `${row.pointsIssuer}|${row.pointsSubject}`;
      await tokenStore.save({
        ...input.tokens,
        accountId,
        authUserId: row.authUserId,
      });
      const result = await db
        .prepare(
          `UPDATE points_connection
           SET token_version = token_version + 1, better_auth_account_id = ?,
               refresh_lease_owner = NULL, refresh_lease_expires_at = NULL,
               updated_at = cast(unixepoch('subsecond') * 1000 as integer)
           WHERE id = ? AND token_version = ? AND refresh_lease_owner = ?`,
        )
        .bind(accountId, input.connectionId, input.expectedTokenVersion, input.owner)
        .run();
      if (result.meta.changes !== 1) throw new Error("POINTS_REFRESH_CAS_CONFLICT");
    },
  };
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function withUserAccessToken(
  repository: RefreshLeaseRepository,
  connectionId: string,
  call: (accessToken: string) => Promise<Response>,
  refresh: (refreshToken: string) => Promise<PointsOAuthTokenSet>,
) {
  const initial = await repository.read(connectionId);
  const first = await call(initial.accessToken);
  if (first.status !== 401) return first;

  const owner = `lease_${crypto.randomUUID()}`;
  const now = new Date();
  const acquired = await repository.acquire({
    connectionId,
    expectedTokenVersion: initial.tokenVersion,
    expiresAt: new Date(now.getTime() + 30_000).toISOString(),
    now: now.toISOString(),
    owner,
  });
  if (acquired) {
    const tokens = await refresh(initial.refreshToken);
    await repository.replace({
      connectionId,
      expectedTokenVersion: initial.tokenVersion,
      owner,
      tokens,
    });
  } else {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const latest = await repository.read(connectionId);
      if (latest.tokenVersion !== initial.tokenVersion) break;
      await wait(5);
    }
  }
  const latest = await repository.read(connectionId);
  if (latest.tokenVersion === initial.tokenVersion) throw new Error("POINTS_REFRESH_TIMEOUT");
  return call(latest.accessToken);
}
