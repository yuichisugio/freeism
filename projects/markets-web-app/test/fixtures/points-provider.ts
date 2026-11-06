export const testPointsProviderId = "ppr_test";

/** Worker testsに利用する有効なPoints提供先を作成する。 */
export async function seedPointsProvider(
  db: D1Database,
  options: { id?: string; origin?: string; status?: "ACTIVE" | "STOPPED" } = {},
): Promise<string> {
  const id = options.id ?? testPointsProviderId;
  const origin = options.origin ?? "https://points.example.test";
  await db
    .prepare(
      `INSERT INTO points_provider
       (id, display_name, origin, issuer, resource, client_id, client_public_jwk, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    )
    .bind(
      id,
      id,
      origin,
      `${origin}/api/auth`,
      `${origin}/api/v1`,
      "test-points-client",
      JSON.stringify({
        kty: "OKP",
        crv: "Ed25519",
        x: "ulOUkNGTR3ZYMwm-h3OQ25DvPdRlIieP-NDyv8aeDZk",
      }),
      options.status ?? "ACTIVE",
    )
    .run();
  return id;
}
