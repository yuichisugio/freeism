import { Hono } from "hono";

import {
  externalAccountListRequestSchema,
  resolveRequestSchema,
} from "../../shared/schemas/resource-api-schema";
import { createDatabase } from "../db/database";
import type { Bindings } from "../hono-env";
import {
  requireClientAccessToken,
  type ClientTokenVariables,
} from "../middleware/client-token-middleware";
import { requireJsonBody } from "../middleware/json-body-middleware";
import {
  handleResourceApiError,
  parseResourceApiBody,
  resourceApiResponse,
} from "../resource-api-response";
import { listExternalAccountsForClient } from "../usecases/resource-api/list-external-accounts-for-client";
import { resolveIdentities } from "../usecases/resource-api/resolve-identities";

/**
 * Accounts資源API（`/api/v1`）。
 * 読取条件をJSON bodyで渡すHTTP `QUERY`で、一覧取得と照合を提供する。
 * 検査は、クライアント認証（401・403）→`Content-Type`→容量→JSONの構文→形式の順に行う。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./resource-api-routes.worker.test.ts
 */
export const resourceApiRoutes = new Hono<{ Bindings: Bindings; Variables: ClientTokenVariables }>()
  .onError(handleResourceApiError)
  .use(requireClientAccessToken, requireJsonBody)
  .query("/external-accounts", async (c) => {
    const { accountsUserId } = await parseResourceApiBody(c, externalAccountListRequestSchema);
    const list = await listExternalAccountsForClient(
      { db: createDatabase(c.env.DB), accountsOrigin: c.env.ACCOUNTS_ORIGIN },
      { clientId: c.get("clientId"), accountsUserId },
    );
    return resourceApiResponse(c, list);
  })
  .query("/identities/resolve", async (c) => {
    const { identifiers } = await parseResourceApiBody(c, resolveRequestSchema);
    const { results, hasInvalidInput } = await resolveIdentities(
      { db: createDatabase(c.env.DB) },
      { clientId: c.get("clientId"), identifiers },
    );
    return resourceApiResponse(
      c,
      { accountsOrigin: c.env.ACCOUNTS_ORIGIN, results },
      hasInvalidInput ? 400 : 200,
    );
  });
