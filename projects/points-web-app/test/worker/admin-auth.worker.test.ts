import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createPointsAuth } from "../../src/backend/auth/create-auth";
import type { Bindings } from "../../src/backend/http/context";
import { bootstrapInitialAdmin } from "../../src/backend/usecases/bootstrap-admin";
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

describe("Points user and global ADMIN", () => {
  beforeEach(async () => {
    await db.exec(
      "DELETE FROM audit_event; DELETE FROM admin_membership; DELETE FROM points_user; DELETE FROM account; DELETE FROM session; DELETE FROM user;",
    );
  });

  it("provisions one Points user for one Better Auth user", async () => {
    await seedAuthUser("auth-user");

    const first = await provisionPointsUser(db, "auth-user", () => "pusr_first");
    const second = await provisionPointsUser(db, "auth-user", () => "pusr_second");

    expect(first.id).toBe("pusr_first");
    expect(second.id).toBe("pusr_first");
  });

  it("bootstraps only the configured Google account", async () => {
    await seedAuthUser("owner", "google-owner");
    const owner = await provisionPointsUser(db, "owner", () => "pusr_owner");

    expect(
      await bootstrapInitialAdmin(db, {
        authUserId: "owner",
        initialGoogleAccountId: "google-owner",
        membershipId: "adm_owner",
        pointsUserId: owner.id,
      }),
    ).toBe(true);
    expect(
      await bootstrapInitialAdmin(db, {
        authUserId: "owner",
        initialGoogleAccountId: "google-owner",
        membershipId: "adm_duplicate",
        pointsUserId: owner.id,
      }),
    ).toBe(false);
  });

  it("provisions and bootstraps from the Better Auth session create hook", async () => {
    await seedAuthUser("hook-owner", "google-hook-owner");
    const auth = createPointsAuth({
      ...(env as Bindings),
      INITIAL_ADMIN_GOOGLE_ACCOUNT_ID: "google-hook-owner",
    });
    const hook = (await auth.$context).options.databaseHooks?.session?.create?.after;

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
    const admin = await db
      .prepare("SELECT points_user_id AS pointsUserId FROM admin_membership")
      .first<{ pointsUserId: string }>();
    expect(pointsUser?.id).toMatch(/^pusr_/);
    expect(admin?.pointsUserId).toBe(pointsUser?.id);
  });

  it("refuses to delete the final ADMIN", async () => {
    await seedAuthUser("owner", "google-owner");
    const owner = await provisionPointsUser(db, "owner", () => "pusr_owner");
    await bootstrapInitialAdmin(db, {
      authUserId: "owner",
      initialGoogleAccountId: "google-owner",
      membershipId: "adm_owner",
      pointsUserId: owner.id,
    });

    await expect(
      changeAdminMembership(db, {
        action: "DELETE",
        actorPointsUserId: owner.id,
        auditEventId: "audit-delete",
        reason: "must keep one admin",
        requestId: "req-delete",
        targetPointsUserId: owner.id,
      }),
    ).rejects.toThrow("LAST_ADMIN_REQUIRED");
  });

  it("adds and removes an ADMIN with a reason and audit event", async () => {
    await seedAuthUser("owner", "google-owner");
    await seedAuthUser("second");
    const owner = await provisionPointsUser(db, "owner", () => "pusr_owner");
    const second = await provisionPointsUser(db, "second", () => "pusr_second");
    await bootstrapInitialAdmin(db, {
      authUserId: "owner",
      initialGoogleAccountId: "google-owner",
      membershipId: "adm_owner",
      pointsUserId: owner.id,
    });

    await changeAdminMembership(db, {
      action: "ADD",
      actorPointsUserId: owner.id,
      auditEventId: "audit-add",
      membershipId: "adm_second",
      reason: "share administration",
      requestId: "req-add",
      targetPointsUserId: second.id,
    });
    await changeAdminMembership(db, {
      action: "DELETE",
      actorPointsUserId: owner.id,
      auditEventId: "audit-remove",
      reason: "handover complete",
      requestId: "req-remove",
      targetPointsUserId: owner.id,
    });

    const memberships = await db
      .prepare("SELECT points_user_id AS pointsUserId FROM admin_membership")
      .all<{ pointsUserId: string }>();
    const audits = await db
      .prepare("SELECT action FROM audit_event ORDER BY created_at, id")
      .all<{ action: string }>();
    expect(memberships.results).toEqual([{ pointsUserId: second.id }]);
    expect(audits.results.map(({ action }) => action)).toEqual([
      "ADMIN_MEMBERSHIP_ADD",
      "ADMIN_MEMBERSHIP_DELETE",
    ]);
  });

  it("keeps one ADMIN when two ADMINs concurrently delete each other", async () => {
    await seedAuthUser("first", "google-first");
    await seedAuthUser("second");
    const first = await provisionPointsUser(db, "first", () => "pusr_first");
    const second = await provisionPointsUser(db, "second", () => "pusr_second");
    await bootstrapInitialAdmin(db, {
      authUserId: "first",
      initialGoogleAccountId: "google-first",
      membershipId: "adm_first",
      pointsUserId: first.id,
    });
    await changeAdminMembership(db, {
      action: "ADD",
      actorPointsUserId: first.id,
      auditEventId: "audit-add-second",
      membershipId: "adm_second",
      reason: "add second admin",
      requestId: "req-add-second",
      targetPointsUserId: second.id,
    });

    const results = await Promise.allSettled([
      changeAdminMembership(db, {
        action: "DELETE",
        actorPointsUserId: first.id,
        auditEventId: "audit-first-deletes-second",
        reason: "concurrent deletion",
        requestId: "req-first-deletes-second",
        targetPointsUserId: second.id,
      }),
      changeAdminMembership(db, {
        action: "DELETE",
        actorPointsUserId: second.id,
        auditEventId: "audit-second-deletes-first",
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
