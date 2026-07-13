import { describe, expect, it } from "vite-plus/test";

import {
  freshOperationPolicies,
  type FreshOperationPolicy,
} from "../../src/backend/auth/fresh-operation-policy";
import { adminMiddleware } from "../../src/backend/http/middleware/admin-middleware";
import { googleFreshMiddleware } from "../../src/backend/http/middleware/google-fresh-middleware";
import { createSessionMiddleware } from "../../src/backend/http/middleware/session-middleware";
import {
  adminMembershipRoutePolicies,
  getAdminMembershipPolicyMiddlewares,
} from "../../src/backend/http/routes/admin-routes";

describe("fresh operation policy", () => {
  it("registers every v0.2 critical operation once", () => {
    const operations = freshOperationPolicies.map(({ operation }) => operation);

    expect(new Set(operations).size).toBe(operations.length);
    expect(operations).toEqual(
      expect.arrayContaining([
        "social-account-link",
        "unclaimed-fix-claim",
        "points-markets-link",
        "admin-membership-add",
        "admin-membership-delete",
        "account-close",
        "account-reopen",
        "profile-visibility-update",
        "settlement-retry",
        "reconciliation",
      ]),
    );
  });

  it("requires a session and Google fresh proof for every registered operation", () => {
    expect(freshOperationPolicies.every(({ fresh, session }) => fresh && session)).toBe(true);
  });

  it("uses the registry policies as the admin membership route source", () => {
    const addPolicy = freshOperationPolicies.find(
      ({ operation }) => operation === "admin-membership-add",
    );
    const deletePolicy = freshOperationPolicies.find(
      ({ operation }) => operation === "admin-membership-delete",
    );

    expect(adminMembershipRoutePolicies.add).toBe(addPolicy);
    expect(adminMembershipRoutePolicies.delete).toBe(deletePolicy);
    expect(adminMembershipRoutePolicies.add.route).toBe("/api/admin/admin-memberships");
    expect(adminMembershipRoutePolicies.delete.route).toBe(
      "/api/admin/admin-memberships/:pointsUserId",
    );

    for (const policy of Object.values(adminMembershipRoutePolicies)) {
      expect(policy).toMatchObject({ admin: true, fresh: true, reason: true, session: true });
      const sessionMiddleware = createSessionMiddleware(async () => null);
      expect(getAdminMembershipPolicyMiddlewares(policy, sessionMiddleware)).toEqual([
        sessionMiddleware,
        adminMiddleware,
        googleFreshMiddleware,
      ]);
      for (const flag of ["session", "admin", "fresh", "reason"] as const) {
        expect(() =>
          getAdminMembershipPolicyMiddlewares(
            { ...policy, [flag]: false } as unknown as FreshOperationPolicy,
            sessionMiddleware,
          ),
        ).toThrow("ADMIN_MEMBERSHIP_POLICY_REQUIREMENTS_MISSING");
      }
    }
  });
});
