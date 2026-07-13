import { Hono } from "hono";

import { createPointsAuth } from "./auth/create-auth";
import { getGitHubAccessToken, type GetGitHubAccessToken } from "./auth/github-identity-grant";
import type { BackendContext } from "./http/context";
import { registerAccountRoutes } from "./http/routes/account-routes";
import { registerAdminRoutes } from "./http/routes/admin-routes";
import { registerAuthRoutes } from "./http/routes/auth-routes";
import { registerEvaluationRoutes } from "./http/routes/evaluation-routes";
import { registerEvaluationImportRoutes } from "./http/routes/evaluation-import-routes";
import { registerExportRoutes } from "./http/routes/export-routes";
import { registerDistributionRoutes } from "./http/routes/distribution-routes";
import { registerFixRoutes } from "./http/routes/fix-routes";
import { registerOwnershipRoutes } from "./http/routes/ownership-routes";
import { registerOAuthResourceRoutes } from "./http/routes/oauth-resource-routes";
import { registerProfileRoutes } from "./http/routes/profile-routes";
import { registerPublicRoutes } from "./http/routes/public-routes";
import { registerReconciliationRoutes } from "./http/routes/reconciliation-routes";
import { registerTransactionRoutes } from "./http/routes/transaction-routes";
import type { GetSession } from "./http/middleware/session-middleware";

export interface PointsBackendDependencies {
  getSession: GetSession;
  getGitHubAccessToken?: GetGitHubAccessToken;
  githubFetch?: typeof fetch;
  githubRevokeFetch?: typeof fetch;
  webOwnershipFetch?: typeof fetch;
}

const defaultDependencies: PointsBackendDependencies = {
  getSession: (env, headers) => createPointsAuth(env).api.getSession({ headers }),
};

export function createPointsBackendApp(
  dependencies: PointsBackendDependencies = defaultDependencies,
) {
  const app = new Hono<BackendContext>();
  registerAuthRoutes(app);
  registerAccountRoutes(app, dependencies.getSession);
  registerEvaluationRoutes(app);
  registerEvaluationImportRoutes(app, dependencies.getSession);
  registerExportRoutes(app, dependencies.getSession);
  registerDistributionRoutes(app, dependencies.getSession);
  registerAdminRoutes(app, dependencies.getSession);
  registerFixRoutes(app, dependencies.getSession, { githubFetch: dependencies.githubFetch });
  registerOwnershipRoutes(app, dependencies.getSession, {
    getGitHubAccessToken: dependencies.getGitHubAccessToken ?? getGitHubAccessToken,
    githubRevokeFetch: dependencies.githubRevokeFetch,
    webOwnershipFetch: dependencies.webOwnershipFetch,
  });
  registerOAuthResourceRoutes(app);
  registerProfileRoutes(app, dependencies.getSession);
  registerPublicRoutes(app);
  registerReconciliationRoutes(app, dependencies.getSession);
  registerTransactionRoutes(app, dependencies.getSession);
  return app;
}

export const pointsBackendApp = createPointsBackendApp();
