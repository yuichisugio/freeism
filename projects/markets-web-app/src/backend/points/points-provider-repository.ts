import type { PointsProvider } from "../db/schema/points-provider";

type ProviderRow = Omit<PointsProvider, "createdAt" | "activatedAt" | "stoppedAt"> & {
  createdAt: number;
  activatedAt: number | null;
  stoppedAt: number | null;
};

const selectProvider = `SELECT id, display_name AS displayName, origin, issuer, resource,
  client_id AS clientId, client_public_jwk AS clientPublicJwk,
  signing_key_ciphertext AS signingKeyCiphertext, dpop_key_ciphertext AS dpopKeyCiphertext,
  status, created_at AS createdAt, activated_at AS activatedAt, stopped_at AS stoppedAt
  FROM points_provider`;

function fromRow(row: ProviderRow): PointsProvider {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    activatedAt: row.activatedAt === null ? null : new Date(row.activatedAt),
    stoppedAt: row.stoppedAt === null ? null : new Date(row.stoppedAt),
  };
}

export async function findPointsProvider(db: D1Database, providerId: string) {
  const row = await db
    .prepare(`${selectProvider} WHERE id = ?`)
    .bind(providerId)
    .first<ProviderRow>();
  return row ? fromRow(row) : null;
}

export async function listPointsProviders(db: D1Database, activeOnly = false) {
  const query = `${selectProvider}${activeOnly ? " WHERE status = 'ACTIVE'" : ""} ORDER BY created_at DESC`;
  const rows = await db.prepare(query).all<ProviderRow>();
  return rows.results.map(fromRow);
}
