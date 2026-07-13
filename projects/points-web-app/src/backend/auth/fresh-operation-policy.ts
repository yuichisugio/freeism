export interface FreshOperationPolicy {
  operation: string;
  route: string;
  session: true;
  admin: boolean;
  fresh: true;
  reason: boolean;
  idempotency: boolean;
}

const baseFreshOperationPolicies = [
  {
    operation: "social-account-link",
    route: "better-auth:linkSocial",
    admin: false,
    reason: false,
    idempotency: false,
  },
  {
    operation: "github-ownership-deactivate",
    route: "/api/ownership/github/deactivate",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "github-ownership-reactivate",
    route: "/api/ownership/github/reactivate",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "web-ownership-verify",
    route: "/api/ownership/web/verify",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "unclaimed-fix-claim",
    route: "/api/ownership/:id/claim",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "points-markets-link",
    route: "oauth:link",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "points-markets-relink",
    route: "oauth:relink",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "points-markets-add-scope",
    route: "oauth:add-scope",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "points-markets-unlink",
    route: "/api/v1/me/connection-deactivations",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "admin-fix-csv",
    route: "/api/admin/fixes/csv/commit",
    admin: true,
    reason: true,
    idempotency: true,
  },
  {
    operation: "admin-evaluation-criterion-csv",
    route: "/api/admin/evaluation-criteria/csv/commit",
    admin: true,
    reason: true,
    idempotency: true,
  },
  {
    operation: "admin-point-package-csv",
    route: "/api/admin/point-packages/csv/commit",
    admin: true,
    reason: true,
    idempotency: true,
  },
  {
    operation: "admin-exchange-rate-csv",
    route: "/api/admin/exchange-rates/csv/commit",
    admin: true,
    reason: true,
    idempotency: true,
  },
  {
    operation: "admin-substitution-csv",
    route: "/api/admin/substitutions/csv/commit",
    admin: true,
    reason: true,
    idempotency: true,
  },
  {
    operation: "transfer-csv",
    route: "/api/transfers/csv/commit",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "exchange-csv",
    route: "/api/exchanges/csv/commit",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "auto-distribution-csv",
    route: "/api/settings/auto-distribution/csv/commit",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "admin-membership-add",
    route: "/api/admin/admin-memberships",
    admin: true,
    reason: true,
    idempotency: true,
  },
  {
    operation: "admin-membership-delete",
    route: "/api/admin/admin-memberships/:id",
    admin: true,
    reason: true,
    idempotency: true,
  },
  {
    operation: "account-close",
    route: "/api/account/close",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "account-reopen",
    route: "/api/account/reopen",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "profile-visibility-update",
    route: "/api/profile/visibility",
    admin: false,
    reason: false,
    idempotency: true,
  },
  {
    operation: "admin-csv-export",
    route: "/api/csv-exports",
    admin: true,
    reason: false,
    idempotency: true,
  },
  {
    operation: "oauth-security-mutation",
    route: "/api/admin/oauth-security",
    admin: true,
    reason: true,
    idempotency: true,
  },
  {
    operation: "settlement-retry",
    route: "oauth:settlement-retry",
    admin: true,
    reason: true,
    idempotency: true,
  },
  {
    operation: "reconciliation",
    route: "/api/admin/reconciliation",
    admin: true,
    reason: true,
    idempotency: true,
  },
] as const satisfies readonly (Omit<FreshOperationPolicy, "session" | "fresh"> & {
  session?: never;
  fresh?: never;
})[];

export const freshOperationPolicies: readonly FreshOperationPolicy[] =
  baseFreshOperationPolicies.map((policy) => ({ ...policy, fresh: true, session: true }));
