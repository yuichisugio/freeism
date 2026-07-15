import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";

const CRITERION_HEADER =
  "evaluationCriterionId,expectedRevision,status,name,description,minimumUnit,transferEnabled,exchangeEnabled,balanceVisibleByDefault,buyNowEnabled,relatedUrl";
const PACKAGE_HEADER =
  "pointPackageId,expectedRevision,status,name,description,relatedUrl,evaluationCriterionId,componentWeight,displayOrder";

async function createAdmin() {
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const authUserId = `eval_route_${suffix}`;
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
      .bind(`account_${suffix}`, `google_${suffix}`, authUserId, now, now),
  ]);
  const user = await provisionPointsUser(env.DB!, authUserId, () => `pusr_${suffix}`);
  await env
    .DB!.prepare("INSERT INTO admin_membership (id, points_user_id, role) VALUES (?, ?, 'ADMIN')")
    .bind(`admin_${suffix}`, user.id)
    .run();
  return { authUserId, suffix };
}

function appFor(authUserId: string) {
  return createPointsBackendApp({
    getSession: async (_bindings, headers) =>
      headers.get("X-Test-Auth-User") === authUserId
        ? { session: { createdAt: new Date(), userId: authUserId }, user: { id: authUserId } }
        : null,
  });
}

async function requestCsv(
  app: ReturnType<typeof createPointsBackendApp>,
  authUserId: string,
  path: string,
  csv: string,
  headers: Record<string, string> = {},
) {
  return app.request(
    `http://points.test${path}`,
    {
      body: csv,
      headers: { "Content-Type": "text/csv", "X-Test-Auth-User": authUserId, ...headers },
      method: "POST",
    },
    env,
  );
}

describe("evaluation criteria and Point Package CSV routes", () => {
  it("validates and idempotently commits criteria and packages through the domain imports", async () => {
    const { authUserId, suffix } = await createAdmin();
    const app = appFor(authUserId);
    const criterionId = `criterion_${suffix}`;
    const criterionCsv = `${CRITERION_HEADER}\n${criterionId},,ACTIVE,Criterion ${suffix.slice(0, 8)},Description,0.0001,true,true,false,true,https://example.test/criterion\n`;

    const criterionValidation = await requestCsv(
      app,
      authUserId,
      "/api/admin/evaluation-criteria/csv/validate",
      criterionCsv,
    );
    expect(criterionValidation.status).toBe(200);
    const criterionValidationBody = (await criterionValidation.json()) as {
      data: { fileHash: string; rowCount: number; validationHash: string };
    };
    expect(criterionValidationBody.data).toMatchObject({ rowCount: 1 });

    const criterionHeaders = {
      "Idempotency-Key": `criterion_${suffix}`,
      "X-Reason": "create criterion",
      "X-Validation-Hash": criterionValidationBody.data.validationHash,
    };
    const criterionCommit = await requestCsv(
      app,
      authUserId,
      "/api/admin/evaluation-criteria/csv/commit",
      criterionCsv,
      criterionHeaders,
    );
    expect(criterionCommit.status).toBe(201);
    const criterionBody = await criterionCommit.json();
    const criterionReplay = await requestCsv(
      app,
      authUserId,
      "/api/admin/evaluation-criteria/csv/commit",
      criterionCsv,
      criterionHeaders,
    );
    expect(criterionReplay.status).toBe(201);
    expect(await criterionReplay.json()).toEqual(criterionBody);
    const criterionAudit = await env
      .DB!.prepare(
        "SELECT reason, result FROM audit_event WHERE action = 'EVALUATION_CRITERION_CSV_COMMIT' AND target = 'evaluation-criteria' ORDER BY created_at DESC LIMIT 1",
      )
      .first<{ reason: string; result: string }>();
    expect(criterionAudit).toEqual({ reason: "create criterion", result: "SUCCESS" });

    const packageId = `package_${suffix}`;
    const packageCsv = `${PACKAGE_HEADER}\n${packageId},,ACTIVE,Package ${suffix.slice(0, 8)},Description,https://example.test/package,${criterionId},2,0\n`;
    const packageValidation = await requestCsv(
      app,
      authUserId,
      "/api/admin/point-packages/csv/validate",
      packageCsv,
    );
    expect(packageValidation.status).toBe(200);
    const packageValidationBody = (await packageValidation.json()) as {
      data: { rowCount: number; validationHash: string };
    };
    expect(packageValidationBody.data.rowCount).toBe(1);
    const packageCommit = await requestCsv(
      app,
      authUserId,
      "/api/admin/point-packages/csv/commit",
      packageCsv,
      {
        "Idempotency-Key": `package_${suffix}`,
        "X-Reason": "create package",
        "X-Validation-Hash": packageValidationBody.data.validationHash,
      },
    );
    expect(packageCommit.status).toBe(201);
    const stored = await env
      .DB!.prepare(
        "SELECT point_package_id AS pointPackageId FROM point_package_revision WHERE point_package_id = ?",
      )
      .bind(packageId)
      .first<{ pointPackageId: string }>();
    expect(stored).toEqual({ pointPackageId: packageId });
  });

  it("requires commit controls and rejects the twenty-first logical item during validation", async () => {
    const { authUserId, suffix } = await createAdmin();
    const app = appFor(authUserId);
    const rows = Array.from(
      { length: 21 },
      (_, index) =>
        `criterion_${suffix}_${index},,ACTIVE,Criterion ${index} ${suffix.slice(0, 6)},Description,0.0001,true,true,false,true,`,
    );
    const csv = `${CRITERION_HEADER}\n${rows.join("\n")}\n`;
    const validation = await requestCsv(
      app,
      authUserId,
      "/api/admin/evaluation-criteria/csv/validate",
      csv,
    );
    expect(validation.status).toBe(422);
    const body = (await validation.json()) as { errors: Array<{ code: string }> };
    expect(body.errors).toContainEqual(expect.objectContaining({ code: "CSV_TOO_MANY_ITEMS" }));

    const missingReason = await requestCsv(
      app,
      authUserId,
      "/api/admin/evaluation-criteria/csv/commit",
      `${CRITERION_HEADER}\ncriterion_${suffix},,ACTIVE,Criterion ${suffix.slice(0, 6)},Description,0.0001,true,true,false,true,\n`,
      { "Idempotency-Key": `missing_reason_${suffix}`, "X-Validation-Hash": "a".repeat(64) },
    );
    expect(missingReason.status).toBe(422);
  });
});
