export async function readPointsConnection(
  db: D1Database,
  input: { issuer: string; pointsSubject: string; userClientId: string },
) {
  const row = await db
    .prepare(
      `SELECT id AS pointsConnectionId, issuer, points_subject AS pointsSubject,
              granted_scopes AS grantedScopes, status, grant_version AS grantVersion,
              linked_at AS linkedAt
       FROM points_oauth_connection
       WHERE issuer = ? AND user_client_id = ? AND points_subject = ?
         AND status IN ('ACTIVE', 'REAUTH_REQUIRED')`,
    )
    .bind(input.issuer, input.userClientId, input.pointsSubject)
    .first<{
      grantVersion: number;
      grantedScopes: string;
      issuer: string;
      linkedAt: number;
      pointsConnectionId: string;
      pointsSubject: string;
      status: "ACTIVE" | "REAUTH_REQUIRED";
    }>();
  if (!row) throw new Error("POINTS_CONNECTION_NOT_FOUND");
  return {
    grantVersion: row.grantVersion,
    grantedScopes: JSON.parse(row.grantedScopes) as string[],
    issuer: row.issuer,
    linkedAt: new Date(row.linkedAt),
    pointsConnectionId: row.pointsConnectionId,
    subject: row.pointsSubject,
    status: row.status,
  };
}
