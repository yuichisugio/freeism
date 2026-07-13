import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vite-plus/test";

import type { BackendContext } from "../../src/backend/http/context";
import { registerExportRoutes } from "../../src/backend/http/routes/export-routes";
import { cleanupExpiredCsvExports } from "../../src/backend/usecases/cleanup-expired-csv-exports";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";
import { scheduledPoints } from "../../worker/index";

const db =
  env.DB ??
  (() => {
    throw new Error("Test D1 binding DB is required");
  })();

async function createExportApp() {
  const authUserId = `csv-user-${crypto.randomUUID()}`;
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(authUserId, "=CSV User", `${authUserId}@example.invalid`, now, now)
    .run();
  const pointsUser = await provisionPointsUser(db, authUserId);
  await db
    .prepare(
      `INSERT INTO profiles
         (points_user_id, display_name, description, external_urls, visibility, created_at, updated_at)
       VALUES (?, '=CSV User', 'first,description', '[]', 'PRIVATE', ?, ?)`,
    )
    .bind(pointsUser.id, now, now)
    .run();

  const app = new Hono<BackendContext>();
  registerExportRoutes(app, async () => ({
    session: { createdAt: new Date(now), userId: authUserId },
    user: { id: authUserId },
  }));
  return { app, pointsUserId: pointsUser.id };
}

describe("CSV export snapshots", () => {
  it("materializes a private profile and streams an immutable final page", async () => {
    const { app, pointsUserId } = await createExportApp();
    const created = await app.request(
      "https://points.test/api/csv-exports",
      {
        body: JSON.stringify({ pageSize: 1, type: "PROFILE" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `idem_${crypto.randomUUID()}`,
        },
        method: "POST",
      },
      env,
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      data: {
        cursor: string;
        expiresAt: string;
        exportId: string;
        snapshotAt: string;
        totalRows: number;
      };
    };
    expect(body.data).toMatchObject({
      cursor: expect.any(String),
      expiresAt: expect.any(String),
      exportId: expect.stringMatching(/^csvx_/),
      snapshotAt: expect.any(String),
      totalRows: 1,
    });

    await db
      .prepare(
        "UPDATE profiles SET display_name = 'Changed after snapshot' WHERE points_user_id = ?",
      )
      .bind(pointsUserId)
      .run();

    const page = await app.request(
      `https://points.test/api/csv-exports/${body.data.exportId}/pages?cursor=${encodeURIComponent(body.data.cursor)}`,
      undefined,
      env,
    );
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.headers.get("Content-Type")).toContain("text/csv");
    expect(page.headers.get("X-Freeism-Export-Id")).toBe(body.data.exportId);
    expect(page.headers.get("X-Freeism-Returned-Rows")).toBe("1");
    expect(page.headers.get("X-Freeism-Final-Page")).toBe("true");
    expect(page.headers.has("X-Freeism-Next-Cursor")).toBe(false);
    expect(await page.text()).toBe(
      `pointsUserId,displayName,description,visibility\r\n${pointsUserId},'=CSV User,"first,description",PRIVATE\r\n`,
    );
  });

  it("rejects an unsupported export type and a page size over 1,000", async () => {
    const { app } = await createExportApp();
    for (const body of [{ type: "UNKNOWN" }, { pageSize: 1001, type: "PROFILE" }]) {
      const response = await app.request(
        "https://points.test/api/csv-exports",
        {
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `idem_${crypto.randomUUID()}`,
          },
          method: "POST",
        },
        env,
      );
      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_FAILED" });
    }
  });

  it("does not convert a corrupt snapshot into a client validation error", async () => {
    const { app } = await createExportApp();
    const created = await app.request(
      "https://points.test/api/csv-exports",
      {
        body: JSON.stringify({ type: "PROFILE" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `idem_${crypto.randomUUID()}`,
        },
        method: "POST",
      },
      env,
    );
    const body = (await created.json()) as { data: { cursor: string; exportId: string } };
    await db
      .prepare("UPDATE csv_export_snapshot SET header_json = 'not-json' WHERE id = ?")
      .bind(body.data.exportId)
      .run();

    const response = await app.request(
      `https://points.test/api/csv-exports/${body.data.exportId}/pages?cursor=${encodeURIComponent(body.data.cursor)}`,
      undefined,
      env,
    );
    expect(response.status).toBe(500);
  });

  it("deletes an expired physical snapshot and its rows", async () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const exportId = `csvx_${crypto.randomUUID()}`;
    await db.batch([
      db
        .prepare(
          `INSERT INTO csv_export_snapshot
             (id, actor_points_user_id, target_points_user_id, export_type, filter_hash,
              header_json, page_size, snapshot_at, expires_at, total_rows, total_encoded_bytes,
              idempotency_key, created_at)
           VALUES (?, 'pusr_cleanup', 'pusr_cleanup', 'PROFILE', ?, '[]', 1000, ?, ?, 1, 4, ?, ?)`,
        )
        .bind(
          exportId,
          `sha256:${"0".repeat(64)}`,
          now.getTime() - 1_900_000,
          now.getTime() - 1,
          `idem_${exportId}`,
          now.getTime() - 1_900_000,
        ),
      db
        .prepare(
          "INSERT INTO csv_export_snapshot_row (export_id, ordinal, encoded_row, encoded_bytes) VALUES (?, 0, 'row\\r\\n', 5)",
        )
        .bind(exportId),
    ]);

    await expect(cleanupExpiredCsvExports(db, now)).resolves.toBe(1);
    await expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM csv_export_snapshot WHERE id = ?")
        .bind(exportId)
        .first(),
    ).resolves.toEqual({ count: 0 });
    await expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM csv_export_snapshot_row WHERE export_id = ?")
        .bind(exportId)
        .first(),
    ).resolves.toEqual({ count: 0 });
  });

  it("runs expired snapshot cleanup from the Worker scheduled handler", async () => {
    const now = Date.now();
    const exportId = `csvx_${crypto.randomUUID()}`;
    await db
      .prepare(
        `INSERT INTO csv_export_snapshot
           (id, actor_points_user_id, target_points_user_id, export_type, filter_hash,
            header_json, page_size, snapshot_at, expires_at, total_rows, total_encoded_bytes,
            idempotency_key, created_at)
         VALUES (?, 'pusr_scheduled', 'pusr_scheduled', 'PROFILE', ?, '[]', 1000, ?, ?, 0, 0, ?, ?)`,
      )
      .bind(
        exportId,
        `sha256:${"1".repeat(64)}`,
        now - 1_900_000,
        now - 1,
        `idem_${exportId}`,
        now - 1_900_000,
      )
      .run();

    await scheduledPoints({} as ScheduledController, env);

    await expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM csv_export_snapshot WHERE id = ?")
        .bind(exportId)
        .first(),
    ).resolves.toEqual({ count: 0 });
  });
});
