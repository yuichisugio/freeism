import { env } from "cloudflare:test";
import type { BetterAuthOptions } from "better-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { createPointsAuth } from "../../src/backend/auth/create-auth";
import { adminMembershipRoutePolicies } from "../../src/backend/http/routes/admin-routes";
import { changeAdminMembership } from "../../src/backend/usecases/change-admin-membership";
import { provisionPointsUser } from "../../src/backend/usecases/provision-points-user";

const db =
  env.DB ??
  (() => {
    throw new Error("Test D1 binding DB is required");
  })();

async function seedAuthUser(id: string, googleAccountId?: string) {
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(id, id, `${id}@example.invalid`, now, now)
    .run();

  if (googleAccountId) {
    await db
      .prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, 'google', ?, ?, ?)",
      )
      .bind(`account-${id}`, googleAccountId, id, now, now)
      .run();
  }
}

function authenticatedApp(authUserId: string, createdAt = new Date()) {
  return createPointsBackendApp({
    getSession: async () => ({
      session: {
        createdAt,
        userId: authUserId,
      },
      user: {
        id: authUserId,
      },
    }),
  });
}

describe("Points user and global ADMIN", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(async () => {
    await db.batch([
      db.prepare("DROP TRIGGER IF EXISTS permanent_oauth_subject_no_update"),
      db.prepare("DROP TRIGGER IF EXISTS permanent_oauth_subject_no_delete"),
    ]);
    await db.exec(
      "DELETE FROM admin_membership; DELETE FROM permanent_oauth_subject; DELETE FROM points_user; DELETE FROM account; DELETE FROM session; DELETE FROM user;",
    );
    await db.batch([
      db.prepare(
        `CREATE TRIGGER permanent_oauth_subject_no_update
         BEFORE UPDATE ON permanent_oauth_subject
         BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_PERMANENT_OAUTH_SUBJECT'); END`,
      ),
      db.prepare(
        `CREATE TRIGGER permanent_oauth_subject_no_delete
         BEFORE DELETE ON permanent_oauth_subject
         BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_PERMANENT_OAUTH_SUBJECT'); END`,
      ),
    ]);
  });

  it.each([
    ["GET", "/api/reconciliation"],
    ["POST", "/api/reconciliation/run"],
  ])("returns 404 for the removed %s %s route", async (method, path) => {
    const app = createPointsBackendApp({ getSession: async () => null });
    const response = await app.fetch(new Request(`https://points.test${path}`, { method }), env);

    expect(response.status).toBe(404);
  });

  it("returns a problem+json 401 when the Better Auth session is missing", async () => {
    const app = createPointsBackendApp({ getSession: async () => null });

    const response = await app.fetch(
      new Request("https://points.test/api/admin/admin-memberships", {
        body: JSON.stringify({ pointsUserId: "pusr_target", reason: "unauthenticated" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    await expect(response.json()).resolves.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
      status: 401,
    });
  });

  it("requires a current Google account for a fresh admin mutation", async () => {
    await seedAuthUser("owner");
    const owner = await provisionPointsUser(db, "owner", () => "pusr_owner");
    await db
      .prepare(
        "INSERT INTO admin_membership (id, points_user_id, role) VALUES ('adm_owner', ?, 'ADMIN')",
      )
      .bind(owner.id)
      .run();

    const response = await authenticatedApp("owner").fetch(
      new Request("https://points.test/api/admin/admin-memberships", {
        body: JSON.stringify({ pointsUserId: "pusr_target", reason: "delegate" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "FRESH_GOOGLE_AUTH_REQUIRED",
      status: 401,
    });
  });

  it("rejects an admin mutation when the Better Auth session is older than 900 seconds", async () => {
    await seedAuthUser("owner", "google-owner");
    const owner = await provisionPointsUser(db, "owner", () => "pusr_owner");
    await db
      .prepare(
        "INSERT INTO admin_membership (id, points_user_id, role) VALUES ('adm_owner', ?, 'ADMIN')",
      )
      .bind(owner.id)
      .run();

    const response = await authenticatedApp("owner", new Date(Date.now() - 901_000)).fetch(
      new Request("https://points.test/api/admin/admin-memberships", {
        body: JSON.stringify({ pointsUserId: "pusr_target", reason: "delegate" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "FRESH_GOOGLE_AUTH_REQUIRED",
      status: 401,
    });
  });

  it("reloads ADMIN membership for each request", async () => {
    await seedAuthUser("owner", "google-owner");
    const app = authenticatedApp("owner");
    const request = () => new Request("https://points.test/api/admin/admin-memberships");

    const forbidden = await app.fetch(
      new Request("https://points.test/api/admin/admin-memberships", {
        body: JSON.stringify({ pointsUserId: "pusr_target", reason: "not an admin" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(forbidden.status).toBe(403);
    const owner = await db
      .prepare(
        "SELECT id, auth_user_id AS authUserId FROM points_user WHERE auth_user_id = 'owner'",
      )
      .first<{ authUserId: string; id: string }>();
    expect(owner?.id).toMatch(/^pusr_/);
    await db
      .prepare(
        "INSERT INTO admin_membership (id, points_user_id, role) VALUES ('adm_owner', ?, 'ADMIN')",
      )
      .bind(owner?.id)
      .run();

    const response = await app.fetch(request(), env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ pointsUserId: owner?.id, role: "ADMIN" }],
    });
  });

  it("requires reason and connects POST and DELETE to the membership use case", async () => {
    await seedAuthUser("owner", "google-owner");
    await seedAuthUser("target");
    const owner = await provisionPointsUser(db, "owner", () => "pusr_owner");
    const target = await provisionPointsUser(db, "target", () => "pusr_target");
    await db
      .prepare(
        "INSERT INTO admin_membership (id, points_user_id, role) VALUES ('adm_owner', ?, 'ADMIN')",
      )
      .bind(owner.id)
      .run();
    const app = authenticatedApp("owner");

    const missingReason = await app.fetch(
      new Request("https://points.test/api/admin/admin-memberships", {
        body: JSON.stringify({ pointsUserId: target.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(missingReason.status).toBe(422);
    await expect(missingReason.json()).resolves.toMatchObject({ code: "ADMIN_REASON_REQUIRED" });

    const added = await app.fetch(
      new Request("https://points.test/api/admin/admin-memberships", {
        body: JSON.stringify({ pointsUserId: target.id, reason: "delegate" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(added.status).toBe(201);

    const duplicate = await app.fetch(
      new Request("https://points.test/api/admin/admin-memberships", {
        body: JSON.stringify({ pointsUserId: target.id, reason: "duplicate" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.headers.get("content-type")).toContain("application/problem+json");
    await expect(duplicate.json()).resolves.toMatchObject({
      code: "ADMIN_LIMIT_OR_DUPLICATE",
      status: 409,
    });

    const deletePath = adminMembershipRoutePolicies.delete.route.replace(
      ":pointsUserId",
      target.id,
    );
    const removed = await app.fetch(
      new Request(`https://points.test${deletePath}`, {
        body: JSON.stringify({ reason: "delegation ended" }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      }),
      env,
    );
    expect(removed.status).toBe(204);

    const finalAdmin = await app.fetch(
      new Request(
        `https://points.test${adminMembershipRoutePolicies.delete.route.replace(
          ":pointsUserId",
          owner.id,
        )}`,
        {
          body: JSON.stringify({ reason: "invalid final deletion" }),
          headers: { "Content-Type": "application/json" },
          method: "DELETE",
        },
      ),
      env,
    );
    expect(finalAdmin.status).toBe(409);
    expect(finalAdmin.headers.get("content-type")).toContain("application/problem+json");
    await expect(finalAdmin.json()).resolves.toMatchObject({
      code: "LAST_ADMIN_REQUIRED",
      status: 409,
    });
  });

  it("provisions one Points user for one Better Auth user", async () => {
    await seedAuthUser("auth-user");

    const first = await provisionPointsUser(db, "auth-user", () => "pusr_first");
    const second = await provisionPointsUser(db, "auth-user", () => "pusr_second");

    expect(first.id).toBe("pusr_first");
    expect(second.id).toBe("pusr_first");
  });

  it("provisions from the Better Auth session create hook", async () => {
    await seedAuthUser("hook-owner", "google-hook-owner");
    const auth = createPointsAuth(env);
    const hook = ((await auth.$context).options as BetterAuthOptions).databaseHooks?.session?.create
      ?.after;

    expect(hook).toBeTypeOf("function");
    await hook?.(
      {
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        id: "session-hook",
        token: "session-hook-token",
        updatedAt: new Date(),
        userId: "hook-owner",
      },
      null,
    );

    const pointsUser = await db
      .prepare("SELECT id FROM points_user WHERE auth_user_id = 'hook-owner'")
      .first<{ id: string }>();
    expect(pointsUser?.id).toMatch(/^pusr_/);
    const admin = await db
      .prepare("SELECT points_user_id AS pointsUserId FROM admin_membership")
      .first<{ pointsUserId: string }>();
    expect(admin).toBeNull();
  });

  it("refuses to delete the final ADMIN", async () => {
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    await seedAuthUser("owner", "google-owner");
    const owner = await provisionPointsUser(db, "owner", () => "pusr_owner");
    await db
      .prepare(
        "INSERT INTO admin_membership (id, points_user_id, role) VALUES ('adm_owner', ?, 'ADMIN')",
      )
      .bind(owner.id)
      .run();

    await expect(
      changeAdminMembership(db, {
        action: "DELETE",
        actorPointsUserId: owner.id,
        reason: "must keep one admin",
        requestId: "req-delete",
        targetPointsUserId: owner.id,
      }),
    ).rejects.toThrow("LAST_ADMIN_REQUIRED");
    expect(logs).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ADMIN_MEMBERSHIP_DELETE",
        outcome: "REJECTED",
        code: "LAST_ADMIN_REQUIRED",
      }),
    );
  });

  it("adds and removes an ADMIN with structured audit logs", async () => {
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    await seedAuthUser("owner", "google-owner");
    await seedAuthUser("second");
    const owner = await provisionPointsUser(db, "owner", () => "pusr_owner");
    const second = await provisionPointsUser(db, "second", () => "pusr_second");
    await db
      .prepare(
        "INSERT INTO admin_membership (id, points_user_id, role) VALUES ('adm_owner', ?, 'ADMIN')",
      )
      .bind(owner.id)
      .run();

    await changeAdminMembership(db, {
      action: "ADD",
      actorPointsUserId: owner.id,
      membershipId: "adm_second",
      reason: "share administration",
      requestId: "req-add",
      targetPointsUserId: second.id,
    });
    await changeAdminMembership(db, {
      action: "DELETE",
      actorPointsUserId: owner.id,
      reason: "handover complete",
      requestId: "req-remove",
      targetPointsUserId: owner.id,
    });

    const memberships = await db
      .prepare("SELECT points_user_id AS pointsUserId FROM admin_membership")
      .all<{ pointsUserId: string }>();
    expect(memberships.results).toEqual([{ pointsUserId: second.id }]);
    const auditLogs = logs.mock.calls.map(([log]) => log);
    expect(auditLogs).toEqual([
      expect.objectContaining({
        operation: "ADMIN_MEMBERSHIP_ADD",
        outcome: "SUCCESS",
        requestId: "req-add",
      }),
      expect.objectContaining({
        operation: "ADMIN_MEMBERSHIP_DELETE",
        outcome: "SUCCESS",
        requestId: "req-remove",
      }),
    ]);
    expect(JSON.stringify(auditLogs)).not.toContain("share administration");
    expect(JSON.stringify(auditLogs)).not.toContain(owner.id);
  });

  it("preserves a committed ADMIN change when audit logging fails", async () => {
    await seedAuthUser("owner", "google-owner");
    await seedAuthUser("second");
    const owner = await provisionPointsUser(db, "owner", () => "pusr_owner");
    const second = await provisionPointsUser(db, "second", () => "pusr_second");
    await db
      .prepare(
        "INSERT INTO admin_membership (id, points_user_id, role) VALUES ('adm_owner', ?, 'ADMIN')",
      )
      .bind(owner.id)
      .run();
    const logs = vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("LOG_SINK_UNAVAILABLE");
    });
    await expect(
      changeAdminMembership(db, {
        action: "ADD",
        actorPointsUserId: owner.id,
        membershipId: "adm_second",
        reason: "delegate",
        requestId: "req-log-failure",
        targetPointsUserId: second.id,
      }),
    ).resolves.toBeUndefined();
    expect(logs).toHaveBeenCalledTimes(1);
    expect(
      await db
        .prepare("SELECT count(*) AS count FROM admin_membership WHERE points_user_id = ?")
        .bind(second.id)
        .first(),
    ).toEqual({ count: 1 });
  });

  it("keeps one ADMIN when two ADMINs concurrently delete each other", async () => {
    await seedAuthUser("first", "google-first");
    await seedAuthUser("second");
    const first = await provisionPointsUser(db, "first", () => "pusr_first");
    const second = await provisionPointsUser(db, "second", () => "pusr_second");
    await db
      .prepare(
        "INSERT INTO admin_membership (id, points_user_id, role) VALUES ('adm_first', ?, 'ADMIN')",
      )
      .bind(first.id)
      .run();
    await changeAdminMembership(db, {
      action: "ADD",
      actorPointsUserId: first.id,
      membershipId: "adm_second",
      reason: "add second admin",
      requestId: "req-add-second",
      targetPointsUserId: second.id,
    });

    const results = await Promise.allSettled([
      changeAdminMembership(db, {
        action: "DELETE",
        actorPointsUserId: first.id,
        reason: "concurrent deletion",
        requestId: "req-first-deletes-second",
        targetPointsUserId: second.id,
      }),
      changeAdminMembership(db, {
        action: "DELETE",
        actorPointsUserId: second.id,
        reason: "concurrent deletion",
        requestId: "req-second-deletes-first",
        targetPointsUserId: first.id,
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const count = await db
      .prepare("SELECT COUNT(*) AS count FROM admin_membership")
      .first<{ count: number }>();
    expect(count?.count).toBe(1);
  });
});
