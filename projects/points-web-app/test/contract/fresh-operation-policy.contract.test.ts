import { describe, expect, it } from "vite-plus/test";

import { freshOperationPolicies } from "../../src/backend/auth/fresh-operation-policy";
import { adminMembershipRoutePolicies } from "../../src/backend/http/routes/admin-routes";

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
  });
});
