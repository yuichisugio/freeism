import { Hono } from "hono";

import { createPointsAuth } from "./auth/create-auth";
import type { BackendContext } from "./http/context";
import type { CreateAccountsRecipientResolver } from "./identity/accounts-recipient-resolver";
import { registerAccountRoutes } from "./http/routes/account-routes";
import { registerAccountsConnectionRoutes } from "./http/routes/accounts-connection-routes";
import { registerAccountsLinkRoutes } from "./http/routes/accounts-link-routes";
import { registerAdminRoutes } from "./http/routes/admin-routes";
import { registerAuthRoutes } from "./http/routes/auth-routes";
import { registerEvaluationRoutes } from "./http/routes/evaluation-routes";
import { registerEvaluationImportRoutes } from "./http/routes/evaluation-import-routes";
import { registerExportRoutes } from "./http/routes/export-routes";
import { registerDistributionRoutes } from "./http/routes/distribution-routes";
import { registerFixRoutes } from "./http/routes/fix-routes";
import { registerOAuthResourceRoutes } from "./http/routes/oauth-resource-routes";
import { registerOpsRoutes } from "./http/routes/ops-routes";
import { registerProfileRoutes } from "./http/routes/profile-routes";
import { registerPublicRoutes } from "./http/routes/public-routes";
import { registerReconciliationRoutes } from "./http/routes/reconciliation-routes";
import { registerTransactionRoutes } from "./http/routes/transaction-routes";
import type { GetSession } from "./http/middleware/session-middleware";

export interface PointsBackendDependencies {
  getSession: GetSession;
  /** Accounts への要求に使う `fetch`。テストではテスト用 Accounts へ差し替える。 */
  accountsFetch?: typeof fetch;
  createAccountsRecipientResolver?: CreateAccountsRecipientResolver;
}

const defaultDependencies: PointsBackendDependencies = {
  getSession: (env, headers) => createPointsAuth(env).api.getSession({ headers }),
};

export function createPointsBackendApp(
  dependencies: PointsBackendDependencies = defaultDependencies,
) {
  const app = new Hono<BackendContext>();
  registerAuthRoutes(app);
  registerAccountRoutes(app, dependencies.getSession, {
    createAccountsRecipientResolver: dependencies.createAccountsRecipientResolver,
  });
  registerEvaluationRoutes(app);
  registerEvaluationImportRoutes(app, dependencies.getSession);
  registerExportRoutes(app, dependencies.getSession);
  registerDistributionRoutes(app, dependencies.getSession);
  registerAdminRoutes(app, dependencies.getSession);
  registerAccountsConnectionRoutes(app, dependencies.getSession, {
    accountsFetch: dependencies.accountsFetch ?? fetch,
  });
  registerAccountsLinkRoutes(app, dependencies.getSession, {
    accountsFetch: dependencies.accountsFetch ?? fetch,
  });
  registerFixRoutes(app, dependencies.getSession, {
    createAccountsRecipientResolver: dependencies.createAccountsRecipientResolver,
  });
  registerOAuthResourceRoutes(app);
  registerOpsRoutes(app);
  registerProfileRoutes(app, dependencies.getSession);
  registerPublicRoutes(app);
  registerReconciliationRoutes(app, dependencies.getSession);
  registerTransactionRoutes(app, dependencies.getSession);
  return app;
}

export const pointsBackendApp = createPointsBackendApp();
