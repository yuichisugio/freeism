import { Hono } from "hono";

import { createPointsAuth } from "./auth/create-auth";
import type { BackendContext, Bindings } from "./http/context";
import {
  createD1AccountsRecipientResolver,
  type CreateAccountsRecipientResolver,
} from "./identity/accounts-recipient-resolver";
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
  /** FIX 受領者の照合関数。指定しない場合は D1 の接続先と `accountsFetch` で照合する。 */
  createAccountsRecipientResolver?: CreateAccountsRecipientResolver;
}

const defaultDependencies: PointsBackendDependencies = {
  getSession: (env, headers) => createPointsAuth(env).api.getSession({ headers }),
};

export function createPointsBackendApp(
  dependencies: PointsBackendDependencies = defaultDependencies,
) {
  const app = new Hono<BackendContext>();
  const accountsRecipientResolverFor = (bindings: Bindings) =>
    dependencies.createAccountsRecipientResolver ??
    createD1AccountsRecipientResolver({
      db: bindings.DB,
      keyEncryptionKey: bindings.ACCOUNTS_KEY_ENCRYPTION_KEY,
      fetch: dependencies.accountsFetch ?? fetch,
    });
  registerAuthRoutes(app);
  registerAccountRoutes(app, dependencies.getSession, { accountsRecipientResolverFor });
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
  registerFixRoutes(app, dependencies.getSession, { accountsRecipientResolverFor });
  registerOAuthResourceRoutes(app);
  registerOpsRoutes(app);
  registerProfileRoutes(app, dependencies.getSession);
  registerPublicRoutes(app);
  registerReconciliationRoutes(app, dependencies.getSession);
  registerTransactionRoutes(app, dependencies.getSession);
  return app;
}

export const pointsBackendApp = createPointsBackendApp();
