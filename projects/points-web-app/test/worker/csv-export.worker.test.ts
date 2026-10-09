import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vite-plus/test";

import type { BackendContext } from "../../src/backend/http/context";
import { registerExportRoutes } from "../../src/backend/http/routes/export-routes";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";

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
         (points_user_id, display_name, description, visibility, created_at, updated_at)
       VALUES (?, '=CSV User', 'first,description', 'PRIVATE', ?, ?)`,
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

function exportProfile(app: Hono<BackendContext>, body: Record<string, unknown> = {}) {
  return app.request(
    "https://points.test/api/csv-exports",
    {
      body: JSON.stringify({ type: "PROFILE", ...body }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
    env,
  );
}

describe("CSV profile exports", () => {
  it("reads current private profile data on every request without persisting an export", async () => {
    const { app, pointsUserId } = await createExportApp();
    const first = await exportProfile(app, { pageSize: 1 });
    expect(first.status).toBe(200);
    expect(first.headers.get("Cache-Control")).toBe("private, no-store");
    expect(first.headers.get("Content-Type")).toContain("text/csv");
    expect(first.headers.get("X-Freeism-Returned-Rows")).toBe("1");
    expect(first.headers.get("X-Freeism-Final-Page")).toBe("true");
    expect(first.headers.has("X-Freeism-Next-Cursor")).toBe(false);
    const bytes = new Uint8Array(await first.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(
      `pointsUserId,displayName,description,visibility\r\n${pointsUserId},'=CSV User,"first,description",PRIVATE\r\n`,
    );
    await db
      .prepare("UPDATE profiles SET display_name = 'Changed' WHERE points_user_id = ?")
      .bind(pointsUserId)
      .run();
    const second = await exportProfile(app);
    expect(second.status).toBe(200);
    expect(await second.text()).toContain(`${pointsUserId},Changed,`);
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM csv_export_snapshot WHERE actor_points_user_id = ?")
        .bind(pointsUserId)
        .first(),
    ).toEqual({ count: 0 });
  });

  it("does not let a regular user export another user's private profile", async () => {
    const owner = await createExportApp();
    const other = await createExportApp();
    expect(
      (await exportProfile(other.app, { targetPointsUserId: owner.pointsUserId })).status,
    ).toBe(403);
  });

  it("requires fresh Google authentication for an administrator exporting another user", async () => {
    const owner = await createExportApp();
    const admin = await createExportApp();
    await db
      .prepare("INSERT INTO admin_membership (id, points_user_id, role) VALUES (?, ?, 'ADMIN')")
      .bind(crypto.randomUUID(), admin.pointsUserId)
      .run();
    expect(
      (await exportProfile(admin.app, { targetPointsUserId: owner.pointsUserId })).status,
    ).toBe(401);
  });

  it("rejects unsupported types, page sizes and cursors", async () => {
    const { app } = await createExportApp();
    for (const body of [
      { type: "UNKNOWN" },
      { pageSize: 1001 },
      { pageSize: 0 },
      { cursor: "-1" },
      { cursor: "2" },
      { cursor: 0 },
    ]) {
      const response = await exportProfile(app, body);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_FAILED" });
    }
  });

  it("returns only the header when the cursor has reached the current end", async () => {
    const { app } = await createExportApp();
    const response = await exportProfile(app, { cursor: "1" });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Freeism-Returned-Rows")).toBe("0");
    expect(response.headers.get("X-Freeism-Final-Page")).toBe("true");
    expect(await response.text()).toBe("pointsUserId,displayName,description,visibility\r\n");
  });
});
